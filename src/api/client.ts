import { config } from "../config";
import { toCreateBody, toCreatedId, toPack, toPackList, toPackSummary } from "./adapter";
import { ApiError, request } from "./http";
import { mockServer } from "./mockServer";
import { offlineCache, packIndex } from "./offlineCache";
import type { NewPackRequest, Pack, PackSummary } from "./types";

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

async function raw<T>(mock: () => Promise<T>, real: () => Promise<T>): Promise<T> {
  if (!useMock) return real();
  if (!navigator.onLine) throw new ApiError("offline", "No connection");
  try {
    return await mock();
  } catch (e) {
    const status = (e as { status?: number }).status;
    throw new ApiError(status === 404 ? "notfound" : "server", String(e), status);
  }
}

export const packsApi = {
  async create(req: NewPackRequest): Promise<string> {
    const body = toCreateBody(req);
    const json = await raw(
      () => mockServer.create({ ...body, language: req.language }),
      // No retry: the API can't de-duplicate, so a retried POST could start two packs.
      () => request<unknown>(CREATE_PATH, { method: "POST", body: JSON.stringify(body), retry: false }),
    );
    const id = toCreatedId(json);
    if (!id) throw new ApiError("server", "No job id in response");
    packIndex.add({ id, topic: req.topic, grade: req.grade, createdAt: new Date().toISOString() });
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
        if (cached && cached.status !== "working") return toSummary(cached);
        try {
          return toPackSummary(await request<unknown>(packPath(entry.id)), entry);
        } catch (e) {
          const err = e instanceof ApiError ? e : null;
          // A job the API no longer knows about is shown as failed rather than hiding it.
          return { ...entry, status: err?.kind === "notfound" ? "failed" : "working" };
        }
      }),
    );
    return { packs, fromCache: false };
  },
};

function toSummary({ id, topic, grade, status, createdAt }: Pack): PackSummary {
  return { id, topic, grade, status, createdAt };
}

function offlineList(): PackSummary[] {
  const saved = new Map(offlineCache.list().map((p) => [p.id, p]));
  for (const e of packIndex.all()) if (!saved.has(e.id)) saved.set(e.id, { ...e, status: "working" });
  return [...saved.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
