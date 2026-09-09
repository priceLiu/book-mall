import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  assessVtonGarmentCropQuality,
  clampBboxExtractRect,
  estimateGarmentContentFillRatio,
  pickBestGarmentCropBuffer,
  tightTrimGarmentCropBuffer,
} from "@/lib/ecom/ecom-vton/garment-crop-normalize";

async function makeGarmentOnWhiteCanvas(opts: {
  width: number;
  height: number;
  garmentWidth: number;
  garmentHeight: number;
  garmentTop: number;
}): Promise<Buffer> {
  const garment = await sharp({
    create: {
      width: opts.garmentWidth,
      height: opts.garmentHeight,
      channels: 3,
      background: { r: 30, g: 40, b: 120 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: opts.width,
      height: opts.height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: garment, top: opts.garmentTop, left: 0 }])
    .png()
    .toBuffer();
}

describe("ecom-vton garment crop normalize", () => {
  it("clampBboxExtractRect pads and clamps to image bounds", () => {
    const rect = clampBboxExtractRect(1000, 1200, [100, 80, 420, 360]);
    expect(rect).toMatchObject({
      left: 94,
      top: 74,
      width: 332,
      height: 292,
    });
  });

  it("tightTrimGarmentCropBuffer removes large white padding below garment", async () => {
    const padded = await makeGarmentOnWhiteCanvas({
      width: 400,
      height: 900,
      garmentWidth: 400,
      garmentHeight: 220,
      garmentTop: 0,
    });
    const fillBefore = await estimateGarmentContentFillRatio(padded);
    expect(fillBefore).toBeLessThan(0.3);

    const trimmed = await tightTrimGarmentCropBuffer(padded);
    const meta = await sharp(trimmed).metadata();
    expect(meta.height).toBeLessThan(350);
    const fillAfter = await estimateGarmentContentFillRatio(trimmed);
    expect(fillAfter).toBeGreaterThan(0.7);
  });

  it("assessVtonGarmentCropQuality flags tall white padding even when fill > 35%", async () => {
    const padded = await makeGarmentOnWhiteCanvas({
      width: 400,
      height: 550,
      garmentWidth: 400,
      garmentHeight: 220,
      garmentTop: 0,
    });
    const quality = await assessVtonGarmentCropQuality(padded);
    expect(quality.fillRatio).toBeGreaterThan(0.35);
    expect(quality.contentHeightRatio).toBeLessThan(0.82);
    expect(quality.needsTightening).toBe(true);
  });

  it("pickBestGarmentCropBuffer prefers tighter crop over padded vendor crop", async () => {
    const padded = await makeGarmentOnWhiteCanvas({
      width: 400,
      height: 900,
      garmentWidth: 400,
      garmentHeight: 220,
      garmentTop: 0,
    });
    const trimmed = await tightTrimGarmentCropBuffer(padded);
    const picked = await pickBestGarmentCropBuffer([padded, trimmed]);
    const pickedMeta = await sharp(picked.buf).metadata();
    expect(pickedMeta.height).toBeLessThan(350);
    expect(picked.fillRatio).toBeGreaterThan(0.7);
  });
});
