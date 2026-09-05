import { describe, expect, it } from "vitest";

import {
  buildAdminTemplateGalleryWhere,
  matchesAdminTemplateGalleryFilters,
} from "@/lib/ecom/ecom-template-gallery-service";

describe("admin ecom template gallery page filters", () => {
  const row = {
    id: "womens-001",
    title: "女装主图",
    mediaKind: "image" as const,
    promptText: "  a dress  ",
  };

  it("keeps rows that match media / search / empty prompt", () => {
    expect(matchesAdminTemplateGalleryFilters(row, { mediaKind: "image" })).toBe(true);
    expect(matchesAdminTemplateGalleryFilters(row, { mediaKind: "video" })).toBe(false);
    expect(matchesAdminTemplateGalleryFilters(row, { q: "womens" })).toBe(true);
    expect(matchesAdminTemplateGalleryFilters(row, { q: "男装" })).toBe(false);
    expect(matchesAdminTemplateGalleryFilters(row, { noPromptOnly: true })).toBe(false);
    expect(
      matchesAdminTemplateGalleryFilters(
        { ...row, promptText: "   " },
        { noPromptOnly: true },
      ),
    ).toBe(true);
  });

  it("requires category and AND-combines optional filters", () => {
    expect(buildAdminTemplateGalleryWhere({ category: "womens" })).toEqual({
      deletedAt: null,
      category: "womens",
    });
    expect(
      buildAdminTemplateGalleryWhere({
        category: "bags",
        mediaKind: "video",
        noPromptOnly: true,
        q: "pack",
      }),
    ).toEqual({
      deletedAt: null,
      category: "bags",
      mediaKind: "video",
      AND: [
        { OR: [{ promptText: null }, { promptText: "" }] },
        {
          OR: [
            { title: { contains: "pack", mode: "insensitive" } },
            { id: { contains: "pack", mode: "insensitive" } },
          ],
        },
      ],
    });
  });
});
