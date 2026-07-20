import { describe, expect, it } from "vitest";

import { routeGatewayModel } from "@/lib/gateway/model-router";

describe("routeGatewayModel · 百炼 R2V", () => {
  it("happyhorse-1.0-r2v 走 BAILIAN 而非 DASHSCOPE 前缀", () => {
    expect(routeGatewayModel("happyhorse-1.0-r2v")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "VIDEO",
    });
  });

  it("wan2.7-r2v 走 BAILIAN", () => {
    expect(routeGatewayModel("wan2.7-r2v")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "VIDEO",
    });
  });

  it("happyhorse-1.0-i2v 仍走 DASHSCOPE 图生视频", () => {
    expect(routeGatewayModel("happyhorse-1.0-i2v")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
  });

  it("happyhorse-1.1-t2v 走 DASHSCOPE 文生视频", () => {
    expect(routeGatewayModel("happyhorse-1.1-t2v")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
  });

  it("happyhorse-1.1-r2v 走 BAILIAN", () => {
    expect(routeGatewayModel("happyhorse-1.1-r2v")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "VIDEO",
    });
  });
});
