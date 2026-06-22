import { describe, expect, it } from "vitest";

import {
  listBuiltinKindThumbTemplates,
  normalizeBuiltinQrTemplates,
} from "@/lib/quick-replica/builtin-kind-thumbs";
import { getBuiltinQrTemplates } from "@/lib/quick-replica/builtin-templates";
import { QR_KINDS_BY_CATEGORY } from "@/lib/quick-replica/qr-kinds";
import type { QrCategory, QrTemplateJson } from "@/lib/quick-replica/qr-types";

describe("builtin-kind-thumbs", () => {
  it("generates one thumb per registered kind", () => {
    const thumbs = listBuiltinKindThumbTemplates();
    const expected = Object.values(QR_KINDS_BY_CATEGORY).reduce((n, k) => n + k.length, 0);
    expect(thumbs).toHaveLength(expected);
    expect(new Set(thumbs.map((t) => `${t.category}:${t.kind}`)).size).toBe(expected);
  });

  it("uses OSS urls instead of picsum", () => {
    const upgraded = normalizeBuiltinQrTemplates([
      {
        schemaVersion: 1,
        id: "builtin-image-create",
        category: "image",
        kind: "create-image",
        title: "创建图像",
        thumbnailUrl: "https://picsum.photos/seed/create/400/300",
        source: "builtin",
        visibility: "public",
        reference: {
          slots: {},
          prompt: { text: "x", locale: "zh" },
          model: { role: "IMAGE", modelKey: "lib-nano-pro", params: {} },
        },
        sortOrder: 100,
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
      },
    ]);
    expect(upgraded[0]?.thumbnailUrl).toContain("tool-mall.oss-cn-guangzhou.aliyuncs.com");
    expect(upgraded.some((t) => t.kind === "expand-image")).toBe(true);
  });

  it("every kind has a non-picsum builtin after normalize", () => {
    const items = getBuiltinQrTemplates();
    const byKind = new Map<string, QrTemplateJson>();
    for (const t of items) {
      if (t.id.startsWith("qr-")) continue;
      const key = `${t.category}:${t.kind}`;
      if (!byKind.has(key)) byKind.set(key, t);
    }
    for (const [category, kinds] of Object.entries(QR_KINDS_BY_CATEGORY) as [
      QrCategory,
      (typeof QR_KINDS_BY_CATEGORY)[QrCategory],
    ][]) {
      for (const def of kinds) {
        const hit = byKind.get(`${category}:${def.id}`);
        expect(hit, `missing builtin for ${category}/${def.id}`).toBeTruthy();
        expect(hit!.thumbnailUrl).toContain("oss-cn-guangzhou.aliyuncs.com");
        expect(hit!.thumbnailUrl).not.toContain("picsum.photos");
      }
    }
  });
});
