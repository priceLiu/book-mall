import { describe, expect, it } from "vitest";

import { buildSaveItems } from "@/lib/image-layer-save-items";
import {
  appendSavedSessionImage,
  explicitSavedSessionImages,
  mergeSavedSessionImages,
  type ImageLayerStack,
} from "@/lib/image-layer-types";

const stack: ImageLayerStack = {
  sourceImageUrl: "https://oss.example/edited.jpg",
  background: {
    id: "bg",
    url: "https://oss.example/bg.jpg",
    zIndex: 0,
    isBackground: true,
  },
  layers: [
    {
      id: "l1",
      url: "https://oss.example/boy.png",
      zIndex: 1,
      isBackground: false,
    },
  ],
};

describe("buildSaveItems", () => {
  it("lists the generated flat result for library save", () => {
    const items = buildSaveItems(
      "https://oss.example/edited.jpg",
      null,
      "https://oss.example/original.jpg",
    );
    expect(items.map((i) => i.id)).toEqual(["flat", "original"]);
    expect(items[0]?.libraryTitle).toBe("图片处理结果");
  });

  it("keeps the working image when layers exist", () => {
    const items = buildSaveItems("https://oss.example/edited.jpg", stack, null);
    expect(items[0]?.id).toBe("flat");
    expect(items.some((i) => i.id === "bg")).toBe(true);
    expect(items.some((i) => i.id === "l1")).toBe(true);
  });

  it("appends unique saved session images", () => {
    const once = appendSavedSessionImage([], {
      url: "https://oss.example/a.png",
      title: "A",
    });
    const twice = appendSavedSessionImage(once, {
      url: "https://oss.example/a.png",
      title: "A2",
    });
    expect(twice).toHaveLength(1);
    expect(twice[0]?.title).toBe("A2");
    expect(twice[0]?.source).toBe("library");
  });

  it("drops auto-seeded originals from the left-pane session", () => {
    const list = explicitSavedSessionImages(
      [
        { url: "https://oss.example/original.jpg", title: "原图" },
        { url: "https://oss.example/saved.png", title: "图片处理结果", source: "library" },
      ],
      ["https://oss.example/original.jpg"],
    );
    expect(list.map((row) => row.url)).toEqual(["https://oss.example/saved.png"]);
  });

  it("merges library assets into the left-pane session", () => {
    const merged = mergeSavedSessionImages(
      [
        { url: "https://oss.example/a.png", title: "A", source: "library" },
        { url: "https://oss.example/b.png", title: "B", source: "library" },
      ],
      [{ url: "https://oss.example/a.png", title: "A-dup" }],
    );
    expect(merged.map((row) => row.url)).toEqual([
      "https://oss.example/a.png",
      "https://oss.example/b.png",
    ]);
  });
});
