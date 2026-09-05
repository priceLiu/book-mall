import { describe, expect, it } from "vitest";

import {
  presentationSourceLabelFor,
  resolveSourceLabel,
} from "@/lib/gateway/model-source-label";
import {
  getShelfMetaForCanonical,
  isCanonicalVisibleOnShelf,
  loadShelfIndexForApp,
} from "@/lib/platform-model/app-model-shelf";

describe("resolveSourceLabel", () => {
  it("maps KIE providerKind to 第三方 by default", () => {
    expect(
      resolveSourceLabel({
        canonicalModelKey: "test-kie",
        providerKind: "KIE",
        vendor: "kie",
      }),
    ).toBe("第三方");
  });

  it("maps VOLCENGINE to 平台", () => {
    expect(
      resolveSourceLabel({
        canonicalModelKey: "seedance-2.0",
        providerKind: "VOLCENGINE",
        vendor: "volcengine",
      }),
    ).toBe("平台");
  });

  it("prefers catalog sourceLabel override", () => {
    expect(
      resolveSourceLabel({
        canonicalModelKey: "grok-imagine/text-to-image",
        providerKind: "KIE",
        vendor: "kie",
        catalogSourceLabel: "Grok",
      }),
    ).toBe("Grok");
  });

  it("reads presentation JSON providerLabel", () => {
    const label = presentationSourceLabelFor("grok-imagine/text-to-image");
    expect(label).toBe("Grok");
  });
});

describe("isCanonicalVisibleOnShelf", () => {
  it("allows all when shelf index is empty", () => {
    const idx = new Map();
    expect(
      isCanonicalVisibleOnShelf(idx, "any-model", { appTag: "canvas", sceneKey: "" }),
    ).toBe(true);
  });

  it("filters to ACTIVE shelf rows when scope has records", () => {
    const idx = new Map([
      [
        "",
        {
          hasShelfForScope: true,
          activeByCanonical: new Map([
            ["model-a", { sortOrder: 0, displayNameOverride: null, sourceLabelOverride: null }],
          ]),
        },
      ],
    ]);
    expect(
      isCanonicalVisibleOnShelf(idx, "model-a", { appTag: "canvas", sceneKey: "" }),
    ).toBe(true);
    expect(
      isCanonicalVisibleOnShelf(idx, "model-b", { appTag: "canvas", sceneKey: "" }),
    ).toBe(false);
  });

  it("returns shelf meta for scene then global", () => {
    const idx = new Map([
      [
        "pro2-video",
        {
          hasShelfForScope: true,
          activeByCanonical: new Map([
            [
              "m1",
              {
                sortOrder: 5,
                displayNameOverride: "Custom",
                sourceLabelOverride: "第三方",
              },
            ],
          ]),
        },
      ],
    ]);
    const meta = getShelfMetaForCanonical(idx, "m1", {
      appTag: "canvas",
      sceneKey: "pro2-video",
    });
    expect(meta?.sortOrder).toBe(5);
    expect(meta?.displayNameOverride).toBe("Custom");
  });
});

describe("loadShelfIndexForApp", () => {
  it("exports load function", () => {
    expect(typeof loadShelfIndexForApp).toBe("function");
  });
});
