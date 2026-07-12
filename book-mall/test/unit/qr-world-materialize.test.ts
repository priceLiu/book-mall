import { describe, expect, it } from "vitest";

import { extractWorldFromLogResult } from "@/lib/quick-replica/qr-world-service";

describe("extractWorldFromLogResult", () => {
  it("reads world from resultSummary.world", () => {
    const world = {
      world_id: "6425f0fd-fed4-4569-9d92-1ea90f5627d0",
      display_name: "Test",
      world_marble_url: "https://marble.worldlabs.ai/world/6425f0fd-fed4-4569-9d92-1ea90f5627d0",
    };
    expect(extractWorldFromLogResult({ world })).toEqual(world);
  });

  it("reads world from nested operation response", () => {
    const world = {
      world_id: "d113b1c8-728b-49a2-a88c-d4ad13a4bffb",
      display_name: "Nested",
      world_marble_url: "https://marble.worldlabs.ai/world/d113b1c8-728b-49a2-a88c-d4ad13a4bffb",
    };
    expect(
      extractWorldFromLogResult({
        operation: {
          operation_id: "op-1",
          done: true,
          response: { world },
        },
      }),
    ).toEqual(world);
  });
});
