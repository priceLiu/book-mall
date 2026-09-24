import { describe, expect, it } from "vitest";

import { buildSaveItems } from "@/lib/image-layer-save-items";
import type { ImageLayerStack } from "@/lib/image-layer-types";

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
    expect(items[0]?.libraryTitle).toBe("图片分层结果");
  });

  it("keeps the working image when layers exist", () => {
    const items = buildSaveItems("https://oss.example/edited.jpg", stack, null);
    expect(items[0]?.id).toBe("flat");
    expect(items.some((i) => i.id === "bg")).toBe(true);
    expect(items.some((i) => i.id === "l1")).toBe(true);
  });
});
