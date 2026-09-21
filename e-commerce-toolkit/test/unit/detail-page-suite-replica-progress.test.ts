import { describe, expect, it } from "vitest";

import {
  isReplicaDecomposeInFlight,
  replicaDecomposeStatusCopy,
} from "@/lib/detail-page-suite-replica-progress";

describe("detail-page-suite-replica-progress", () => {
  it("reads persisted progress title", () => {
    const copy = replicaDecomposeStatusCopy({
      replicaStatus: "polishing",
      replicaProgress: {
        step: "polish",
        title: "步骤 2/3：润色模块 Prompt（3/12）",
        detail: "刚完成：首屏主视觉海报",
        doneModules: 3,
        totalModules: 12,
      },
    });
    expect(copy?.title).toContain("3/12");
    expect(copy?.detail).toContain("首屏");
  });

  it("detects in-flight statuses", () => {
    expect(isReplicaDecomposeInFlight({ replicaStatus: "decomposing" })).toBe(true);
    expect(isReplicaDecomposeInFlight({ replicaStatus: "ready" })).toBe(false);
  });
});
