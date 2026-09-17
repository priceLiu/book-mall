import { describe, expect, it } from "vitest";

import { resolveSbv1ImageAspectForGatewayRun } from "@/lib/canvas/sbv1-image-runner";

describe("resolveSbv1ImageAspectForGatewayRun", () => {
  it("maps auto to dock default 16:9 (with or without refs)", () => {
    expect(resolveSbv1ImageAspectForGatewayRun("auto")).toBe("16:9");
    expect(resolveSbv1ImageAspectForGatewayRun("")).toBe("16:9");
  });

  it("keeps explicit aspect ratios", () => {
    expect(resolveSbv1ImageAspectForGatewayRun("9:16")).toBe("9:16");
    expect(resolveSbv1ImageAspectForGatewayRun("16:9")).toBe("16:9");
  });
});
