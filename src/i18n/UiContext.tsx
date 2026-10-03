import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UiLanguage } from "../api/types";
import { prefs, type TextSize, type Theme } from "../prefs";
import { STRINGS, type Strings } from "./strings";

interface UiState {
  lang: UiLanguage;
  t: Strings;
  setLang(l: UiLanguage): void;
  textSize: TextSize;
  setTextSize(s: TextSize): void;
  theme: Theme;
  setTheme(t: Theme): void;
}

const UiContext = createContext<UiState | null>(null);

/** Interface language and reading size, both remembered per device. */
export function UiProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLanguage>(prefs.language);
  const [textSize, setSizeState] = useState<TextSize>(prefs.textSize);
  const [theme, setThemeState] = useState<Theme>(prefs.theme);

  useEffect(() => {
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.size = textSize;
  }, [textSize]);
  useEffect(() => {
    // "system" removes the attribute so the CSS media query decides.
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    syncThemeColor();
  }, [theme]);
  useEffect(() => {
    // Keep the phone's status bar colour in step when the device switches light/dark.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", syncThemeColor);
    return () => mq?.removeEventListener?.("change", syncThemeColor);
  }, []);

  const setLang = useCallback((l: UiLanguage) => {
    prefs.setLanguage(l);
    setLangState(l);
  }, []);
  const setTextSize = useCallback((s: TextSize) => {
    prefs.setTextSize(s);
    setSizeState(s);
  }, []);
  const setTheme = useCallback((t: Theme) => {
    prefs.setTheme(t);
    setThemeState(t);
  }, []);

  const value = useMemo(
    () => ({ lang, t: STRINGS[lang], setLang, textSize, setTextSize, theme, setTheme }),
    [lang, setLang, textSize, setTextSize, theme, setTheme],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

/** Browser/status-bar colour: the app background in dark mode, the brand teal in light. */
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const isDark =
    document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  meta.setAttribute("content", isDark ? "#121816" : "#1f6f5c");
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside UiProvider");
  return ctx;
}
