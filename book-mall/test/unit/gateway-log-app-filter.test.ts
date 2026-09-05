import { describe, expect, it } from "vitest";

import {
  buildGatewayLogAppWhere,
  parseGatewayLogAppKey,
} from "@/lib/gateway/gateway-log-app-filter";

describe("parseGatewayLogAppKey", () => {
  it("parses new appKey slugs", () => {
    expect(parseGatewayLogAppKey("assistant")).toBe("assistant");
    expect(parseGatewayLogAppKey("prompt-optimizer")).toBe("prompt-optimizer");
    expect(parseGatewayLogAppKey("quick-replica")).toBe("quick-replica");
  });

  it("maps legacy clientSource enums", () => {
    expect(parseGatewayLogAppKey("CANVAS")).toBe("canvas");
    expect(parseGatewayLogAppKey("TOOL")).toBe("tool");
    expect(parseGatewayLogAppKey("QUICK_REPLICA")).toBe("quick-replica");
    expect(parseGatewayLogAppKey("ASSISTANT")).toBe("assistant");
  });
});

describe("buildGatewayLogAppWhere", () => {
  it("splits AI 小智 from 日常工具", () => {
    expect(buildGatewayLogAppWhere("assistant")).toEqual({
      clientPage: { startsWith: "platform-assistant/" },
    });
    expect(buildGatewayLogAppWhere("tool")).toMatchObject({
      AND: expect.arrayContaining([{ clientSource: "TOOL" }]),
    });
  });

  it("matches 主站 Book via account/ clientPage", () => {
    expect(buildGatewayLogAppWhere("book")).toEqual({
      clientPage: { startsWith: "account/" },
    });
  });

  it("matches 提示词 via clientPage prefix", () => {
    expect(buildGatewayLogAppWhere("prompt-optimizer")).toEqual({
      OR: [
        { clientPage: { startsWith: "prompt-optimizer" } },
        { clientPage: "prompt-optimizer" },
      ],
    });
  });

  it("matches 快速复刻 via clientSource or clientPage", () => {
    expect(buildGatewayLogAppWhere("quick-replica")).toEqual({
      OR: [
        { clientSource: "QUICK_REPLICA" },
        { clientPage: { startsWith: "quick-replica/" } },
        { clientPage: { startsWith: "quick-replica" } },
      ],
    });
  });

  it("excludes account/ from external tab", () => {
    expect(buildGatewayLogAppWhere("external")).toEqual({
      AND: [
        { clientSource: "EXTERNAL" },
        { NOT: { clientPage: { startsWith: "account/" } } },
      ],
    });
  });
});
