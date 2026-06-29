import { useState, useEffect } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ActiveTheme = "light" | "dark";

export interface UseSystemThemeReturn {
  themePreference: ThemePreference;
  activeTheme: ActiveTheme;
  setThemePreference: (pref: ThemePreference) => void;
}

export function useSystemTheme(): UseSystemThemeReturn {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("service_mgt_theme_pref");
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    }
    return "system";
  });

  const [activeTheme, setActiveTheme] = useState<ActiveTheme>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  // Calculate the active theme based on preference and system theme
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = window.document.documentElement;

    const determineActiveTheme = (): ActiveTheme => {
      if (themePreference === "light") return "light";
      if (themePreference === "dark") return "dark";
      
      // If "system", check system preferences
      if (window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return "light";
    };

    const active = determineActiveTheme();
    setActiveTheme(active);

    // Apply the class to documentElement
    if (active === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Listener for system preferences if set to "system"
    if (themePreference === "system" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        const resolved = e.matches ? "dark" : "light";
        setActiveTheme(resolved);
        if (resolved === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }
  }, [themePreference]);

  const setThemePreference = (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    if (typeof window !== "undefined") {
      localStorage.setItem("service_mgt_theme_pref", pref);
    }
  };

  return {
    themePreference,
    activeTheme,
    setThemePreference,
  };
}
