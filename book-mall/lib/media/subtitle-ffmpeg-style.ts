import { execFileSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join } from "path";

import {
  SUBTITLE_ASS_FONT_SIZE,
  type SubtitleBurnInStyle,
  type SubtitleFontKey,
  type SubtitleSizeKey,
  normalizeSubtitleBurnInStyle,
} from "@private/media-render-subtitle-style/subtitle-style-options";

/**
 * ffmpeg `subtitles`（libass）默认 FontName=Arial。
 * Arial 本身能加载成功，但没有中文 glyph，libass 往往 **不会** 回退到系统 CJK 字体，
 * 烧录结果是一排空心方框（tofu）。必须显式指定带 CJK 的 FontName，并给出 fontsdir。
 */
export const SUBTITLE_CJK_FONT_MISSING_MESSAGE =
  "烧录中文字幕缺少 CJK 字体（ffmpeg 默认 Arial 会显示方框）。macOS 需系统黑体/冬青黑体；Linux / Docker 请安装 fonts-wqy-microhei。";

export type ResolvedSubtitleFont = {
  fontName: string;
  fontFile: string;
  fontsDir: string;
};

export type ResolveSubtitleFontOptions = {
  exists?: (path: string) => boolean;
  home?: string;
  /** 默认：未注入 exists 时尝试 fc-list */
  tryFontconfig?: boolean;
};

/** path → libass FontName（须与字体内部 family 一致） */
export const SUBTITLE_CJK_FONT_CANDIDATES: ReadonlyArray<{
  path: string;
  fontName: string;
}> = [
  // Debian / book-mall Docker（fonts-wqy-microhei）
  {
    path: "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    fontName: "WenQuanYi Micro Hei",
  },
  {
    path: "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    fontName: "WenQuanYi Zen Hei",
  },
  {
    path: "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    fontName: "Noto Sans CJK SC",
  },
  {
    path: "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    fontName: "Noto Sans CJK SC",
  },
  {
    path: "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    fontName: "Droid Sans Fallback",
  },
  {
    path: "/usr/share/fonts/truetype/arphic/uming.ttc",
    fontName: "AR PL UMing CN",
  },
  // macOS 系统
  { path: "/System/Library/Fonts/STHeiti Medium.ttc", fontName: "Heiti SC" },
  { path: "/System/Library/Fonts/STHeiti Light.ttc", fontName: "Heiti SC" },
  {
    path: "/System/Library/Fonts/Hiragino Sans GB.ttc",
    fontName: "Hiragino Sans GB",
  },
  { path: "/System/Library/Fonts/PingFang.ttc", fontName: "PingFang SC" },
  {
    path: "/System/Library/Fonts/Supplemental/PingFang.ttc",
    fontName: "PingFang SC",
  },
  {
    path: "/System/Library/Fonts/Supplemental/Songti.ttc",
    fontName: "Songti SC",
  },
  { path: "/Library/Fonts/SimHei.ttf", fontName: "SimHei" },
  { path: "/Library/Fonts/Arial Unicode.ttf", fontName: "Arial Unicode MS" },
  {
    path: "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    fontName: "Arial Unicode MS",
  },
];

const FONT_KEY_CANDIDATE_PATHS: Record<
  SubtitleFontKey,
  ReadonlyArray<{ path: string; fontName: string }>
> = {
  heiti: [
    {
      path: "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
      fontName: "WenQuanYi Micro Hei",
    },
    {
      path: "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
      fontName: "WenQuanYi Zen Hei",
    },
    { path: "/System/Library/Fonts/STHeiti Medium.ttc", fontName: "Heiti SC" },
    { path: "/System/Library/Fonts/STHeiti Light.ttc", fontName: "Heiti SC" },
    {
      path: "/System/Library/Fonts/Hiragino Sans GB.ttc",
      fontName: "Hiragino Sans GB",
    },
    { path: "/System/Library/Fonts/PingFang.ttc", fontName: "PingFang SC" },
    {
      path: "/System/Library/Fonts/Supplemental/PingFang.ttc",
      fontName: "PingFang SC",
    },
    { path: "/Library/Fonts/SimHei.ttf", fontName: "SimHei" },
  ],
  songti: [
    {
      path: "/usr/share/fonts/truetype/arphic/uming.ttc",
      fontName: "AR PL UMing CN",
    },
    {
      path: "/System/Library/Fonts/Supplemental/Songti.ttc",
      fontName: "Songti SC",
    },
    { path: "/Library/Fonts/SimSun.ttf", fontName: "SimSun" },
  ],
  noto: [
    {
      path: "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
      fontName: "Noto Sans CJK SC",
    },
    {
      path: "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
      fontName: "Noto Sans CJK SC",
    },
  ],
};

const USER_FONT_RELATIVE: ReadonlyArray<{ rel: string; fontName: string }> = [
  { rel: "Library/Fonts/NotoSansSC.ttf", fontName: "Noto Sans SC" },
  { rel: "Library/Fonts/NotoSansCJK-Regular.ttc", fontName: "Noto Sans CJK SC" },
  { rel: ".local/share/fonts/NotoSansSC.ttf", fontName: "Noto Sans SC" },
  {
    rel: ".local/share/fonts/wqy-microhei.ttc",
    fontName: "WenQuanYi Micro Hei",
  },
];

const FONT_KEY_USER_RELATIVE: Record<
  SubtitleFontKey,
  ReadonlyArray<{ rel: string; fontName: string }>
> = {
  heiti: [
    {
      rel: ".local/share/fonts/wqy-microhei.ttc",
      fontName: "WenQuanYi Micro Hei",
    },
  ],
  songti: [],
  noto: [
    { rel: "Library/Fonts/NotoSansSC.ttf", fontName: "Noto Sans SC" },
    {
      rel: "Library/Fonts/NotoSansCJK-Regular.ttc",
      fontName: "Noto Sans CJK SC",
    },
    { rel: ".local/share/fonts/NotoSansSC.ttf", fontName: "Noto Sans SC" },
  ],
};

const FONTCONFIG_SKIP = /LastResort|GB18030 Bitmap|Interface/i;

let cachedFont: ResolvedSubtitleFont | null = null;

export function resetSubtitleBurnInFontCache(): void {
  cachedFont = null;
}

export function escapeFfmpegSubtitlesPath(filePath: string): string {
  return filePath
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "'\\''");
}

/** 系统字体根目录含大量无关 TTC（如 Emoji），不宜整目录交给 libass fontsdir */
export function shouldIsolateSubtitleFontsDir(fontsDir: string): boolean {
  const normalized = fontsDir.replace(/\/$/, "");
  return (
    normalized === "/System/Library/Fonts" ||
    normalized === "/System/Library/Fonts/Supplemental" ||
    normalized === "/Library/Fonts" ||
    normalized === "/usr/share/fonts" ||
    normalized === "/usr/share/fonts/truetype" ||
    normalized === "/usr/share/fonts/opentype"
  );
}

/** 把选定字体链到临时目录，避免 fontsdir 扫整盘系统字体。 */
export function isolateSubtitleFontsDir(font: ResolvedSubtitleFont): string {
  if (!shouldIsolateSubtitleFontsDir(font.fontsDir)) return font.fontsDir;
  const dir = join(tmpdir(), "book-mall-subtitle-cjk-fonts");
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, basename(font.fontFile));
  if (!existsSync(dest)) {
    try {
      symlinkSync(font.fontFile, dest);
    } catch {
      copyFileSync(font.fontFile, dest);
    }
  }
  return dir;
}

function fileExists(
  path: string,
  exists: ((p: string) => boolean) | undefined,
): boolean {
  return exists ? exists(path) : existsSync(path);
}

function pickFromCandidates(
  exists: ((p: string) => boolean) | undefined,
  home: string,
): ResolvedSubtitleFont | null {
  for (const c of SUBTITLE_CJK_FONT_CANDIDATES) {
    if (fileExists(c.path, exists)) {
      return {
        fontName: c.fontName,
        fontFile: c.path,
        fontsDir: dirname(c.path),
      };
    }
  }
  if (home) {
    for (const c of USER_FONT_RELATIVE) {
      const path = join(home, c.rel);
      if (fileExists(path, exists)) {
        return { fontName: c.fontName, fontFile: path, fontsDir: dirname(path) };
      }
    }
  }
  return null;
}

function pickFromFontKeyCandidates(
  fontKey: SubtitleFontKey,
  exists: ((p: string) => boolean) | undefined,
  home: string,
): ResolvedSubtitleFont | null {
  for (const c of FONT_KEY_CANDIDATE_PATHS[fontKey]) {
    if (fileExists(c.path, exists)) {
      return {
        fontName: c.fontName,
        fontFile: c.path,
        fontsDir: dirname(c.path),
      };
    }
  }
  if (home) {
    for (const c of FONT_KEY_USER_RELATIVE[fontKey]) {
      const path = join(home, c.rel);
      if (fileExists(path, exists)) {
        return { fontName: c.fontName, fontFile: path, fontsDir: dirname(path) };
      }
    }
  }
  return null;
}

function resolveViaFontconfig(): ResolvedSubtitleFont | null {
  try {
    const out = execFileSync("fc-list", [":lang=zh", "file", "family"], {
      encoding: "utf8",
      timeout: 4000,
    });
    for (const raw of out.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const sep = line.indexOf(": ");
      if (sep < 0) continue;
      const fontFile = line.slice(0, sep).trim();
      const families = line.slice(sep + 2).trim();
      if (!fontFile || !families || FONTCONFIG_SKIP.test(families)) continue;
      if (!existsSync(fontFile)) continue;
      const fontName = families.split(",")[0]?.trim();
      if (!fontName) continue;
      return { fontName, fontFile, fontsDir: dirname(fontFile) };
    }
  } catch {
    // 无 fontconfig / fc-list 失败时走候选路径
  }
  return null;
}

export function resolveSubtitleBurnInFont(
  opts?: ResolveSubtitleFontOptions,
): ResolvedSubtitleFont {
  const useCache = !opts;
  if (useCache && cachedFont) return cachedFont;

  const exists = opts?.exists;
  const home = opts?.home ?? process.env.HOME ?? "";
  const tryFc = opts?.tryFontconfig ?? !opts?.exists;

  const found =
    pickFromCandidates(exists, home) ?? (tryFc ? resolveViaFontconfig() : null);
  if (!found) {
    throw new Error(SUBTITLE_CJK_FONT_MISSING_MESSAGE);
  }
  if (useCache) cachedFont = found;
  return found;
}

/** 按用户 fontKey 解析字体；不可用则回退黑体并打日志，不失败任务。 */
export function resolveSubtitleFontByKey(
  fontKey: SubtitleFontKey,
  opts?: ResolveSubtitleFontOptions,
): ResolvedSubtitleFont {
  const exists = opts?.exists;
  const home = opts?.home ?? process.env.HOME ?? "";
  const tryFc = opts?.tryFontconfig ?? !opts?.exists;

  const found = pickFromFontKeyCandidates(fontKey, exists, home);
  if (found) return found;

  if (fontKey !== "heiti") {
    console.info(
      `[media-render] 字幕字体 ${fontKey} 不可用，回退黑体（heiti）`,
    );
    return resolveSubtitleFontByKey("heiti", opts);
  }

  const fallback =
    pickFromCandidates(exists, home) ?? (tryFc ? resolveViaFontconfig() : null);
  if (!fallback) {
    throw new Error(SUBTITLE_CJK_FONT_MISSING_MESSAGE);
  }
  return fallback;
}

export type SubtitleForceStyleOverrides = {
  MarginV?: number;
  fontKey?: SubtitleFontKey;
  sizeKey?: SubtitleSizeKey;
};

export function buildSubtitleBurnInFilterOverrides(
  style?: Partial<SubtitleBurnInStyle> | null,
  extra?: Pick<SubtitleForceStyleOverrides, "MarginV">,
): SubtitleForceStyleOverrides {
  const normalized = normalizeSubtitleBurnInStyle(style);
  return {
    fontKey: normalized.fontKey,
    sizeKey: normalized.sizeKey,
    ...extra,
  };
}

/** 可直接作为 `-vf` 或 filter_complex 里的 `subtitles=…` 表达式 */
export function buildSubtitlesFilterExpr(
  srtPath: string,
  overrides?: SubtitleForceStyleOverrides & {
    font?: ResolvedSubtitleFont;
    /** 默认：未注入 font 时隔离系统字体根目录 */
    isolateFontsDir?: boolean;
  },
): string {
  const style = normalizeSubtitleBurnInStyle({
    fontKey: overrides?.fontKey,
    sizeKey: overrides?.sizeKey,
  });
  const font =
    overrides?.font ??
    resolveSubtitleFontByKey(style.fontKey, {
      tryFontconfig: style.fontKey === "heiti",
    });
  const isolate = overrides?.isolateFontsDir ?? !overrides?.font;
  const fontsDir = isolate ? isolateSubtitleFontsDir(font) : font.fontsDir;
  const fontSize = SUBTITLE_ASS_FONT_SIZE[style.sizeKey];
  const forceStyle = [
    `FontName=${font.fontName}`,
    `FontSize=${fontSize}`,
    overrides?.MarginV != null ? `MarginV=${overrides.MarginV}` : null,
  ]
    .filter(Boolean)
    .join(",");
  return [
    `subtitles='${escapeFfmpegSubtitlesPath(srtPath)}'`,
    "charenc=UTF-8",
    `fontsdir='${escapeFfmpegSubtitlesPath(fontsDir)}'`,
    `force_style='${forceStyle}'`,
  ].join(":");
}
