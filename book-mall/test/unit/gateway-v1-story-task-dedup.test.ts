import { describe, expect, it } from "vitest";

import {
  dedupeGatewayCreateByStoryTaskId,
  type GatewayStoryTaskDedupeHit,
} from "@/lib/gateway/gateway-v1-story-task-dedup";

describe("dedupeGatewayCreateByStoryTaskId", () => {
  it("returns not_found when storyTaskId is empty", async () => {
    await expect(dedupeGatewayCreateByStoryTaskId("")).resolves.toBe("not_found");
    await expect(dedupeGatewayCreateByStoryTaskId(undefined)).resolves.toBe(
      "not_found",
    );
  });

  it("type-narrows dedupe hit", () => {
    const hit: GatewayStoryTaskDedupeHit = {
      logId: "log_1",
      taskId: "vendor_1",
    };
    expect(hit.taskId).toBe("vendor_1");
  });
});
