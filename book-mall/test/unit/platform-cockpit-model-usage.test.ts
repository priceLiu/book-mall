import { describe, expect, it } from "vitest";

import { classifyGatewayRequestKind } from "@/lib/admin/platform-cockpit-model-usage";

describe("classifyGatewayRequestKind", () => {
  it("maps IMAGE and TRYON to image", () => {
    expect(classifyGatewayRequestKind("IMAGE")).toBe("image");
    expect(classifyGatewayRequestKind("TRYON")).toBe("image");
  });

  it("maps VIDEO to video", () => {
    expect(classifyGatewayRequestKind("VIDEO")).toBe("video");
  });

  it("maps CHAT, TTS, OTHER, MUSIC to other", () => {
    expect(classifyGatewayRequestKind("CHAT")).toBe("other");
    expect(classifyGatewayRequestKind("TTS")).toBe("other");
    expect(classifyGatewayRequestKind("OTHER")).toBe("other");
    expect(classifyGatewayRequestKind("MUSIC")).toBe("other");
  });
});
