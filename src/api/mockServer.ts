/**
 * A fake Lesson Pack API for local development (VITE_API_MODE=mock).
 * It returns JSON in the SAME shape as the live API (a real response is kept in
 * ./fixtures/photosynthesis.json), so the adapter is exercised exactly as in production.
 */
import photosynthesis from "./fixtures/photosynthesis.json";

interface MockRequest {
  id: string;
  topic: string;
  grade: number;
  subject?: string;
  createdAt: string;
}

const KEY = "lr.mock.requests.v2";
const RUN_SECONDS = 18; // fast, so the waiting screen can be tried quickly

function load(): MockRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as MockRequest[];
  } catch {
    /* fall through */
  }
  const day = 24 * 3600 * 1000;
  const seed: MockRequest[] = [
    { id: "demo-photosynthesis", topic: "Photosynthesis", grade: 4, subject: "Science", createdAt: new Date(Date.now() - day).toISOString() },
    { id: "demo-fractions", topic: "Adding fractions", grade: 3, subject: "Math", createdAt: new Date(Date.now() - 3 * day).toISOString() },
  ];
  save(seed);
  return seed;
}

function save(list: MockRequest[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Teacher edits to quiz questions, by pack id then question id. */
const EDITS_KEY = "lr.mock.edits.v1";
type QuestionEdit = { question: string; options: string[]; correctIndex: number; explanation: string };
type StoredEdit = QuestionEdit & { teacherChecked: true; teacherEdited: boolean };

function loadEdits(): Record<string, Record<string, StoredEdit>> {
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Questions the teacher added, and ids they removed, by pack id. */
const QUIZ_CHANGES_KEY = "lr.mock.quizChanges.v1";
type QuizChanges = { added: Record<string, unknown>[]; removed: string[] };

function loadQuizChanges(): Record<string, QuizChanges> {
  try {
    return JSON.parse(localStorage.getItem(QUIZ_CHANGES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveQuizChanges(packId: string, changes: QuizChanges) {
  const all = loadQuizChanges();
  all[packId] = changes;
  try {
    localStorage.setItem(QUIZ_CHANGES_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** Teacher edits to the lesson and the notes, by pack id. */
const PART_EDITS_KEY = "lr.mock.partEdits.v1";
type PartEdits = { lesson?: Record<string, unknown>; teacher?: Record<string, unknown> };

function loadPartEdits(): Record<string, PartEdits> {
  try {
    return JSON.parse(localStorage.getItem(PART_EDITS_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePartEdit(packId: string, part: keyof PartEdits, fields: Record<string, unknown>) {
  const all = loadPartEdits();
  all[packId] = { ...all[packId], [part]: { ...all[packId]?.[part], ...fields } };
  try {
    localStorage.setItem(PART_EDITS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** Packs the teacher marked as reviewed. */
const REVIEWED_KEY = "lr.mock.reviewed.v1";
function loadReviewed(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(REVIEWED_KEY) || "{}");
  } catch {
    return {};
  }
}

const invalid = () => Object.assign(new Error("invalid"), { status: 422 });

/** Applies saved edits to a pack in the API's JSON shape. */
function withEdits(source: Record<string, unknown>) {
  let json = source;
  const reviewedAt = loadReviewed()[String(json.id)];
  if (reviewedAt && json.result) json = { ...json, status: "reviewed", reviewedAt };
  const parts = loadPartEdits()[String(json.id)];
  if (parts && json.result) {
    const result = { ...(json.result as Record<string, unknown>) };
    if (parts.lesson) result.lesson = { ...(result.lesson as object), ...parts.lesson };
    if (parts.teacher) result.teacher = { ...(result.teacher as object), ...parts.teacher };
    json = { ...json, result };
  }
  const changes = loadQuizChanges()[String(json.id)];
  const quiz0 = (json.result as { quiz?: { questions?: Record<string, unknown>[] } } | null)?.quiz;
  if (changes && quiz0?.questions) {
    const all = [...quiz0.questions, ...changes.added];
    json = {
      ...json,
      result: {
        ...(json.result as object),
        quiz: {
          ...quiz0,
          questions: all.filter((q) => !changes.removed.includes(String(q.id))),
          removedQuestions: quiz0.questions.filter((q) => changes.removed.includes(String(q.id))),
        },
      },
    };
  }
  const edits = loadEdits()[String(json.id)];
  const result = json.result as { quiz?: { questions?: Record<string, unknown>[] } } | null;
  const questions = result?.quiz?.questions;
  if (!edits || !questions) return json;
  const copy = structuredClone(json) as typeof json;
  const list = (copy.result as { quiz: { questions: Record<string, unknown>[] } }).quiz.questions;
  list.forEach((q, i) => {
    const e = edits[String(q.id)];
    if (e) list[i] = { ...q, ...e };
  });
  return copy;
}

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

type Outcome = "running" | "ready" | "flagged" | "failed";

function outcomeOf(r: MockRequest): Outcome {
  if (r.id === "demo-photosynthesis") return "ready";
  if (r.id === "demo-fractions") return "flagged";
  if ((Date.now() - Date.parse(r.createdAt)) / 1000 < RUN_SECONDS) return "running";
  if (/fail/i.test(r.topic)) return "failed";
  return hash(r.topic) % 3 === 0 ? "flagged" : "ready";
}

/** A generic pack in the live API's `result` shape. */
function result(r: MockRequest, flagged: boolean) {
  const t = r.topic;
  const low = t.toLowerCase();
  const q = (id: string, question: string, options: string[], correctIndex: number, explanation: string) => ({
    id,
    type: "multiple_choice",
    question,
    options,
    correctIndex,
    explanation,
  });
  return {
    requestId: r.id,
    status: "ready",
    lesson: {
      topic: t,
      grade: r.grade,
      learningObjectives: [
        `Explain ${low} in their own words.`,
        `Give one everyday example of ${low}.`,
        `Use the key words correctly in a sentence.`,
      ],
      sections: [
        { title: `What is ${t}?`, body: `Start with a question learners can answer from daily life, then introduce ${low} with a simple picture.` },
        { title: "Key ideas", body: `Explain the two or three ideas learners need most, using short sentences and one example for each.` },
        { title: "Let's Remember", body: `Summarise ${low} in one sentence and ask learners to repeat it in their own words.` },
      ],
      vocabulary: [
        { term: t, definition: `The topic of today's lesson.` },
        { term: "Example", definition: "Something that shows what an idea means." },
      ],
      activity: {
        title: "Pair share",
        materials: ["Paper", "Pencils"],
        steps: ["Learners work in pairs.", `Each pair draws one example of ${low}.`, "Two pairs share their drawing with the class."],
      },
    },
    quiz: {
      questions: [
        q("q1", `Which sentence best describes ${low}?`, ["A process we can observe", "A kind of animal", "A tool for writing", "A song"], 0, "It is something we can observe and describe."),
        q("q2", `Where can we see ${low} in daily life?`, ["Only in books", "Around us at home and school", "Only at night", "Nowhere"], 1, "Everyday examples help learners remember."),
        q("q3", "What should we remember from today?", ["The key words and one example", "Only the title", "Nothing", "The teacher's name"], 0, "The key words and an example are the main points."),
        q("q4", "Which is NOT part of today's topic?", ["The key words", "Our class example", "A football match", "The picture we used"], 2, "A football match was not part of the lesson."),
        q("q5", `Why is learning about ${low} useful?`, ["It helps us understand the world", "It is never useful", "Only adults need it", "It is only for tests"], 0, "It helps learners make sense of what they see."),
      ],
    },
    review: flagged
      ? {
          verdict: "revise",
          issues: [{ severity: "major", questionId: "q4", message: `May be too hard for Grade ${r.grade}. Try simpler wording.` }],
          questionChecks: [],
          summary: "One question may be too hard for the grade.",
        }
      : { verdict: "approved", issues: [], questionChecks: [], summary: "No issues found." },
    teacher: {
      packStatus: flagged ? "needs_review" : "ready",
      teacherOverview: `This lesson introduces ${low} for Grade ${r.grade} with a short explanation, a pair activity and a 5-question quiz.`,
      teachingTips: ["Prepare one large picture before class.", "Write the key words on cards.", "Watch for learners who mix up the key words."],
      teacherWarnings: [],
    },
  };
}

function toJson(r: MockRequest) {
  const outcome = outcomeOf(r);
  const base = { id: r.id, topic: r.topic, grade: r.grade, subject: r.subject ?? null, createdAt: r.createdAt, updatedAt: new Date().toISOString() };
  if (r.id === "demo-photosynthesis") return { ...photosynthesis, ...base };
  switch (outcome) {
    case "running":
      return { ...base, status: "running", error: null, result: null };
    case "failed":
      return { ...base, status: "failed", error: "Generation timed out", result: null };
    default:
      return { ...base, status: "ready", error: null, result: result(r, outcome === "flagged") };
  }
}

export const mockServer = {
  async list() {
    await delay();
    return {
      items: load()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => {
          const { result: _r, ...summary } = toJson(r) as Record<string, unknown>;
          return summary;
        }),
    };
  },
  async get(id: string) {
    await delay();
    const r = load().find((x) => x.id === id);
    if (!r) throw Object.assign(new Error("not found"), { status: 404 });
    return withEdits(toJson(r));
  },
  async updateLesson(
    packId: string,
    body: { learningObjectives: string[]; sections: unknown[]; vocabulary: unknown[]; activity: unknown; overview?: string },
  ) {
    await delay(500);
    const r = load().find((x) => x.id === packId);
    if (!r) throw Object.assign(new Error("not found"), { status: 404 });
    if (!body.learningObjectives.length || !body.sections.length) throw invalid();
    const before = (withEdits(toJson(r)).result as { lesson?: Record<string, unknown> } | null)?.lesson ?? {};
    const { overview, ...lesson } = body;
    const changed = ["learningObjectives", "sections", "vocabulary", "activity"].some(
      (k) => JSON.stringify((lesson as Record<string, unknown>)[k] ?? null) !== JSON.stringify(before[k] ?? null),
    );
    savePartEdit(packId, "lesson", { ...lesson, teacherChecked: true, ...(changed ? { teacherEdited: true } : {}) });
    if (overview !== undefined) savePartEdit(packId, "teacher", { teacherOverview: overview });
    return withEdits(toJson(r));
  },
  async addQuestion(packId: string, body: QuestionEdit) {
    await delay(500);
    const r = load().find((x) => x.id === packId);
    if (!r) throw Object.assign(new Error("not found"), { status: 404 });
    const norm = body.options.map((o) => o.trim().toLowerCase());
    if (!body.question.trim() || norm.some((o) => !o) || body.correctIndex >= norm.length) throw invalid();
    if (new Set(norm).size !== norm.length) {
      throw Object.assign(new Error("invalid"), { status: 422, detail: "two options contain the same words" });
    }
    const current = (withEdits(toJson(r)).result as { quiz?: { questions?: unknown[] } } | null)?.quiz?.questions ?? [];
    if (current.length >= 15) throw Object.assign(new Error("full"), { status: 409 });
    const changes = loadQuizChanges()[packId] ?? { added: [], removed: [] };
    const used = new Set([...changes.added.map((q) => q.id), ...changes.removed]);
    let n = 1;
    while (used.has(`t${n}`)) n++;
    changes.added.push({ id: `t${n}`, type: "multiple_choice", ...body, teacherChecked: true, addedByTeacher: true });
    saveQuizChanges(packId, changes);
    return withEdits(toJson(r));
  },
  async removeQuestion(packId: string, questionId: string) {
    await delay(400);
    const r = load().find((x) => x.id === packId);
    if (!r) throw Object.assign(new Error("not found"), { status: 404 });
    const current = (withEdits(toJson(r)).result as { quiz?: { questions?: { id: string }[] } } | null)?.quiz?.questions ?? [];
    if (!current.some((q) => q.id === questionId)) throw Object.assign(new Error("not found"), { status: 404 });
    if (current.length === 1) throw Object.assign(new Error("last"), { status: 409 });
    const changes = loadQuizChanges()[packId] ?? { added: [], removed: [] };
    if (changes.added.some((q) => q.id === questionId)) changes.added = changes.added.filter((q) => q.id !== questionId);
    else changes.removed.push(questionId);
    saveQuizChanges(packId, changes);
    return withEdits(toJson(r));
  },
  async remove(packId: string) {
    await delay(400);
    const list = load();
    if (!list.some((x) => x.id === packId)) throw Object.assign(new Error("not found"), { status: 404 });
    save(list.filter((x) => x.id !== packId));
    return undefined;
  },
  async setReviewed(packId: string, reviewed: boolean) {
    await delay(400);
    const r = load().find((x) => x.id === packId);
    if (!r) throw Object.assign(new Error("not found"), { status: 404 });
    if (!toJson(r).result) throw Object.assign(new Error("not finished"), { status: 409 });
    const all = loadReviewed();
    if (reviewed) all[packId] ??= new Date().toISOString();
    else delete all[packId];
    try {
      localStorage.setItem(REVIEWED_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
    return withEdits(toJson(r));
  },
  async updateNotes(packId: string, body: { teachingTips: string[] }) {
    await delay(500);
    const r = load().find((x) => x.id === packId);
    if (!r) throw Object.assign(new Error("not found"), { status: 404 });
    const before = (withEdits(toJson(r)).result as { teacher?: Record<string, unknown> } | null)?.teacher ?? {};
    const changed = JSON.stringify(body.teachingTips) !== JSON.stringify(before.teachingTips ?? []);
    savePartEdit(packId, "teacher", { ...body, teacherChecked: true, ...(changed ? { teacherEdited: true } : {}) });
    return withEdits(toJson(r));
  },
  /** Same rules as the API: options must differ, and the answer must be one of them. */
  async updateQuestion(packId: string, questionId: string, body: QuestionEdit) {
    await delay(500);
    const r = load().find((x) => x.id === packId);
    if (!r) throw Object.assign(new Error("not found"), { status: 404 });
    const current = withEdits(toJson(r));
    const questions = (current.result as { quiz?: { questions?: Record<string, unknown>[] } } | null)?.quiz?.questions ?? [];
    const old = questions.find((q) => q.id === questionId);
    if (!old) throw Object.assign(new Error("not found"), { status: 404 });
    const norm = body.options.map((o) => o.trim().toLowerCase());
    if (!body.question.trim() || norm.some((o) => !o) || body.correctIndex >= norm.length) {
      throw Object.assign(new Error("invalid"), { status: 422 });
    }
    if (new Set(norm).size !== norm.length) {
      throw Object.assign(new Error("invalid"), { status: 422, detail: `${questionId}: two options contain the same words` });
    }
    const changed =
      body.question !== old.question ||
      JSON.stringify(body.options) !== JSON.stringify(old.options) ||
      body.correctIndex !== old.correctIndex ||
      body.explanation !== (old.explanation ?? "");
    const all = loadEdits();
    const prev = all[packId]?.[questionId];
    all[packId] = { ...all[packId], [questionId]: { ...body, teacherChecked: true, teacherEdited: changed || !!prev?.teacherEdited } };
    try {
      localStorage.setItem(EDITS_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
    return withEdits(toJson(r));
  },
  async create(body: { topic: string; grade: number; subject?: string; language?: string; force?: boolean }) {
    await delay(600);
    // Same rule as the API: same topic, grade and subject (ignoring case), and not a failed pack.
    const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
    const dup = body.force
      ? undefined
      : load().find(
          (x) =>
            x.grade === body.grade &&
            norm(x.topic) === norm(body.topic) &&
            norm(x.subject) === norm(body.subject) &&
            toJson(x).status !== "failed",
        );
    if (dup) {
      const { id, status, topic, grade, subject, createdAt } = withEdits(toJson(dup)) as Record<string, unknown>;
      throw Object.assign(new Error("duplicate"), {
        status: 409,
        info: { code: "duplicate_pack", existing: { id, status, topic, grade, subject, createdAt } },
      });
    }
    const r: MockRequest = {
      id: crypto.randomUUID(),
      topic: body.topic,
      grade: body.grade,
      subject: body.subject,
      createdAt: new Date().toISOString(),
    };
    save([r, ...load()]);
    return { id: r.id, status: "queued" };
  },
};
