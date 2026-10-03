/**
 * The shapes the SCREENS use. They are deliberately independent of the backend's JSON:
 * src/api/adapter.ts converts the API response into these, so a schema change on the
 * server means editing the adapter, not the screens.
 */

/**
 * Learner level as one number, so the API and agents keep a single "grade" field:
 *   0 = Kindergarten, 1-12 = Grade 1-12, 13-16 = College 1st-4th year.
 * Show it with t.gradeN(g), never as a raw number.
 */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
export const MIN_GRADE = 0;
export const MAX_GRADE = 16;
/** Shown as tiles on the New screen. */
export const GRADES: Grade[] = [1, 2, 3, 4, 5, 6];
/** Picked from "Other level" on the New screen, grouped. */
export const OTHER_LEVELS: { group: "kinder" | "jhs" | "shs" | "college"; grades: Grade[] }[] = [
  { group: "kinder", grades: [0] },
  { group: "jhs", grades: [7, 8, 9, 10] },
  { group: "shs", grades: [11, 12] },
  { group: "college", grades: [13, 14, 15, 16] },
];
export const OTHER_GRADES: Grade[] = OTHER_LEVELS.flatMap((l) => l.grades);

export type UiLanguage = "en" | "fil";

/** Plain-language status. Internal backend states never reach the UI. */
export type PackStatus =
  | "working" // still being written or checked
  | "ready" // passed review: "Ready to use"
  | "check" // review raised issues: "Check before use"
  | "failed"; // generation could not finish

/** Which step the generator is on, for the "Writing your lesson" card. */
export type WorkStage = "planning" | "writing" | "checking" | "done";

export interface LessonSection {
  title: string;
  body: string;
}

export interface VocabularyItem {
  term: string;
  definition: string;
}

export interface Activity {
  title: string;
  materials: string[];
  steps: string[];
}

export interface QuizQuestion {
  prompt: string;
  options: string[];
  /** Index into options. */
  answer: number;
  explanation?: string;
}

/** Something the reviewer wants the teacher to look at. */
export interface ReviewIssue {
  section: "lesson" | "quiz" | "notes";
  /** Question number (0-based) when section is "quiz". */
  index?: number;
  message: string;
}

export interface PackSummary {
  id: string;
  topic: string;
  grade: Grade;
  status: PackStatus;
  createdAt: string; // ISO
  /** Set on failed packs: "unavailable" = topic not in the curriculum library. */
  failureKind?: "unavailable" | "error";
}

export interface Pack extends PackSummary {
  stage: WorkStage;
  /** Short summary for the teacher (teacher.teacherOverview). */
  overview?: string;
  objectives: string[];
  sections: LessonSection[];
  vocabulary: VocabularyItem[];
  activity?: Activity;
  quiz: QuizQuestion[];
  /** Teaching tips, shown as the Notes checklist. */
  notes: string[];
  /** Set when the pack passed review. */
  reviewed: boolean;
  issues: ReviewIssue[];
  /** Plain-language reason, only when status is "failed". */
  failureReason?: string;
  /**
   * Why it failed: "unavailable" means the topic isn't in the curriculum library
   * (grounding found nothing), so the teacher should pick another topic, not retry.
   */
  failureKind?: "unavailable" | "error";
}

export interface NewPackRequest {
  topic: string;
  grade: Grade;
  /** Language of the lesson content (not just the UI). */
  language: UiLanguage;
  /** Optional. A suggested subject or anything the teacher typed. */
  subject?: string;
}
