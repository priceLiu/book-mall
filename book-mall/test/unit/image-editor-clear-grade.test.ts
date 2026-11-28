import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  colorAdjustIsNeutral,
  gradeAdjustPixel,
  gradeAdjustRgba,
  gradeClearPixel,
  gradeClearRgba,
  gradeNamedPixel,
  isClearGradeSourceUrl,
  parseColorAdjust,
  renderClearGradeJpeg,
} from "@/lib/ecom/image-editor-clear-grade";
import { IMAGE_EDITOR_COLOR_GRADE_CREDITS } from "@/lib/ecom/image-editor-color-grade-credits";

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("image editor clear grade", () => {
  it("charges a color grade far below one Seedream image", () => {
    expect(IMAGE_EDITOR_COLOR_GRADE_CREDITS).toBe(0.5);
  });

  it("grayscale and invert remap pixels", () => {
    const gray = gradeNamedPixel("grayscale", 40, 120, 200);
    expect(gray[0]).toBe(gray[1]);
    expect(gray[1]).toBe(gray[2]);
    const inverted = gradeNamedPixel("invert", 40, 120, 200);
    expect(inverted[0]).toBe(215);
    expect(inverted[1]).toBe(135);
    expect(inverted[2]).toBe(55);
  });

  it("vivid raises chroma of a muted red", () => {
    const [r, g, b] = gradeNamedPixel("vivid", 150, 100, 100);
    const before = 150 - 100;
    const after = Math.max(r, g, b) - Math.min(r, g, b);
    expect(after).toBeGreaterThan(before + 20);
  });

  it("resolves filter catalog recipes", () => {
    const kodak = gradeNamedPixel("film-kodak", 100, 110, 120);
    expect(kodak).toHaveLength(3);
    const textureFilm = gradeNamedPixel("film", 200, 100, 100);
    expect(textureFilm[0]).toBeGreaterThan(0);
    const lomo = gradeNamedPixel("lomo-classic", 128, 128, 128);
    expect(lomo).toHaveLength(3);
  });

  it("opens mid gray and keeps black black", () => {
    const [r, g, b] = gradeClearPixel(128, 128, 128);
    expect(luma(r, g, b)).toBeGreaterThan(148);
    const black = gradeClearPixel(4, 4, 4);
    expect(Math.max(...black)).toBeLessThanOrEqual(8);
  });

  it("cools a warm white without clipping it", () => {
    const [r, g, b] = gradeClearPixel(248, 236, 210);
    expect(b).toBeGreaterThan(210 + 8);
    expect(r).toBeLessThanOrEqual(248);
    expect(r).toBeGreaterThan(180);
    expect(Math.max(r, g, b)).toBeLessThan(255);
  });

  it("keeps a saturated red red", () => {
    const [r, g, b] = gradeClearPixel(210, 40, 36);
    expect(r).toBeGreaterThan(g + 80);
    expect(r).toBeGreaterThan(b + 80);
  });

  it("does not change a flat field except for the grade itself", () => {
    const data = Buffer.alloc(8 * 4);
    for (let i = 0; i < 8; i++) {
      data[i * 4] = 128;
      data[i * 4 + 1] = 128;
      data[i * 4 + 2] = 128;
      data[i * 4 + 3] = 255;
    }
    gradeClearRgba(data, 4, 2);
    expect(data[0]).toBe(data[4]);
    expect(data[1]).toBe(data[5]);
    expect(data[2]).toBe(data[6]);
  });

  it("rejects non-https and private hosts", () => {
    expect(isClearGradeSourceUrl("https://bucket.oss-cn-hangzhou.aliyuncs.com/a.jpg")).toBe(true);
    expect(isClearGradeSourceUrl("http://bucket.oss-cn-hangzhou.aliyuncs.com/a.jpg")).toBe(false);
    expect(isClearGradeSourceUrl("https://127.0.0.1/a.jpg")).toBe(false);
    expect(isClearGradeSourceUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isClearGradeSourceUrl("not a url")).toBe(false);
  });

  it("writes a jpeg that is lighter than the source gray", async () => {
    const src = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 120, g: 116, b: 104 },
      },
    })
      .jpeg()
      .toBuffer();
    const out = await renderClearGradeJpeg(src);
    const before = await sharp(src).stats();
    const after = await sharp(out).stats();
    const beforeL =
      before.channels[0]!.mean * 0.2126 +
      before.channels[1]!.mean * 0.7152 +
      before.channels[2]!.mean * 0.0722;
    const afterL =
      after.channels[0]!.mean * 0.2126 +
      after.channels[1]!.mean * 0.7152 +
      after.channels[2]!.mean * 0.0722;
    expect(afterL).toBeGreaterThan(beforeL + 8);
    expect(after.channels[2]!.mean).toBeGreaterThan(before.channels[2]!.mean);
  });

  it("lifts a dark pixel with fill and replaces a nearby color", () => {
    const lifted = gradeAdjustPixel({ fill: 80 }, 40, 40, 40);
    expect(lifted[0]).toBeGreaterThan(55);
    const swapped = gradeAdjustPixel(
      { recolorSource: [200, 30, 30], recolorTarget: [30, 40, 210], recolorTolerance: 30 },
      198,
      32,
      28,
    );
    expect(swapped[2]).toBeGreaterThan(swapped[0]);
    const kept = gradeAdjustPixel(
      { recolorSource: [200, 30, 30], recolorTarget: [30, 40, 210], recolorTolerance: 30 },
      20,
      40,
      210,
    );
    expect(kept[2]).toBeGreaterThan(kept[0]);
    expect(colorAdjustIsNeutral({})).toBe(true);
    expect(colorAdjustIsNeutral(parseColorAdjust('{"brightness":12}'))).toBe(false);
    expect(colorAdjustIsNeutral({ splitHighlightRgb: [214, 54, 54] })).toBe(true);
    const parsed = parseColorAdjust(
      '{"vignette":40,"hslBands":[[80,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],"splitHighlightRgb":[214,54,54],"splitHighlightSat":80}',
    );
    expect(parsed.vignette).toBe(40);
    expect(parsed.hslBands?.[0]).toEqual([80, 0, 0]);
    expect(parsed.splitHighlightSat).toBe(80);
  });

  it("darkens corners, tints highlights, and shifts a red band", () => {
    const width = 16;
    const height = 16;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 200;
      data[i * 4 + 1] = 200;
      data[i * 4 + 2] = 200;
      data[i * 4 + 3] = 255;
    }
    gradeAdjustRgba(data, width, height, { vignette: 100 });
    expect(data[0]!).toBeLessThan(data[(8 * width + 8) * 4]! - 20);

    const shifted = gradeAdjustPixel(
      { hslBands: [[80, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] },
      220,
      30,
      30,
    );
    expect(shifted[1]).toBeGreaterThan(50);
    const tinted = gradeAdjustPixel({ splitHighlightRgb: [214, 54, 54], splitHighlightSat: 100 }, 240, 240, 240);
    expect(tinted[0]).toBeGreaterThan(tinted[2] + 10);
  });
});
