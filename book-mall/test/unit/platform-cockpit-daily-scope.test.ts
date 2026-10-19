import { describe, expect, it } from "vitest";

import {
  cockpitDailyAppLabel,
  resolveCockpitDailyAppKey,
  resolveCockpitDailyMediaKind,
  resolveCockpitDailyProjectKey,
} from "@/lib/admin/platform-cockpit-daily-scope";

describe("resolveCockpitDailyAppKey", () => {
  it("maps canvas from page or source", () => {
    expect(
      resolveCockpitDailyAppKey({ clientPage: "canvas/proj-1/flow", clientSource: null }),
    ).toBe("canvas");
    expect(resolveCockpitDailyAppKey({ clientPage: null, clientSource: "CANVAS" })).toBe(
      "canvas",
    );
  });

  it("maps ecom workspace paths", () => {
    expect(
      resolveCockpitDailyAppKey({
        clientPage: "ecom/user-1/ws-abc/detail",
        clientSource: "E_COMMERCE",
      }),
    ).toBe("ecom");
  });
});

describe("resolveCockpitDailyProjectKey", () => {
  it("extracts canvas project id", () => {
    expect(
      resolveCockpitDailyProjectKey({
        appKey: "canvas",
        clientPage: "canvas/abc-123/node/x",
        storyProjectId: null,
      }),
    ).toBe("abc-123");
  });

  it("extracts ecom workspace id", () => {
    expect(
      resolveCockpitDailyProjectKey({
        appKey: "ecom",
        clientPage: "ecom/u1/workspace-99/foo",
        storyProjectId: null,
      }),
    ).toBe("workspace-99");
  });

  it("prefers storyProjectId for story", () => {
    expect(
      resolveCockpitDailyProjectKey({
        appKey: "story",
        clientPage: "story/foo",
        storyProjectId: "sp-1",
      }),
    ).toBe("sp-1");
  });
});

describe("resolveCockpitDailyMediaKind", () => {
  it("classifies image and video kinds", () => {
    expect(resolveCockpitDailyMediaKind("IMAGE")).toBe("image");
    expect(resolveCockpitDailyMediaKind("VIDEO")).toBe("video");
    expect(resolveCockpitDailyMediaKind("CHAT")).toBe("other");
  });
});

describe("cockpitDailyAppLabel", () => {
  it("returns zh label", () => {
    expect(cockpitDailyAppLabel("canvas")).toBe("Canvas 画布");
  });
});
