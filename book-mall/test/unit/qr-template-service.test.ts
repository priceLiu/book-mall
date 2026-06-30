import { describe, expect, it } from "vitest";

import { buildPlatformCatalogWhere, rowToJson } from "@/lib/quick-replica/qr-template-service";

describe("qr-template-service", () => {
  it("rowToJson marks platform catalog rows as source catalog", () => {
    const json = rowToJson({
      id: "clxyz",
      category: "video",
      kind: "motion-sync",
      toolKey: "motion-sync",
      title: "多人动作同步",
      thumbnailUrl: "https://example.com/thumb.webp",
      badges: [],
      ownerUserId: null,
      visibility: "public",
      isPlatformCatalog: true,
      reference: { slots: {}, prompt: { text: "p", locale: "zh" }, model: { role: "VIDEO", modelKey: "kling-2.6/motion-control", params: {} } },
      output: null,
      sortOrder: 0,
      gatewayRequestLogId: null,
      createdAt: new Date("2026-06-20T00:00:00.000Z"),
      updatedAt: new Date("2026-06-20T00:00:00.000Z"),
    });
    expect(json.source).toBe("catalog");
  });

  it("buildPlatformCatalogWhere matches motion-sync catalog without toolKey", () => {
    const where = buildPlatformCatalogWhere({
      category: "video",
      kind: "motion-sync",
      toolKey: "motion-sync",
    });
    expect(where).toMatchObject({
      isPlatformCatalog: true,
      visibility: "public",
      category: "video",
      kind: "motion-sync",
    });
    expect(where.OR).toEqual([
      { toolKey: "motion-sync" },
      { kind: "motion-sync", toolKey: null },
    ]);
  });
});
