import { config } from "../config";
import { toCreateBody, toCreatedId, toLessonBody, toPack, toPackList, toPackSummary } from "./adapter";
import { ApiError, request } from "./http";
import { mockServer } from "./mockServer";
import { offlineCache, packIndex } from "./offlineCache";
import type { LessonDraft, NewPackRequest, Pack, PackSummary, QuizQuestion } from "./types";

/**
 * Pack API used by the screens. Matches the deployed Lesson Pack API (FastAPI):
 *   POST /lesson-packs            { topic, grade } -> 202 { job_id, ... }
 *   GET  /lesson-packs/{job_id}   -> the pack, including status while it is being written
 * There is no list endpoint yet, so My packs is built from the requests made on this
 * device (packIndex) plus GET per pack. Change paths here if the API changes.
 */
const useMock = config.api.mode === "mock";
const CREATE_PATH = "/lesson-packs";
const packPath = (id: string) => `/lesson-packs/${encodeURIComponent(id)}`;
const questionPath = (packId: string, questionId: string) =>
  `${packPath(packId)}/quiz/questions/${encodeURIComponent(questionId)}`;

async function raw<T>(mock: () => Promise<T>, real: () => Promise<T>): Promise<T> {
  if (!useMock) return real();
  if (!navigator.onLine) throw new ApiError("offline", "No connection");
  try {
    return await mock();
  } catch (e) {
    const status = (e as { status?: number }).status;
    const kind = status === 404 ? "notfound" : status === 422 ? "invalid" : status === 409 ? "conflict" : "server";
    const err = e as { detail?: string; info?: Record<string, unknown> };
    throw new ApiError(kind, String(e), status, err.detail, err.info);
  }
}

export const packsApi = {
  /**
   * Starts a pack. Throws a "conflict" ApiError when the teacher already has one with the same
   * topic, grade and subject (read it with duplicateOf); pass force to make another anyway.
   */
  async create(req: NewPackRequest, { force = false }: { force?: boolean } = {}): Promise<string> {
    const body = toCreateBody(req, force);
    const json = await raw(
      () => mockServer.create({ ...body, language: req.language }),
      // No retry: the API can't de-duplicate, so a retried POST could start two packs.
      () => request<unknown>(CREATE_PATH, { method: "POST", body: JSON.stringify(body), retry: false }),
    );
    const id = toCreatedId(json);
    if (!id) throw new ApiError("server", "No job id in response");
    packIndex.add({ id, topic: req.topic, grade: req.grade, subject: body.subject ?? "", createdAt: new Date().toISOString() });
    return id;
  },

  /** Gets a pack; falls back to the offline copy when there is no connection. */
  async get(id: string): Promise<{ pack: Pack; fromCache: boolean }> {
    try {
      const json = await raw(
        () => mockServer.get(id),
        () => request<unknown>(packPath(id)),
      );
      // The response may omit topic/grade/date; fill them from the original request.
      const pack = toPack(json, { id, ...packIndex.get(id) });
      offlineCache.save(pack);
      return { pack, fromCache: false };
    } catch (e) {
      const cached = offlineCache.get(id);
      if (cached && e instanceof ApiError && e.kind !== "notfound") return { pack: cached, fromCache: true };
      throw e;
    }
  },

  /**
   * Saves the teacher's version of one quiz question and marks it as checked.
   * Sending it unchanged just marks it as checked. Returns the updated pack.
   */
  async updateQuestion(packId: string, q: QuizQuestion): Promise<Pack> {
    const body = questionBody(q);
    const json = await raw(
      () => mockServer.updateQuestion(packId, q.id, body),
      // PUT replaces the same question every time, so a retry is safe.
      () => request<unknown>(questionPath(packId, q.id), { method: "PUT", body: JSON.stringify(body) }),
    );
    return savedPack(packId, json);
  },

  /** Adds the teacher's own question at the end of the quiz. Returns the updated pack. */
  async addQuestion(packId: string, q: QuizQuestion): Promise<Pack> {
    const body = questionBody(q);
    const json = await raw(
      () => mockServer.addQuestion(packId, body),
      // Not retried: a repeated POST would add the question twice.
      () => request<unknown>(`${packPath(packId)}/quiz/questions`, { method: "POST", body: JSON.stringify(body), retry: false }),
    );
    return savedPack(packId, json);
  },

  /** Removes one question (a quiz keeps at least one). Returns the updated pack. */
  async removeQuestion(packId: string, questionId: string): Promise<Pack> {
    const json = await raw(
      () => mockServer.removeQuestion(packId, questionId),
      () => request<unknown>(questionPath(packId, questionId), { method: "DELETE" }),
    );
    return savedPack(packId, json);
  },

  /** Saves the teacher's version of the Lesson tab and marks it as checked. Returns the updated pack. */
  async updateLesson(packId: string, draft: LessonDraft): Promise<Pack> {
    const body = toLessonBody(draft);
    const json = await raw(
      () => mockServer.updateLesson(packId, body),
      () => request<unknown>(`${packPath(packId)}/lesson`, { method: "PUT", body: JSON.stringify(body) }),
    );
    return savedPack(packId, json);
  },

  /** Saves the teacher's notes (teaching tips) and marks them as checked. Returns the updated pack. */
  async updateNotes(packId: string, notes: string[]): Promise<Pack> {
    const body = { teachingTips: notes.map((n) => n.trim()).filter(Boolean) };
    const json = await raw(
      () => mockServer.updateNotes(packId, body),
      () => request<unknown>(`${packPath(packId)}/notes`, { method: "PUT", body: JSON.stringify(body) }),
    );
    return savedPack(packId, json);
  },

  /**
   * Deletes a pack in any status, here and on the server. A pack the server no longer has
   * still counts as deleted, so it also disappears from this device.
   */
  async remove(packId: string): Promise<void> {
    try {
      await raw(
        () => mockServer.remove(packId),
        // DELETE is safe to repeat, so retries are fine.
        () => request<void>(packPath(packId), { method: "DELETE" }),
      );
    } catch (e) {
      if (!(e instanceof ApiError && e.kind === "notfound")) throw e;
    }
    packIndex.remove(packId);
    offlineCache.remove(packId);
  },

  /** The teacher's sign-off: true sets the pack to "Reviewed", false puts back the status it had. */
  async setReviewed(packId: string, reviewed: boolean): Promise<Pack> {
    const json = await raw(
      () => mockServer.setReviewed(packId, reviewed),
      () => request<unknown>(`${packPath(packId)}/review`, { method: "PUT", body: JSON.stringify({ reviewed }) }),
    );
    return savedPack(packId, json);
  },

  /** Lists packs; when offline, lists what is saved on this device. */
  async list(): Promise<{ packs: PackSummary[]; fromCache: boolean }> {
    if (useMock) {
      try {
        return { packs: toPackList(await raw(() => mockServer.list(), () => Promise.resolve(null))), fromCache: false };
      } catch (e) {
        if (e instanceof ApiError && e.kind === "offline") return { packs: offlineList(), fromCache: true };
        throw e;
      }
    }

    const entries = packIndex.all();
    if (!navigator.onLine) return { packs: offlineList(), fromCache: true };

    // Finished packs come from the offline copy; only unfinished ones are re-checked.
    const packs = await Promise.all(
      entries.map(async (entry): Promise<PackSummary> => {
        const cached = offlineCache.get(entry.id);
        // Copies saved before subjects were tracked have no `subject` key; fetch those once more.
        if (cached && cached.status !== "working" && typeof cached.subject === "string") return toSummary(cached);
        try {
          return toPackSummary(await request<unknown>(packPath(entry.id)), entry);
        } catch (e) {
          const err = e instanceof ApiError ? e : null;
          // A job the API no longer knows about is shown as failed rather than hiding it.
          return { ...entry, subject: entry.subject ?? "", status: err?.kind === "notfound" ? "failed" : "working" };
        }
      }),
    );
    return { packs, fromCache: false };
  },
};

/**
 * The existing pack from a "you already have this pack" reply, or null for any other error.
 * It is also added to this device's list, so a pack made on another device shows in My packs.
 */
export function duplicateOf(e: unknown): PackSummary | null {
  if (!(e instanceof ApiError) || e.kind !== "conflict" || e.info?.code !== "duplicate_pack") return null;
  const existing = e.info.existing;
  if (!existing || typeof existing !== "object") return null;
  const summary = toPackSummary(existing);
  if (!summary.id) return null;
  if (!packIndex.get(summary.id)) {
    packIndex.add({ id: summary.id, topic: summary.topic, grade: summary.grade, subject: summary.subject, createdAt: summary.createdAt });
  }
  return summary;
}

function questionBody(q: QuizQuestion) {
  return {
    question: q.prompt.trim(),
    options: q.options.map((o) => o.trim()),
    correctIndex: q.answer,
    explanation: q.explanation?.trim() ?? "",
  };
}

/** Converts an edit's reply and refreshes the offline copy, so the change opens offline too. */
function savedPack(packId: string, json: unknown): Pack {
  const pack = toPack(json, { id: packId, ...packIndex.get(packId) });
  offlineCache.save(pack);
  return pack;
}

function toSummary({ id, topic, grade, subject, status, createdAt, failureKind }: Pack): PackSummary {
  return { id, topic, grade, subject, status, createdAt, failureKind };
}

function offlineList(): PackSummary[] {
  const saved = new Map(offlineCache.list().map((p) => [p.id, p]));
  for (const e of packIndex.all()) if (!saved.has(e.id)) saved.set(e.id, { ...e, subject: e.subject ?? "", status: "working" });
  return [...saved.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
