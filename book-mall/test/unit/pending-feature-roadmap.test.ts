import { describe, expect, it } from "vitest";

import {
  ADMIN_PENDING_FEATURE_ROADMAP_TITLES,
  isAdminPendingFeatureRoadmapTitle,
  resolveAdminPendingFeatureListKind,
} from "@/lib/admin/pending-feature-roadmap";

describe("isAdminPendingFeatureRoadmapTitle", () => {
  it("matches the roadmap titles", () => {
    expect(ADMIN_PENDING_FEATURE_ROADMAP_TITLES).toHaveLength(20);
    for (const title of ADMIN_PENDING_FEATURE_ROADMAP_TITLES) {
      expect(isAdminPendingFeatureRoadmapTitle(title)).toBe(true);
    }
    expect(isAdminPendingFeatureRoadmapTitle("拉片")).toBe(true);
    expect(isAdminPendingFeatureRoadmapTitle("ep")).toBe(true);
    expect(isAdminPendingFeatureRoadmapTitle("image out painting")).toBe(true);
  });

  it("does not match docs import titles", () => {
    expect(isAdminPendingFeatureRoadmapTitle("画布提示词")).toBe(false);
    expect(isAdminPendingFeatureRoadmapTitle("一键发布平台")).toBe(false);
  });
});

describe("resolveAdminPendingFeatureListKind", () => {
  it("prefers stored listKind over title heuristics", () => {
    expect(
      resolveAdminPendingFeatureListKind({
        listKind: "PENDING",
        title: "拉片",
      }),
    ).toBe("PENDING");
    expect(
      resolveAdminPendingFeatureListKind({
        listKind: "FEATURE",
        title: "画布提示词",
      }),
    ).toBe("FEATURE");
  });

  it("falls back to roadmap title when listKind missing", () => {
    expect(resolveAdminPendingFeatureListKind({ title: "拉片" })).toBe("FEATURE");
    expect(resolveAdminPendingFeatureListKind({ title: "画布提示词" })).toBe(
      "PENDING",
    );
  });
});
