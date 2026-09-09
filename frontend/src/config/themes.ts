/**
 * =============================================================================
 * Module: frontend/src/config/themes.ts
 * Purpose: Single source of truth for Tellery's VS Code-style multi-theme system,
 *          including 8 Stitch design system palettes (Matcha, Solar Flare, Tuscan,
 *          Tokyo, Abyss, Amethyst, Vapor Lime, Sakura) and 2 built-in themes (Obsidian, Light).
 * Used by: frontend/src/App.tsx, frontend/src/components/SettingsModal.tsx,
 *          frontend/src/components/Header.tsx, frontend/src/components/ui/CommandPalette.tsx
 * Dependencies: None (Pure TypeScript configuration & DOM sync utilities)
 * Public Members: ThemeId, ThemeMeta, THEMES, getThemeById, getSavedTheme, applyTheme
 * Side Effects: Reads and writes localStorage ("telegallery_theme"), sets data-theme attribute
 *               and toggles "dark"/"light" classes on document.documentElement.
 * =============================================================================
 */

export type ThemeId =
  | "obsidian"
  | "light"
  | "matcha"
  | "solar-flare"
  | "tuscan"
  | "tokyo"
  | "abyss"
  | "amethyst"
  | "vapor-lime"
  | "sakura";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  mode: "dark" | "light";
  description: string;
  primaryHex: string;
  accentHex: string;
  bgHex: string;
  surfaceHex: string;
  badge?: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    mode: "dark",
    description: "Pure pitch-black OLED canvas with electric periwinkle accents",
    primaryHex: "#818cf8",
    accentHex: "#a5b4fc",
    bgHex: "#000000",
    surfaceHex: "#141414",
    badge: "Default",
  },
  {
    id: "light",
    name: "Light",
    mode: "light",
    description: "Crisp daylight studio with modern indigo accents",
    primaryHex: "#6366f1",
    accentHex: "#818cf8",
    bgHex: "#f4f6fa",
    surfaceHex: "#eceff6",
  },
  {
    id: "matcha",
    name: "Matcha",
    mode: "light",
    description: "Zen organic matcha green with warm milk-tea cream",
    primaryHex: "#4a5c43",
    accentHex: "#9a442d",
    bgHex: "#fdf9f3",
    surfaceHex: "#f1ede7",
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    mode: "dark",
    description: "Deep volcanic graphite with incandescent solar flare orange",
    primaryHex: "#ff5722",
    accentHex: "#ffb5a0",
    bgHex: "#131315",
    surfaceHex: "#201f21",
  },
  {
    id: "tuscan",
    name: "Tuscan",
    mode: "light",
    description: "Sun-baked terracotta with golden amber and warm parchment",
    primaryHex: "#9c4126",
    accentHex: "#fea619",
    bgHex: "#fdf9f3",
    surfaceHex: "#f1ede7",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    mode: "dark",
    description: "Nocturnal cyber-black with hot neon pink and cyan telemetry",
    primaryHex: "#ff4a8d",
    accentHex: "#00eefc",
    bgHex: "#131318",
    surfaceHex: "#1f1f25",
  },
  {
    id: "abyss",
    name: "Abyss",
    mode: "dark",
    description: "Deep oceanic midnight with luminous bioluminescent aqua",
    primaryHex: "#00f5d4",
    accentHex: "#d7fff3",
    bgHex: "#091422",
    surfaceHex: "#16202f",
  },
  {
    id: "amethyst",
    name: "Amethyst",
    mode: "dark",
    description: "Ethereal violet shadows with radiant amethyst glow",
    primaryHex: "#c084fc",
    accentHex: "#ddb8ff",
    bgHex: "#14121b",
    surfaceHex: "#211e28",
  },
  {
    id: "vapor-lime",
    name: "Vapor Lime",
    mode: "dark",
    description: "Jet pitch-black with high-voltage radioactive laser lime",
    primaryHex: "#a3e635",
    accentHex: "#ccff80",
    bgHex: "#131315",
    surfaceHex: "#201f21",
  },
  {
    id: "sakura",
    name: "Sakura",
    mode: "dark",
    description: "Velvet plum darkness with glowing cherry blossom neon",
    primaryHex: "#ff4c85",
    accentHex: "#ffb1c1",
    bgHex: "#17111a",
    surfaceHex: "#231e26",
  },
];

const THEME_MAP = new Map<ThemeId, ThemeMeta>(
  THEMES.map((theme) => [theme.id, theme])
);

export function getThemeById(id: string): ThemeMeta {
  return THEME_MAP.get(id as ThemeId) || THEMES[0];
}

export function getSavedTheme(): ThemeId {
  if (typeof window === "undefined") return "obsidian";
  try {
    const saved = localStorage.getItem("telegallery_theme");
    if (!saved) return "obsidian";
    // Legacy support: map "dark" -> "obsidian", "light" -> "light"
    if (saved === "dark") return "obsidian";
    if (saved === "light") return "light";
    if (THEME_MAP.has(saved as ThemeId)) {
      return saved as ThemeId;
    }
  } catch {
    // Ignore storage errors
  }
  return "obsidian";
}

export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  const theme = getThemeById(id);
  const root = document.documentElement;

  // Set data-theme attribute
  root.setAttribute("data-theme", theme.id);

  // Sync Tailwind darkMode class
  if (theme.mode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }

  // Persist to localStorage
  try {
    localStorage.setItem("telegallery_theme", theme.id);
  } catch {
    // Ignore storage errors
  }
}
