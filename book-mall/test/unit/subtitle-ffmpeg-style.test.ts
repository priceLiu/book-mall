import { describe, expect, it, vi } from "vitest";

import {
  SUBTITLE_CJK_FONT_MISSING_MESSAGE,
  buildSubtitlesFilterExpr,
  escapeFfmpegSubtitlesPath,
  isolateSubtitleFontsDir,
  resolveSubtitleBurnInFont,
  resolveSubtitleFontByKey,
  shouldIsolateSubtitleFontsDir,
} from "@/lib/media/subtitle-ffmpeg-style";

describe("resolveSubtitleBurnInFont", () => {
  it("picks WenQuanYi on Linux Docker path", () => {
    const font = resolveSubtitleBurnInFont({
      exists: (p) => p === "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
      home: "",
      tryFontconfig: false,
    });
    expect(font.fontName).toBe("WenQuanYi Micro Hei");
    expect(font.fontsDir).toBe("/usr/share/fonts/truetype/wqy");
  });

  it("picks Heiti SC on macOS", () => {
    const font = resolveSubtitleBurnInFont({
      exists: (p) => p === "/System/Library/Fonts/STHeiti Medium.ttc",
      home: "/Users/dev",
      tryFontconfig: false,
    });
    expect(font.fontName).toBe("Heiti SC");
    expect(font.fontFile).toBe("/System/Library/Fonts/STHeiti Medium.ttc");
  });

  it("picks user-installed Noto Sans SC", () => {
    const font = resolveSubtitleBurnInFont({
      exists: (p) => p === "/Users/dev/Library/Fonts/NotoSansSC.ttf",
      home: "/Users/dev",
      tryFontconfig: false,
    });
    expect(font.fontName).toBe("Noto Sans SC");
  });

  it("throws when no CJK font is available", () => {
    expect(() =>
      resolveSubtitleBurnInFont({
        exists: () => false,
        home: "",
        tryFontconfig: false,
      }),
    ).toThrow(SUBTITLE_CJK_FONT_MISSING_MESSAGE);
  });
});

describe("resolveSubtitleFontByKey", () => {
  it("picks songti candidate when available", () => {
    const font = resolveSubtitleFontByKey("songti", {
      exists: (p) =>
        p === "/System/Library/Fonts/Supplemental/Songti.ttc",
      home: "",
      tryFontconfig: false,
    });
    expect(font.fontName).toBe("Songti SC");
  });

  it("falls back to heiti when noto is unavailable", () => {
    const warn = vi.spyOn(console, "info").mockImplementation(() => {});
    const font = resolveSubtitleFontByKey("noto", {
      exists: (p) => p === "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
      home: "",
      tryFontconfig: false,
    });
    expect(font.fontName).toBe("WenQuanYi Micro Hei");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("noto"),
    );
    warn.mockRestore();
  });
});

describe("buildSubtitlesFilterExpr", () => {
  const font = {
    fontName: "Heiti SC",
    fontFile: "/System/Library/Fonts/STHeiti Medium.ttc",
    fontsDir: "/System/Library/Fonts",
  };

  it("forces CJK FontName, fontsdir and UTF-8", () => {
    const expr = buildSubtitlesFilterExpr("/tmp/subs.srt", { font });
    expect(expr).toContain("subtitles='/tmp/subs.srt'");
    expect(expr).toContain("charenc=UTF-8");
    expect(expr).toContain("fontsdir='/System/Library/Fonts'");
    expect(expr).toContain("force_style='FontName=Heiti SC,FontSize=20'");
  });

  it("merges MarginV into the same force_style", () => {
    const expr = buildSubtitlesFilterExpr("/tmp/subs.srt", {
      font,
      MarginV: 48,
    });
    expect(expr).toContain(
      "force_style='FontName=Heiti SC,FontSize=20,MarginV=48'",
    );
    expect(expr.match(/force_style=/g)?.length).toBe(1);
  });

  it("applies sizeKey medium and small", () => {
    expect(
      buildSubtitlesFilterExpr("/tmp/subs.srt", { font, sizeKey: "medium" }),
    ).toContain("FontSize=16");
    expect(
      buildSubtitlesFilterExpr("/tmp/subs.srt", { font, sizeKey: "small" }),
    ).toContain("FontSize=13");
  });

  it("escapes colon in subtitle path for ffmpeg", () => {
    expect(escapeFfmpegSubtitlesPath("C:/tmp/subs.srt")).toBe(
      "C\\:/tmp/subs.srt",
    );
  });
});

describe("isolateSubtitleFontsDir", () => {
  it("keeps dedicated font packages as-is", () => {
    expect(shouldIsolateSubtitleFontsDir("/usr/share/fonts/truetype/wqy")).toBe(
      false,
    );
    const font = {
      fontName: "WenQuanYi Micro Hei",
      fontFile: "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
      fontsDir: "/usr/share/fonts/truetype/wqy",
    };
    expect(isolateSubtitleFontsDir(font)).toBe(font.fontsDir);
  });

  it("isolates macOS system font roots", () => {
    expect(shouldIsolateSubtitleFontsDir("/System/Library/Fonts")).toBe(true);
  });
});
