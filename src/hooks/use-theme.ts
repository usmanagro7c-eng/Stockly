import { useEffect, useCallback } from "react";
import { useStockStore } from "@/store/stockStore";

export type ThemeMode = "light" | "dark" | "oled";

const STORAGE_KEY = "stockly-theme";

export function applyThemeToDom(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Remove existing theme classes
  root.classList.remove("light", "dark", "oled");

  if (theme === "light") {
    root.classList.add("light");
    updateThemeColor("#f8fafc");
  } else if (theme === "oled") {
    root.classList.add("dark", "oled");
    updateThemeColor("#000000");
  } else {
    root.classList.add("dark");
    updateThemeColor("#1a1f26");
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function updateThemeColor(color: string) {
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

export function useTheme() {
  const storeTheme = useStockStore((s) => s.settings.theme_mode);
  const updateSettings = useStockStore((s) => s.updateSettings);

  const currentTheme: ThemeMode =
    storeTheme ||
    (typeof localStorage !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "dark"
      : "dark");

  useEffect(() => {
    applyThemeToDom(currentTheme);
  }, [currentTheme]);

  const setTheme = useCallback(
    async (mode: ThemeMode) => {
      applyThemeToDom(mode);
      await updateSettings({ theme_mode: mode });
    },
    [updateSettings],
  );

  const cycleTheme = useCallback(async () => {
    const next: ThemeMode =
      currentTheme === "dark" ? "light" : currentTheme === "light" ? "oled" : "dark";
    await setTheme(next);
  }, [currentTheme, setTheme]);

  return {
    theme: currentTheme,
    setTheme,
    cycleTheme,
    isLight: currentTheme === "light",
    isOled: currentTheme === "oled",
    isDark: currentTheme === "dark",
  };
}
