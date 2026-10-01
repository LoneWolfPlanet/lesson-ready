/**
 * THE ONE PLACE TO EDIT WHEN THE BACKEND SCHEMA CHANGES.
 *
 * Converts the Lesson Pack API's JSON into the UI types in ./types.ts.
 * Written against a real GET /lesson-packs/{id} response (Oct 2026):
 *
 *   { id, status: "running" | "ready" | …, topic, grade, createdAt, updatedAt, error,
 *     result: {
 *       status, plan,
 *       lesson:  { learningObjectives[], sections[{title, body}], vocabulary[{term, definition}],
 *                  activity{title, materials[], steps[]}, notes },
 *       quiz:    { questions[{id, question, options[], correctIndex, explanation, sourceSection}] },
 *       review:  { verdict: "approved" | …, issues[], questionChecks[{id, answerIsCorrect, …}], summary },
 *       decision,
 *       teacher: { packStatus, teacherOverview, teachingTips[], teacherWarnings[] } } }
 *
 * `result` is null while the pack is running. Readers stay tolerant (camelCase and
 * snake_case, missing fields) so a small backend change doesn't blank a screen.
 */
import { config } from "../config";
import type {
  Activity,
  Grade,
  LessonSection,
  Pack,
  PackStatus,
  PackSummary,
  QuizQuestion,
  ReviewIssue,
  VocabularyItem,
  WorkStage,
} from "./types";

type Raw = Record<string, unknown>;

/** Backend job status (lower-cased) -> plain UI status. Add new states here. */
const STATUS_MAP: Record<string, PackStatus> = {
  queued: "working",
  pending: "working",
  accepted: "working",
  planning: "working",
  running: "working",
  in_progress: "working",
  processing: "working",
  writing: "working",
  reviewing: "working",
  ready: "ready",
  ready_with_notes: "check",
  completed: "ready",
  succeeded: "ready",
  approved: "ready",
  needs_review: "check",
  needsreview: "check",
  needs_attention: "check",
  flagged: "check",
  failed: "failed",
  error: "failed",
  cancelled: "failed",
  // Grounding found no curriculum document for the topic/grade (see failureKind).
  unavailable: "failed",
  not_found: "failed",
};

/** teacher.packStatus / review.verdict values that mean "teacher should check first". */
const CHECK_VALUES = new Set(["ready_with_notes", "needs_review", "needs_attention", "review", "revise", "flagged", "rejected", "blocked"]);

// ---------- small tolerant readers ----------
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
};
const num = (...vals: unknown[]): number | undefined => {
  for (const v of vals) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return undefined;
};
const strings = (v: unknown): string[] =>
  arr(v)
    .map((x) => (typeof x === "string" ? x.trim() : str(obj(x).text, obj(x).message, obj(x).note, obj(x).content)))
    .filter(Boolean);
const key = (v: unknown) => str(v).toLowerCase().replace(/[\s-]+/g, "_");

function toGrade(v: unknown): Grade {
  const n = num(v, typeof v === "string" ? v.replace(/\D/g, "") : undefined) ?? 1;
  return Math.min(6, Math.max(1, Math.round(n))) as Grade;
}

const warnedStatuses = new Set<string>();

/**
 * Maps the job status. Unknown values are classified by pattern, never left as
 * "working" when the pack is clearly finished. Otherwise the app would keep polling
 * forever (that is what happened with `ready_with_notes` before it was listed).
 */
function toStatus(raw: Raw): PackStatus {
  const k = key(raw.status ?? raw.state);
  const known = STATUS_MAP[k];
  if (known) return known;

  let guess: PackStatus;
  if (/fail|error|cancel|abort|timeout/.test(k)) guess = "failed";
  else if (/review|note|flag|attention|warn/.test(k)) guess = "check";
  else if (/^(ready|complete|succe|done|final)/.test(k)) guess = "ready";
  else guess = raw.result && typeof raw.result === "object" ? "ready" : "working";

  if (k && !warnedStatuses.has(k)) {
    warnedStatuses.add(k);
    console.warn(`Unknown pack status "${k}", treated as "${guess}". Add it to STATUS_MAP in src/api/adapter.ts.`);
  }
  return guess;
}

/**
 * The API reports only "running" while it works, so the progress step is estimated
 * from elapsed time against VITE_EXPECTED_MINUTES. Replace with a real stage field
 * (e.g. result.plan.status) if the API starts sending one.
 */
function estimateStage(createdAt: string): WorkStage {
  const elapsed = (Date.now() - Date.parse(createdAt)) / 60000;
  const share = elapsed / Math.max(0.5, config.expectedMinutes);
  if (!Number.isFinite(share) || share < 0.2) return "planning";
  if (share < 0.7) return "writing";
  return "checking";
}

// ---------- sections ----------
function toSections(lesson: Raw): LessonSection[] {
  return arr(lesson.sections)
    .map((x, i) => {
      const r = obj(x);
      return { title: str(r.title, r.heading) || `Part ${i + 1}`, body: str(r.body, r.content, r.text) };
    })
    .filter((s) => s.body);
}

function toVocabulary(lesson: Raw): VocabularyItem[] {
  return arr(lesson.vocabulary)
    .map((x) => ({ term: str(obj(x).term, obj(x).word), definition: str(obj(x).definition, obj(x).meaning) }))
    .filter((v) => v.term);
}

function toActivity(lesson: Raw): Activity | undefined {
  const a = obj(lesson.activity);
  const steps = strings(a.steps);
  if (!steps.length && !str(a.title)) return undefined;
  return { title: str(a.title) || "Activity", materials: strings(a.materials), steps };
}

function toQuiz(quiz: unknown): { questions: QuizQuestion[]; ids: string[] } {
  const list = arr(obj(quiz).questions ?? quiz);
  const ids: string[] = [];
  const questions = list.map((q, i) => {
    const r = obj(q);
    ids.push(str(r.id) || `q${i + 1}`);
    const options = strings(r.options ?? r.choices ?? r.answers);
    let answer = num(r.correctIndex, r.correct_index, r.answerIndex) ?? -1;
    if (answer < 0) {
      const text = str(r.answer, r.correctAnswer, r.correct_answer);
      answer = Math.max(0, options.findIndex((o) => o === text));
    }
    return {
      prompt: str(r.question, r.prompt, r.text),
      options,
      answer,
      explanation: str(r.explanation, r.rationale) || undefined,
    };
  });
  return { questions, ids };
}

/**
 * Everything the teacher should look at before teaching:
 *  - review.issues (shape not seen yet, so read loosely: message/description/summary,
 *    and a question id or index when it is about a quiz question)
 *  - review.questionChecks where answerIsCorrect is false
 *  - teacher.teacherWarnings
 */
function toIssues(review: Raw, teacher: Raw, quizIds: string[]): ReviewIssue[] {
  const indexOf = (r: Raw): number | undefined => {
    const id = str(r.questionId, r.question_id, r.id, r.target);
    const byId = id ? quizIds.indexOf(id) : -1;
    if (byId >= 0) return byId;
    return num(r.questionIndex, r.question_index, r.index);
  };

  const issues: ReviewIssue[] = arr(review.issues).map((x) => {
    const r = typeof x === "string" ? { message: x } : obj(x);
    const index = indexOf(r);
    const section = key(r.section ?? r.area);
    return {
      section: index !== undefined || section === "quiz" ? "quiz" : section === "notes" ? "notes" : "lesson",
      index,
      message: str(r.message, r.userMessage, r.description, r.summary, r.detail) || "Please check this part.",
    };
  });

  for (const c of arr(review.questionChecks ?? review.question_checks)) {
    const r = obj(c);
    if (r.answerIsCorrect === false || r.answer_is_correct === false) {
      const index = indexOf(r);
      if (index !== undefined && !issues.some((i) => i.section === "quiz" && i.index === index)) {
        issues.push({ section: "quiz", index, message: "The marked answer may be wrong." });
      }
    }
  }

  for (const w of strings(teacher.teacherWarnings ?? teacher.teacher_warnings)) {
    issues.push({ section: "lesson", message: w });
  }
  return issues;
}

// ---------- public ----------
/** Values known locally (from the create request) for fields the API response may omit. */
export interface PackFallback {
  id?: string;
  topic?: string;
  grade?: Grade;
  createdAt?: string;
}

export function toPackSummary(json: unknown, fallback: PackFallback = {}): PackSummary {
  const raw = obj(json);
  const grade = raw.grade ?? raw.gradeLevel;
  return {
    id: str(raw.id, raw.job_id, raw.jobId, fallback.id),
    topic: str(raw.topic, raw.title, fallback.topic) || "Untitled lesson",
    grade: grade !== undefined ? toGrade(grade) : (fallback.grade ?? 1),
    status: toStatus(raw),
    createdAt: str(raw.createdAt, raw.created_at, fallback.createdAt) || new Date().toISOString(),
    ...(key(raw.status) === "unavailable" ? { failureKind: "unavailable" as const } : {}),
  };
}

export function toPack(json: unknown, fallback: PackFallback = {}): Pack {
  const raw = obj(json);
  const summary = toPackSummary(raw, fallback);
  const result = obj(raw.result);
  const lesson = obj(result.lesson);
  const review = obj(result.review);
  const teacher = obj(result.teacher);
  const { questions, ids } = toQuiz(result.quiz);
  const issues = toIssues(review, teacher, ids);

  // Any of these downgrades a finished pack to "Check before use".
  const flaggedByApi =
    CHECK_VALUES.has(key(teacher.packStatus)) || CHECK_VALUES.has(key(review.verdict)) || issues.length > 0;
  let status = summary.status;
  if (status === "ready" && flaggedByApi) status = "check";

  const error = raw.error;
  const unavailable =
    status === "failed" &&
    (key(raw.status) === "unavailable" || key(teacher.packStatus) === "unavailable" || key(lesson.groundingStatus) === "not_found");
  return {
    ...summary,
    status,
    stage: status === "working" ? estimateStage(summary.createdAt) : "done",
    overview: str(teacher.teacherOverview, teacher.teacher_overview) || undefined,
    objectives: strings(lesson.learningObjectives ?? lesson.learning_objectives),
    sections: toSections(lesson),
    vocabulary: toVocabulary(lesson),
    activity: toActivity(lesson),
    quiz: questions,
    notes: strings(teacher.teachingTips ?? teacher.teaching_tips),
    reviewed: key(review.verdict) === "approved" && issues.length === 0,
    issues,
    // Only a field meant for teachers is shown; raw error text is often technical,
    // so it goes to the console and the screen shows the friendly default.
    failureReason: unavailable
      ? str(teacher.teacherOverview) || undefined
      : str(obj(error).userMessage, obj(error).user_message) || logError(summary.id, error),
    failureKind: status === "failed" ? (unavailable ? "unavailable" : "error") : undefined,
  };
}

function logError(id: string, error: unknown): undefined {
  if (error) console.warn(`Pack ${id} failed:`, error);
  return undefined;
}

export function toPackList(json: unknown): PackSummary[] {
  const raw = obj(json);
  const list = Array.isArray(json) ? json : arr(raw.items ?? raw.value ?? raw.packs);
  return list.map((x) => toPackSummary(x)).filter((p) => p.id);
}

/**
 * Body for POST /lesson-packs. The API's LessonPackRequest has only `topic` (1-200 chars)
 * and `grade` (1-12). Add `language` here once the API accepts it.
 */
export function toCreateBody(req: { topic: string; grade: Grade; language: string }) {
  return { topic: req.topic.slice(0, 200), grade: req.grade };
}

/** Reads the new pack's id from the POST response. */
export function toCreatedId(json: unknown): string {
  const raw = obj(json);
  return str(raw.id, raw.job_id, raw.jobId, raw.requestId);
}
