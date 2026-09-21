import { describe, expect, it } from "vitest";

import {
  readHitVisionSellpointJob,
  visionSellpointProgressLabel,
  visionSellpointProgressPercent,
} from "@/lib/detail-page-suite-vision-sellpoint-progress";

describe("detail-page-suite-vision-sellpoint-progress", () => {
  it("reads percent and label from meta job", () => {
    const job = readHitVisionSellpointJob({
      hitVisionSellpoint: {
        status: "running",
        progress: {
          percent: 42,
          title: "Vision 模型识图中",
          detail: "等待 Gateway 返回…",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });
    expect(visionSellpointProgressPercent(job)).toBe(42);
    expect(visionSellpointProgressLabel(job)).toContain("Vision 模型识图中");
  });
});
