import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";
import { STRINGS, type Lang, type Translations } from "@/src/i18n/strings";

const LANG_KEY = "language_preference";

// Web-only QA override: `?lang=or` / `?lang=en` on the initial URL forces a
// language so both can be screenshotted without touching the toggle. Same test
// seam as the theme override in ThemeContext.
const urlLangOverride: Lang | null = (() => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("lang");
  return v === "or" || v === "en" ? v : null;
})();

// Collapse the { en, or } dictionary to plain strings for the active language.
function resolve(lang: Lang): Translations {
  const out: any = {};
  for (const group of Object.keys(STRINGS) as (keyof typeof STRINGS)[]) {
    out[group] = {};
    const g = STRINGS[group] as Record<string, { en: string; or: string }>;
    for (const key of Object.keys(g)) {
      out[group][key] = g[key][lang] ?? g[key].en;
    }
  }
  return out as Translations;
}

interface LanguageControls {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const TranslationContext = createContext<Translations>(resolve("en"));
const LanguageControlsContext = createContext<LanguageControls>({
  lang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Load persisted preference. Defaults to English for anyone who never toggles.
  useEffect(() => {
    storage.getItem<Lang>(LANG_KEY, "en").then((v) => {
      if (v === "en" || v === "or") setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem(LANG_KEY, l);
  }, []);

  const active = urlLangOverride ?? lang;
  const t = useMemo(() => resolve(active), [active]);
  const controls = useMemo<LanguageControls>(
    () => ({ lang: active, setLang }),
    [active, setLang],
  );

  return (
    <LanguageControlsContext.Provider value={controls}>
      <TranslationContext.Provider value={t}>{children}</TranslationContext.Provider>
    </LanguageControlsContext.Provider>
  );
}

/** Resolved strings for the active language: `const t = useTranslation(); t.nav.home` */
export const useTranslation = (): Translations => useContext(TranslationContext);
export const useLanguage = (): LanguageControls => useContext(LanguageControlsContext);
