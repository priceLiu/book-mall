import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  inferCanvasUploadImageMime,
  normalizeCanvasUploadImageBuffer,
  sniffImageMimeFromBuffer,
} from "@/lib/canvas/canvas-image-upload-normalize";

describe("canvas-image-upload-normalize", () => {
  it("inferCanvasUploadImageMime from extension when type empty", () => {
    expect(inferCanvasUploadImageMime("", "photo.jpg")).toBe("image/jpeg");
    expect(inferCanvasUploadImageMime("", "shot.PNG")).toBe("image/png");
    expect(inferCanvasUploadImageMime("image/x-png", "")).toBe("image/png");
  });

  it("sniffs png/jpeg magic bytes", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    expect(sniffImageMimeFromBuffer(png)).toBe("image/png");
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(sniffImageMimeFromBuffer(jpeg)).toBe("image/jpeg");
  });

  it("preserves transparency: alpha png stays png (no white matte)", async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();
    const out = await normalizeCanvasUploadImageBuffer(png);
    expect(out.contentType).toBe("image/png");
    expect(out.ext).toBe("png");
  });

  it("trims transparent padding so the node fits content (no border)", async () => {
    const inner = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const padded = await sharp({
      create: {
        width: 24,
        height: 24,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: inner, top: 8, left: 8 }])
      .png()
      .toBuffer();
    const out = await normalizeCanvasUploadImageBuffer(padded);
    expect(out.contentType).toBe("image/png");
    const meta = await sharp(out.buf).metadata();
    expect(meta.width).toBe(8);
    expect(meta.height).toBe(8);
  });

  it("opaque png is flattened to jpeg", async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const out = await normalizeCanvasUploadImageBuffer(png);
    expect(out.contentType).toBe("image/jpeg");
    expect(out.ext).toBe("jpg");
  });

  it("re-encodes jpeg buffer", async () => {
    const jpeg = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 0, g: 128, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();
    const out = await normalizeCanvasUploadImageBuffer(jpeg);
    expect(out.contentType).toBe("image/jpeg");
    expect(out.ext).toBe("jpg");
  });

  it("converts webp to jpeg", async () => {
    const webp = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 0, g: 128, b: 255 },
      },
    })
      .webp()
      .toBuffer();
    const out = await normalizeCanvasUploadImageBuffer(webp);
    expect(out.contentType).toBe("image/jpeg");
    expect(out.ext).toBe("jpg");
  });
});
