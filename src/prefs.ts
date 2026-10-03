import type { Grade, UiLanguage } from "./api/types";

/** Small per-device preferences, kept in localStorage. */
const K = {
  lang: "lr.lang",
  grade: "lr.lastGrade",
  subject: "lr.lastSubject",
  recent: "lr.recentTopics",
  size: "lr.textSize",
  theme: "lr.theme",
  notes: "lr.notesChecked",
};

export type TextSize = "small" | "normal" | "large";
/** "system" follows the device's light/dark setting. */
export type Theme = "system" | "light" | "dark";

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* blocked storage: preference lasts for this visit only */
  }
}

export const prefs = {
  language(): UiLanguage {
    const v = get(K.lang);
    if (v === "en" || v === "fil") return v;
    return navigator.language?.toLowerCase().startsWith("fil") || navigator.language?.toLowerCase().startsWith("tl") ? "fil" : "en";
  },
  setLanguage(v: UiLanguage) {
    set(K.lang, v);
  },

  lastGrade(): Grade | null {
    const v = get(K.grade);
    if (v === null || v.trim() === "") return null; // Number("") is 0, which is Kindergarten
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 16 ? (n as Grade) : null;
  },
  setLastGrade(g: Grade) {
    set(K.grade, String(g));
  },

  lastSubject(): string {
    return (get(K.subject) || "").slice(0, 60);
  },
  setLastSubject(s: string) {
    set(K.subject, s.trim().slice(0, 60));
  },

  recentTopics(): string[] {
    try {
      return (JSON.parse(get(K.recent) || "[]") as string[]).slice(0, 4);
    } catch {
      return [];
    }
  },
  addRecentTopic(topic: string) {
    const clean = topic.trim();
    if (!clean) return;
    const list = [clean, ...prefs.recentTopics().filter((t) => t.toLowerCase() !== clean.toLowerCase())];
    set(K.recent, JSON.stringify(list.slice(0, 4)));
  },

  theme(): Theme {
    const v = get(K.theme);
    return v === "light" || v === "dark" ? v : "system";
  },
  setTheme(v: Theme) {
    set(K.theme, v);
  },

  textSize(): TextSize {
    const v = get(K.size);
    return v === "small" || v === "large" ? v : "normal";
  },
  setTextSize(v: TextSize) {
    set(K.size, v);
  },

  notesChecked(packId: string): number[] {
    try {
      const all = JSON.parse(get(K.notes) || "{}") as Record<string, number[]>;
      return all[packId] ?? [];
    } catch {
      return [];
    }
  },
  setNotesChecked(packId: string, checked: number[]) {
    let all: Record<string, number[]> = {};
    try {
      all = JSON.parse(get(K.notes) || "{}");
    } catch {
      /* start fresh */
    }
    all[packId] = checked;
    set(K.notes, JSON.stringify(all));
  },
};
