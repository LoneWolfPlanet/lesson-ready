import { readJson, removeKey, writeJson } from "../storage";
import type { Grade, Pack, PackSummary } from "./types";

/**
 * Keeps every finished pack the teacher has opened, so it opens again with no signal.
 * localStorage is enough for text-only packs (roughly 5-10 KB each).
 *
 * Both stores are parsed once and kept in memory: My packs asks about every row on every
 * render, and re-parsing up to 60 packs each time is what made long lists slow.
 */
const KEY = "lr.packs.offline.v1";
const INDEX_KEY = "lr.packs.index.v1";
const MAX_PACKS = 60;
const MAX_INDEX = 200;

let packs: Record<string, Pack> | null = null;
let index: IndexEntry[] | null = null;

// Another tab changed storage (or cleared it): read it again next time.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === KEY) packs = null;
    if (e.key === null || e.key === INDEX_KEY) index = null;
  });
}

const readAll = () => (packs ??= readJson<Record<string, Pack>>(KEY, {}));
function writeAll(all: Record<string, Pack>) {
  packs = all;
  writeJson(KEY, all);
}

export const offlineCache = {
  save(pack: Pack) {
    if (pack.status === "working") return;
    const all = { ...readAll(), [pack.id]: pack };
    const ids = Object.keys(all).sort((a, b) => all[b].createdAt.localeCompare(all[a].createdAt));
    for (const id of ids.slice(MAX_PACKS)) delete all[id];
    writeAll(all);
  },
  get(id: string): Pack | undefined {
    return readAll()[id];
  },
  has(id: string): boolean {
    return id in readAll();
  },
  remove(id: string) {
    const { [id]: _gone, ...rest } = readAll();
    writeAll(rest);
  },
  list(): PackSummary[] {
    return Object.values(readAll()).map(({ id, topic, grade, subject, status, createdAt }) => ({
      id,
      topic,
      grade,
      subject: subject ?? "",
      status,
      createdAt,
    }));
  },
  clear() {
    packs = null;
    removeKey(KEY);
  },
};

/**
 * The teacher's own pack requests on this device, newest first.
 * The Lesson Pack API has no "list my packs" endpoint yet, so My packs is built from
 * this index. Packs requested on another device appear once they are opened here
 * (or found by the duplicate check).
 */
export interface IndexEntry {
  id: string;
  topic: string;
  grade: Grade;
  subject?: string;
  createdAt: string;
}

function readIndex(): IndexEntry[] {
  return (index ??= readJson<IndexEntry[]>(INDEX_KEY, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}
function writeIndex(list: IndexEntry[]) {
  index = list;
  writeJson(INDEX_KEY, list);
}

export const packIndex = {
  all(): IndexEntry[] {
    return [...readIndex()];
  },
  get(id: string): IndexEntry | undefined {
    return readIndex().find((e) => e.id === id);
  },
  remove(id: string) {
    writeIndex(readIndex().filter((e) => e.id !== id));
  },
  add(entry: IndexEntry) {
    const list = [entry, ...readIndex().filter((e) => e.id !== entry.id)]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_INDEX);
    writeIndex(list);
  },
  clear() {
    index = null;
    removeKey(INDEX_KEY);
  },
};
