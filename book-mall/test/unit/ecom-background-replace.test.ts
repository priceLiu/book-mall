import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  BACKGROUND_REPLACE_EDGE_MAX,
  buildBackgroundReplaceRequest,
  buildSeedreamBackgroundReplacePrompt,
  detectFakeBackdropKind,
  fillTransparentHolesFromNeighbors,
  hasMeaningfulTransparency,
  knockOutFakeBackdrop,
  knockOutNearWhiteBackdrop,
  resolveBackgroundReplaceModel,
  sealWanxBackgroundResult,
  toRgbaPngBuffer,
} from "@/lib/ecom/ecom-background-replace";

describe("resolveBackgroundReplaceModel", () => {
  it("defaults to Seedream 5.0 Pro", () => {
    expect(resolveBackgroundReplaceModel()).toBe("doubao-seedream-5-0-pro");
    expect(resolveBackgroundReplaceModel("doubao-seedream-5-0-pro-260628")).toBe(
      "doubao-seedream-5-0-pro",
    );
  });

  it("maps legacy Wanx keys to Seedream", () => {
    expect(resolveBackgroundReplaceModel("wanx-background-generation-v2")).toBe(
      "doubao-seedream-5-0-pro",
    );
  });

  it("rejects other models", () => {
    expect(() => resolveBackgroundReplaceModel("qwen-image-edit")).toThrow(/仅支持/);
  });
});

describe("buildSeedreamBackgroundReplacePrompt", () => {
  it("uses a keep-subject prompt when there is no bbox", () => {
    expect(buildSeedreamBackgroundReplacePrompt({ scene: "大理洱海边" })).toContain(
      "背景换成大理洱海边",
    );
    expect(buildSeedreamBackgroundReplacePrompt({ scene: "大理洱海边" })).not.toContain(
      "<bbox>",
    );
  });

  it("embeds an official bbox tag when a region is selected", () => {
    const prompt = buildSeedreamBackgroundReplacePrompt({
      scene: "大理石海边",
      bbox: [20, 10, 980, 900],
    });
    expect(prompt).toContain("<bbox>20 10 980 900</bbox>");
    expect(prompt).toContain("区域替换成大理石海边");
  });

  it("uses 图 1 + 图 2 wording when a reference image is present", () => {
    const prompt = buildSeedreamBackgroundReplacePrompt({
      hasRefImage: true,
      bbox: [10, 20, 400, 800],
      refBbox: [100, 100, 500, 600],
    });
    expect(prompt).toBe(
      "将图 1 <bbox>10 20 400 800</bbox> 的主体放到图 2 <bbox>100 100 500 600</bbox> 位置",
    );
  });

  it("allows reference image without a scene prompt", () => {
    expect(
      buildSeedreamBackgroundReplacePrompt({ hasRefImage: true }),
    ).toContain("图 2 的场景");
  });

  it("expands official 图1框选 / 图2框选 chips into bbox tags", () => {
    const prompt = buildSeedreamBackgroundReplacePrompt({
      scene: "将 @图1框选 的主体放到 @图2框选 位置",
      bbox: [179, 283, 796, 986],
      refBbox: [118, 331, 933, 871],
      hasRefImage: true,
    });
    expect(prompt).toBe(
      "将 图 1 <bbox>179 283 796 986</bbox> 的主体放到 图 2 <bbox>118 331 933 871</bbox> 位置",
    );
  });

  it("still expands legacy @图片1 / @图片2 tokens", () => {
    const prompt = buildSeedreamBackgroundReplacePrompt({
      scene: "把 @图片1 的主体放到 @图片2 位置",
      bbox: [179, 283, 796, 986],
      refBbox: [118, 331, 933, 871],
      hasRefImage: true,
    });
    expect(prompt).toContain("图 1 <bbox>179 283 796 986</bbox>");
    expect(prompt).toContain("图 2 <bbox>118 331 933 871</bbox>");
  });

  it("rejects @图2框选 without a reference box", () => {
    expect(() =>
      buildSeedreamBackgroundReplacePrompt({
        scene: "将图 1 主体放到 @图2框选 位置",
        hasRefImage: true,
      }),
    ).toThrow(/@图2框选/);
  });
});

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

  it("punches a maroon mosaic backdrop that qwen paints instead of alpha", async () => {
    const cell = 4;
    const width = 32;
    const height = 32;
    const raw = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const light = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
        raw[i] = light ? 252 : 92;
        raw[i + 1] = light ? 251 : 42;
        raw[i + 2] = light ? 251 : 48;
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
    ).toBe("mosaic");

    const out = await knockOutFakeBackdrop(png);
    expect(await hasMeaningfulTransparency(out, 0.12)).toBe(true);
    const punched = await sharp(out).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const at = (x: number, y: number) => {
      const i = (y * punched.info.width! + x) * (punched.info.channels ?? 4);
      return punched.data[i + 3] ?? 0;
    };
    expect(at(0, 0)).toBeLessThan(10);
    expect(at(3, 1)).toBeLessThan(10);
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

describe("sealWanxBackgroundResult", () => {
  it("drops alpha when holes still hold scene RGB", async () => {
    const raw = Buffer.alloc(8 * 8 * 4, 255);
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = 30;
      raw[i + 1] = 80;
      raw[i + 2] = 120;
      raw[i + 3] = 0;
    }
    for (let y = 2; y < 6; y += 1) {
      for (let x = 2; x < 6; x += 1) {
        const i = (y * 8 + x) * 4;
        raw[i] = 20;
        raw[i + 1] = 140;
        raw[i + 2] = 60;
        raw[i + 3] = 255;
      }
    }
    const png = await sharp(raw, { raw: { width: 8, height: 8, channels: 4 } })
      .png()
      .toBuffer();
    const sealed = await sealWanxBackgroundResult(png);
    expect(sealed.needsSecondPass).toBe(false);
    expect(await hasMeaningfulTransparency(sealed.buf)).toBe(false);
  });

  it("asks for a second pass when holes are empty, then neighbor-fill seals them", async () => {
    const raw = Buffer.alloc(16 * 16 * 4, 255);
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const i = (y * 16 + x) * 4;
        const hole = x < 6 && y < 10;
        raw[i] = hole ? 0 : 40;
        raw[i + 1] = hole ? 0 : 90;
        raw[i + 2] = hole ? 0 : 70;
        raw[i + 3] = hole ? 0 : 255;
      }
    }
    const png = await sharp(raw, { raw: { width: 16, height: 16, channels: 4 } })
      .png()
      .toBuffer();
    const sealed = await sealWanxBackgroundResult(png);
    expect(sealed.needsSecondPass).toBe(true);
    const filled = await fillTransparentHolesFromNeighbors(sealed.buf);
    expect(await hasMeaningfulTransparency(filled)).toBe(false);
    const { data } = await sharp(filled).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    expect(data[0]).toBeGreaterThan(10);
    expect(data[3]).toBeGreaterThan(200);
  });
});
