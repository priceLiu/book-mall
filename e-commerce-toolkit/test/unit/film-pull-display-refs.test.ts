import { describe, expect, it } from "vitest";

import {
  parseFilmPullMentionRefIds,
  resolveFilmPullShotDisplayRefIds,
} from "@/lib/film-pull-refs";

const characterRefs = [
  {
    id: "ref-film-pull-model-1",
    ossUrl: "https://example.com/model.jpg",
    label: "模特 1",
  },
  {
    id: "ref-film-pull-product-1",
    ossUrl: "https://example.com/product.jpg",
    label: "产品 1",
  },
];

describe("resolveFilmPullShotDisplayRefIds", () => {
  it("infers product ref from @图片2 in imagePrompt when shot ids empty", () => {
    const ids = resolveFilmPullShotDisplayRefIds(
      {
        shotNo: 5,
        modelRefIds: [],
        productRefIds: [],
        imagePrompt: "@图片1 @图片2 中心构图",
        videoPrompt: "",
      },
      { characterRefs, refMatch: null },
    );
    expect(ids.modelRefIds).toEqual(["ref-film-pull-model-1"]);
    expect(ids.productRefIds).toEqual(["ref-film-pull-product-1"]);
  });

  it("falls back to refMatch when plan shot has empty ids", () => {
    const ids = resolveFilmPullShotDisplayRefIds(
      {
        shotNo: 2,
        modelRefIds: [],
        productRefIds: [],
        imagePrompt: "",
        videoPrompt: "",
      },
      {
        characterRefs,
        refMatch: {
          shots: [
            {
              shotNo: 2,
              modelRefIds: ["ref-film-pull-model-1"],
              productRefIds: ["ref-film-pull-product-1"],
            },
          ],
        },
      },
    );
    expect(ids.productRefIds).toEqual(["ref-film-pull-product-1"]);
  });
});

describe("parseFilmPullMentionRefIds", () => {
  it("maps @图片 tokens to model/product ids", () => {
    expect(parseFilmPullMentionRefIds("@图片1 @图片2", characterRefs)).toEqual({
      modelRefIds: ["ref-film-pull-model-1"],
      productRefIds: ["ref-film-pull-product-1"],
    });
  });
});
