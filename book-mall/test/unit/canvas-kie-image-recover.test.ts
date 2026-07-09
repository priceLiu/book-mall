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
});
