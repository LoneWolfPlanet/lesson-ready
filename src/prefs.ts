import { MAX_GRADE, MIN_GRADE, type Grade, type UiLanguage } from "./api/types";
import { readJson, readText as get, writeJson, writeText as set } from "./storage";

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
    return Number.isInteger(n) && n >= MIN_GRADE && n <= MAX_GRADE ? (n as Grade) : null;
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
    return readJson<string[]>(K.recent, []).slice(0, 4);
  },
  addRecentTopic(topic: string) {
    const clean = topic.trim();
    if (!clean) return;
    const list = [clean, ...prefs.recentTopics().filter((t) => t.toLowerCase() !== clean.toLowerCase())];
    writeJson(K.recent, list.slice(0, 4));
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
    return readJson<Record<string, number[]>>(K.notes, {})[packId] ?? [];
  },
  setNotesChecked(packId: string, checked: number[]) {
    const { [packId]: _old, ...rest } = readJson<Record<string, number[]>>(K.notes, {});
    // An empty list is removed rather than stored, so removed packs leave nothing behind.
    writeJson(K.notes, checked.length ? { ...rest, [packId]: checked } : rest);
  },
};
