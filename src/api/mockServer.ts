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
    { id: "demo-photosynthesis", topic: "Photosynthesis", grade: 4, createdAt: new Date(Date.now() - day).toISOString() },
    { id: "demo-fractions", topic: "Adding fractions", grade: 3, createdAt: new Date(Date.now() - 3 * day).toISOString() },
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
  const base = { id: r.id, topic: r.topic, grade: r.grade, createdAt: r.createdAt, updatedAt: new Date().toISOString() };
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
    return toJson(r);
  },
  async create(body: { topic: string; grade: number; language?: string }) {
    await delay(600);
    const r: MockRequest = { id: crypto.randomUUID(), topic: body.topic, grade: body.grade, createdAt: new Date().toISOString() };
    save([r, ...load()]);
    return { id: r.id, status: "queued" };
  },
};
