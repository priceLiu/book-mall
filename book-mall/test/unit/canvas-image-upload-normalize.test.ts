import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  inferCanvasUploadImageMime,
  normalizeCanvasUploadImageBuffer,
} from "@/lib/canvas/canvas-image-upload-normalize";

describe("canvas-image-upload-normalize", () => {
  it("inferCanvasUploadImageMime from extension when type empty", () => {
    expect(inferCanvasUploadImageMime("", "photo.jpg")).toBe("image/jpeg");
    expect(inferCanvasUploadImageMime("", "shot.PNG")).toBe("image/png");
  });

  it("keeps jpeg/png buffers", async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    const out = await normalizeCanvasUploadImageBuffer(png);
    expect(out.contentType).toBe("image/png");
    expect(out.ext).toBe("png");
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
