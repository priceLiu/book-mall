import { describe, expect, it } from "vitest";
import { formatVolcenginePortraitLivenessError } from "@/lib/gateway/volcengine-portrait-liveness";

describe("formatVolcenginePortraitLivenessError", () => {
  it("maps empty 404 to portrait entitlement guidance", () => {
    const msg = formatVolcenginePortraitLivenessError({
      action: "CreateVisualValidateSession",
      status: 404,
      text: "",
      json: null,
      url: "https://ark.cn-beijing.volces.com/api/v3/portrait/?Action=CreateVisualValidateSession",
    });
    expect(msg).toContain("真人人像库");
    expect(msg).not.toContain("CreateVisualValidateSession 404:");
  });

  it("surfaces ResponseMetadata business errors", () => {
    const msg = formatVolcenginePortraitLivenessError({
      action: "GetVisualValidateResult",
      status: 200,
      text: "{}",
      json: {
        ResponseMetadata: {
          Error: { Code: "ValidatePending", Message: "not ready" },
        },
      },
      url: "",
    });
    expect(msg).toContain("尚未完成");
  });
});
