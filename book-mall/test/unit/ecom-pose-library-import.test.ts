import { describe, expect, it } from "vitest";

import {
  buildAutoPoseTitle,
  buildPoseSourceImageKeyFromBuffer,
  buildPoseSourceImageKeyFromUrl,
  extractPoseDescriptionFromPrompt,
  normalizePoseSourceImageUrl,
} from "@/lib/ecom/ecom-pose-library-import-helpers";

describe("ecom-pose-library-import helpers", () => {
  it("normalizes source URL by stripping query and hash", () => {
    expect(normalizePoseSourceImageUrl("https://cdn.example.com/a.jpg?v=1#x")).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("builds stable dedup keys from URL and buffer", () => {
    const urlKey = buildPoseSourceImageKeyFromUrl("https://cdn.example.com/a.jpg?sig=1");
    expect(urlKey).toBe("url:https://cdn.example.com/a.jpg");

    const buf = Buffer.from("same-bytes");
    const hashKey = buildPoseSourceImageKeyFromBuffer(buf);
    expect(hashKey).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(buildPoseSourceImageKeyFromBuffer(buf)).toBe(hashKey);
  });

  it("extracts pose segment from model-shot wearing sentence", () => {
    const prompt =
      "穿着白色连衣裙，单手叉腰站立，场景为纯白影棚，道具无。";
    expect(extractPoseDescriptionFromPrompt(prompt)).toBe("单手叉腰站立");
  });

  it("buildAutoPoseTitle branches on savePrompt", () => {
    const now = new Date("2026-09-04T14:30:00+08:00");
    expect(
      buildAutoPoseTitle({
        savePrompt: true,
        poseDescription: "单手叉腰站立",
        now,
      }),
    ).toBe("单手叉腰站立 ·0904-1430");

    expect(
      buildAutoPoseTitle({
        savePrompt: false,
        now,
      }),
    ).toBe("姿势参考 ·0904-1430");
  });
});
