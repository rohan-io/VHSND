import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";
import { darkTheme, lightTheme, type Theme } from "@/src/constants/theme";

export type ThemeMode = "light" | "dark" | "system";
const THEME_MODE_KEY = "theme_mode_preference";

// Web-only QA override: `?theme=dark` / `?theme=light` on the initial URL forces
// a scheme so both palettes can be screenshotted without touching the toggle or
// the OS. Captured once at load so it survives client-side navigation. It wins
// over the stored preference on purpose — it is a test seam, not user intent.
const urlSchemeOverride: "light" | "dark" | null = (() => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("theme");
  return v === "dark" || v === "light" ? v : null;
})();

interface ThemeControls {
  /** user preference: "system" defers to the OS scheme */
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<Theme>(lightTheme);
const ThemeModeContext = createContext<ThemeControls>({
  mode: "system",
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const osScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  // Load the persisted preference. Starts on "system" so anyone who never
  // touches the toggle keeps the exact OS-driven behavior.
  useEffect(() => {
    storage.getItem<ThemeMode>(THEME_MODE_KEY, "system").then((v) => {
      if (v === "light" || v === "dark" || v === "system") setModeState(v);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.setItem(THEME_MODE_KEY, m);
  }, []);

  const scheme =
    urlSchemeOverride ?? (mode === "system" ? osScheme ?? "light" : mode);

  const theme = useMemo(
    () => (scheme === "dark" ? darkTheme : lightTheme),
    [scheme],
  );
  const controls = useMemo<ThemeControls>(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ThemeModeContext.Provider value={controls}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </ThemeModeContext.Provider>
  );
}

export const useTheme = (): Theme => useContext(ThemeContext);
export const useThemeMode = (): ThemeControls => useContext(ThemeModeContext);
