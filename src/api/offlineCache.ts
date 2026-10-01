import type { Grade, Pack, PackSummary } from "./types";

/**
 * Keeps every finished pack the teacher has opened, so it opens again with no signal.
 * localStorage is enough for text-only packs (roughly 5-10 KB each).
 */
const KEY = "lr.packs.offline.v1";
const MAX_PACKS = 60;

function readAll(): Record<string, Pack> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, Pack>;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Pack>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: offline copies are a convenience, not required */
  }
}

export const offlineCache = {
  save(pack: Pack) {
    if (pack.status === "working") return;
    const all = readAll();
    all[pack.id] = pack;
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
  list(): PackSummary[] {
    return Object.values(readAll()).map(({ id, topic, grade, status, createdAt }) => ({
      id,
      topic,
      grade,
      status,
      createdAt,
    }));
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

/**
 * The teacher's own pack requests on this device.
 * The Lesson Pack API has no "list my packs" endpoint yet, so My packs is built from
 * this index. Packs requested on another device won't appear until the API adds
 * GET /lesson-packs (see INTEGRATION.md).
 */
export interface IndexEntry {
  id: string;
  topic: string;
  grade: Grade;
  createdAt: string;
}

const INDEX_KEY = "lr.packs.index.v1";

export const packIndex = {
  all(): IndexEntry[] {
    try {
      return (JSON.parse(localStorage.getItem(INDEX_KEY) || "[]") as IndexEntry[]).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    } catch {
      return [];
    }
  },
  get(id: string): IndexEntry | undefined {
    return packIndex.all().find((e) => e.id === id);
  },
  add(entry: IndexEntry) {
    const list = [entry, ...packIndex.all().filter((e) => e.id !== entry.id)].slice(0, 200);
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(INDEX_KEY);
    } catch {
      /* ignore */
    }
  },
};
