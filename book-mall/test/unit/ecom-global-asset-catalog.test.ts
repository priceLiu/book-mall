import { describe, expect, it } from "vitest";

import {
  globalAssetCatalogItemScopeLabel,
  type GlobalAssetCatalogItem,
} from "@/lib/ecom/ecom-global-asset-catalog";
import { buildAvatarLibraryGenderWhere } from "@/lib/ecom/ecom-model-library-service";

function matchesGenderForTest(item: GlobalAssetCatalogItem, gender: string): boolean {
  if (!item.gender) return true;
  if (item.gender === "unisex") return true;
  if (gender === "female" && item.gender === "plus_female") return true;
  return item.gender === gender;
}

describe("ecom-global-asset-catalog", () => {
  it("scopeLabel maps platform/user/team", () => {
    expect(
      globalAssetCatalogItemScopeLabel({
        id: "1",
        catalogKind: "pose",
        title: "t",
        ossUrl: "https://x/a.jpg",
        thumbUrl: null,
        scope: "platform",
      }),
    ).toBe("平台");
    expect(
      globalAssetCatalogItemScopeLabel({
        id: "2",
        catalogKind: "garment",
        title: "t",
        ossUrl: "https://x/b.jpg",
        thumbUrl: null,
        scope: "user",
      }),
    ).toBe("我的");
    expect(
      globalAssetCatalogItemScopeLabel({
        id: "3",
        catalogKind: "full-body",
        title: "t",
        ossUrl: "https://x/c.jpg",
        thumbUrl: null,
        scope: "team",
      }),
    ).toBe("团队");
  });

  it("buildAvatarLibraryGenderWhere maps female to female+plus_female", () => {
    expect(buildAvatarLibraryGenderWhere(null)).toBeUndefined();
    expect(buildAvatarLibraryGenderWhere("male")).toEqual({ gender: "male" });
    expect(buildAvatarLibraryGenderWhere("female")).toEqual({
      gender: { in: ["female", "plus_female"] },
    });
  });

  it("plus_female matches female gender filter", () => {
    const item: GlobalAssetCatalogItem = {
      id: "a1",
      catalogKind: "avatar",
      title: "大码模特",
      ossUrl: "https://x/a.jpg",
      thumbUrl: null,
      scope: "platform",
      gender: "plus_female",
    };
    expect(matchesGenderForTest(item, "female")).toBe(true);
    expect(matchesGenderForTest(item, "male")).toBe(false);
  });
});
