/**
 * 作品墙自由画布 · 页面主题
 *
 * 只放行预设底色 + 校验过的强调色，不接受任意 CSS——公开页会渲染这些值。
 */

export const SPACE_THEME_PRESETS = [
  "light",
  "paper",
  "warm",
  "cool",
  "dark",
] as const;

export type SpaceThemePreset = (typeof SPACE_THEME_PRESETS)[number];

export type SpacePageTheme = {
  preset: SpaceThemePreset;
  /** #rrggbb */
  accent: string;
};

export const SPACE_THEME_DEFAULT: SpacePageTheme = {
  preset: "light",
  accent: "#0969da",
};

export type SpaceThemeTokens = {
  label: string;
  /** 画布背景 */
  canvasBg: string;
  /** 卡片底色 */
  cardBg: string;
  border: string;
  text: string;
  mutedText: string;
};

export const SPACE_THEME_TOKENS: Record<SpaceThemePreset, SpaceThemeTokens> = {
  light: {
    label: "素白",
    canvasBg: "#ffffff",
    cardBg: "#ffffff",
    border: "#d0d7de",
    text: "#1f2328",
    mutedText: "#656d76",
  },
  paper: {
    label: "纸白",
    canvasBg: "#f6f8fa",
    cardBg: "#ffffff",
    border: "#d0d7de",
    text: "#1f2328",
    mutedText: "#656d76",
  },
  warm: {
    label: "暖沙",
    canvasBg: "#fdf8f3",
    cardBg: "#fffdfb",
    border: "#e6d9c9",
    text: "#2b2117",
    mutedText: "#7a6a58",
  },
  cool: {
    label: "冷雾",
    canvasBg: "#f4f7fb",
    cardBg: "#ffffff",
    border: "#d3dceb",
    text: "#1b2430",
    mutedText: "#5d6b7d",
  },
  dark: {
    label: "夜幕",
    canvasBg: "#0d1117",
    cardBg: "#161b22",
    border: "#30363d",
    text: "#e6edf3",
    mutedText: "#8b949e",
  },
};

export function parseSpacePageTheme(raw: unknown): SpacePageTheme {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const preset =
    typeof o.preset === "string" &&
    (SPACE_THEME_PRESETS as readonly string[]).includes(o.preset)
      ? (o.preset as SpaceThemePreset)
      : SPACE_THEME_DEFAULT.preset;
  const accent =
    typeof o.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(o.accent)
      ? o.accent
      : SPACE_THEME_DEFAULT.accent;
  return { preset, accent };
}
