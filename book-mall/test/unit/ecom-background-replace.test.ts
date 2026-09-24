import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  BACKGROUND_REPLACE_EDGE_MAX,
  buildBackgroundReplaceRequest,
  detectFakeBackdropKind,
  hasMeaningfulTransparency,
  knockOutFakeBackdrop,
  knockOutNearWhiteBackdrop,
  toRgbaPngBuffer,
} from "@/lib/ecom/ecom-background-replace";

describe("buildBackgroundReplaceRequest", () => {
  it("requires a base image and prompt or ref image", () => {
    expect(() =>
      buildBackgroundReplaceRequest({ baseImageUrl: "", refPrompt: "cafe" }),
    ).toThrow(/主体图/);
    expect(() =>
      buildBackgroundReplaceRequest({
        baseImageUrl: "https://example.com/cutout.png",
      }),
    ).toThrow(/场景描述/);
  });

  it("builds a v3 text-guided request by default", () => {
    const body = buildBackgroundReplaceRequest({
      baseImageUrl: "https://example.com/cutout.png",
      refPrompt: "大理石桌面咖啡馆",
    });
    expect(body.model).toBe("wanx-background-generation-v2");
    expect(body.input).toEqual({
      base_image_url: "https://example.com/cutout.png",
      ref_prompt: "大理石桌面咖啡馆",
    });
    expect(body.parameters).toEqual({ n: 1, model_version: "v3" });
  });

  it("keeps image-guide extras only when a ref image is present", () => {
    const body = buildBackgroundReplaceRequest({
      baseImageUrl: "https://example.com/cutout.png",
      refPrompt: "暖光客厅",
      refImageUrl: "https://example.com/style.jpg",
      noiseLevel: 120.7,
      refPromptWeight: 0.8,
      n: 9,
      modelVersion: "v2",
    });
    expect(body.parameters).toEqual({
      n: 4,
      model_version: "v2",
      noise_level: 121,
      ref_prompt_weight: 0.8,
    });
    expect(body.input.ref_image_url).toBe("https://example.com/style.jpg");
  });

  it("rejects too many edge guides", () => {
    const edges = Array.from({ length: BACKGROUND_REPLACE_EDGE_MAX + 1 }, (_, i) => ({
      url: `https://example.com/edge-${i}.png`,
    }));
    expect(() =>
      buildBackgroundReplaceRequest({
        baseImageUrl: "https://example.com/cutout.png",
        refPrompt: "studio",
        foregroundEdges: edges,
      }),
    ).toThrow(/最多/);
  });
});

describe("toRgbaPngBuffer", () => {
  it("converts an RGB jpeg into RGBA png", async () => {
    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#336699" },
    })
      .jpeg()
      .toBuffer();
    const before = await sharp(jpeg).metadata();
    expect(before.hasAlpha).toBeFalsy();

    const png = await toRgbaPngBuffer(jpeg);
    const after = await sharp(png).metadata();
    expect(after.format).toBe("png");
    expect(after.hasAlpha).toBe(true);
    expect(after.channels).toBe(4);
  });

  it("shrinks a 1808x2384-class image so the long edge is under 2048", async () => {
    const jpeg = await sharp({
      create: { width: 1808, height: 2384, channels: 3, background: "#112233" },
    })
      .jpeg()
      .toBuffer();
    const png = await toRgbaPngBuffer(jpeg);
    const after = await sharp(png).metadata();
    expect(after.width && after.height).toBeTruthy();
    expect(Math.max(after.width ?? 0, after.height ?? 0)).toBeLessThan(2048);
    expect(after.hasAlpha).toBe(true);
  });

  it("treats an opaque jpeg as having no useful transparency", async () => {
    const jpeg = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#336699" },
    })
      .jpeg()
      .toBuffer();
    expect(await hasMeaningfulTransparency(jpeg)).toBe(false);
  });

  it("detects a real hole in an RGBA png", async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    expect(await hasMeaningfulTransparency(png)).toBe(true);
  });

  it("keeps real holes when converting an already-transparent PNG", async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 3, height: 3, channels: 3, background: "#226633" },
          })
            .png()
            .toBuffer(),
          left: 2,
          top: 2,
        },
      ])
      .png()
      .toBuffer();
    expect(await hasMeaningfulTransparency(await toRgbaPngBuffer(png))).toBe(true);
  });

  it("punches a baked checkerboard without eating a solid white interior", async () => {
    const cell = 4;
    const width = 32;
    const height = 32;
    const raw = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const light = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
        raw[i] = light ? 252 : 152;
        raw[i + 1] = light ? 251 : 151;
        raw[i + 2] = light ? 251 : 147;
        raw[i + 3] = 255;
      }
    }
    for (let y = 6; y < 12; y += 1) {
      for (let x = 10; x < 22; x += 1) {
        const i = (y * width + x) * 4;
        raw[i] = 37;
        raw[i + 1] = 95;
        raw[i + 2] = 69;
        raw[i + 3] = 255;
      }
    }
    for (let y = 12; y < 24; y += 1) {
      for (let x = 10; x < 22; x += 1) {
        const i = (y * width + x) * 4;
        raw[i] = 250;
        raw[i + 1] = 250;
        raw[i + 2] = 248;
        raw[i + 3] = 255;
      }
    }
    const png = await sharp(raw, {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toBuffer();
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect(
      detectFakeBackdropKind(data, info.width ?? 0, info.height ?? 0, info.channels ?? 4),
    ).toBe("checkerboard");

    const out = await knockOutFakeBackdrop(png);
    expect(await hasMeaningfulTransparency(out)).toBe(true);
    const punched = await sharp(out).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const at = (x: number, y: number) => {
      const i = (y * punched.info.width! + x) * (punched.info.channels ?? 4);
      return punched.data[i + 3] ?? 0;
    };
    expect(at(0, 0)).toBeLessThan(10);
    expect(at(1, 0)).toBeLessThan(10);
    expect(at(16, 8)).toBeGreaterThan(200);
    expect(at(16, 18)).toBeGreaterThan(200);
  });

  it("knocks out a white backdrop when all four corners are white", async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 2,
              height: 2,
              channels: 3,
              background: "#112233",
            },
          })
            .png()
            .toBuffer(),
          left: 3,
          top: 3,
        },
      ])
      .png()
      .toBuffer();
    const out = await knockOutNearWhiteBackdrop(png);
    expect(await hasMeaningfulTransparency(out)).toBe(true);
  });
});
