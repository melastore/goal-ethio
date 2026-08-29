"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { readText, writeText } from "@/lib/storage";
import { translate, type Language, type TranslationKey } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  t: (key: TranslationKey) => string;
};

const STORAGE_KEY = "goalethio-language";

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // English is what the server renders, so it has to be the initial state; a
  // stored choice is applied after mount.
  const [language, setLanguage] = useState<Language>("en");
  const restored = useRef(false);

  useEffect(() => {
    const stored = readText(STORAGE_KEY);
    if (stored === "en" || stored === "am") setLanguage(stored);
    restored.current = true;
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    // Skip the first pass, or the default overwrites the stored choice before
    // it has been read back.
    if (!restored.current) return;
    writeText(STORAGE_KEY, language);
  }, [language]);

  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage needs a LanguageProvider above it");
  return context;
}
