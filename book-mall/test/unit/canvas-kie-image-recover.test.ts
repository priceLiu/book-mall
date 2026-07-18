import { describe, expect, it } from "vitest";

import { kieRecordFromGatewaySummary } from "@/lib/canvas/canvas-kie-image-recover";

describe("kieRecordFromGatewaySummary", () => {
  it("reads gateway KIE success summary", () => {
    const record = kieRecordFromGatewaySummary(
      { state: "success", resultJson: '{"resultUrls":["https://x/a.png"]}' },
      "kie-1",
      "nano-banana-2",
    );
    expect(record?.state).toBe("success");
    expect(record?.resultJson).toContain("resultUrls");
    expect(record?.taskId).toBe("kie-1");
  });

  it("reads succeeded state and top-level video url", () => {
    const record = kieRecordFromGatewaySummary(
      { state: "succeeded", videoUrl: "https://cdn.example/v.mp4" },
      "kie-v1",
      "kling-1.0/video",
    );
    expect(record?.state).toBe("success");
    expect(record?.resultJson).toContain("https://cdn.example/v.mp4");
  });

  it("reads nested data.resultJson", () => {
    const record = kieRecordFromGatewaySummary(
      {
        data: {
          state: "success",
          resultJson: '{"resultUrls":["https://x/v.mp4"]}',
          taskId: "vendor-9",
        },
      },
      "kie-1",
      "kling-1.0/video",
    );
    expect(record?.state).toBe("success");
    expect(record?.taskId).toBe("vendor-9");
  });
});
