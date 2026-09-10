import { describe, expect, it } from "vitest";

import {
  appendOutfitModelGalleryItems,
  normalizeOutfitModelGalleryRefs,
  removeOutfitModelGalleryItem,
  syncPrimaryOutfitModelFromGallery,
} from "@/lib/ecom/ecom-outfit-model-gallery";

describe("ecom-outfit-model-gallery", () => {
  it("migrates legacy single model into gallery and syncs primary", () => {
    const refs = normalizeOutfitModelGalleryRefs({
      model: { ossUrl: "https://x/a.jpg", source: "upload", label: "旧模特" },
    });
    expect(refs.modelGallery).toHaveLength(1);
    expect(refs.model?.ossUrl).toBe("https://x/a.jpg");
  });

  it("uses first gallery item as primary model", () => {
    const refs = syncPrimaryOutfitModelFromGallery({
      modelGallery: [
        { id: "1", ossUrl: "https://x/1.jpg", source: "upload", label: "图1" },
        { id: "2", ossUrl: "https://x/2.jpg", source: "upload", label: "图2" },
      ],
    });
    expect(refs.model?.ossUrl).toBe("https://x/1.jpg");
    expect(refs.dressedImage).toBeUndefined();
  });

  it("append skips duplicate urls and respects max", () => {
    const refs = appendOutfitModelGalleryItems(
      {
        modelGallery: [{ id: "1", ossUrl: "https://x/1.jpg", source: "upload" }],
      },
      [
        { ossUrl: "https://x/1.jpg", source: "upload" },
        { ossUrl: "https://x/2.jpg", source: "upload", label: "新图" },
      ],
    );
    expect(refs.modelGallery).toHaveLength(2);
    expect(refs.model?.ossUrl).toBe("https://x/1.jpg");
  });

  it("remove reassigns primary to next item", () => {
    const refs = removeOutfitModelGalleryItem(
      {
        modelGallery: [
          { id: "1", ossUrl: "https://x/1.jpg", source: "upload" },
          { id: "2", ossUrl: "https://x/2.jpg", source: "upload" },
        ],
        model: { ossUrl: "https://x/1.jpg", source: "upload" },
      },
      "1",
    );
    expect(refs.modelGallery).toHaveLength(1);
    expect(refs.model?.ossUrl).toBe("https://x/2.jpg");
  });
});
