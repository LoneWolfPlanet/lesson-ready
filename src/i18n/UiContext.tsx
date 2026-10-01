import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UiLanguage } from "../api/types";
import { prefs, type TextSize } from "../prefs";
import { STRINGS, type Strings } from "./strings";

interface UiState {
  lang: UiLanguage;
  t: Strings;
  setLang(l: UiLanguage): void;
  textSize: TextSize;
  setTextSize(s: TextSize): void;
}

const UiContext = createContext<UiState | null>(null);

/** Interface language and reading size, both remembered per device. */
export function UiProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLanguage>(prefs.language);
  const [textSize, setSizeState] = useState<TextSize>(prefs.textSize);

  useEffect(() => {
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.size = textSize;
  }, [textSize]);

  const setLang = useCallback((l: UiLanguage) => {
    prefs.setLanguage(l);
    setLangState(l);
  }, []);
  const setTextSize = useCallback((s: TextSize) => {
    prefs.setTextSize(s);
    setSizeState(s);
  }, []);

  const value = useMemo(
    () => ({ lang, t: STRINGS[lang], setLang, textSize, setTextSize }),
    [lang, setLang, textSize, setTextSize],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside UiProvider");
  return ctx;
}
