import { describe, expect, it } from "vitest";

import { resolveProductDesignStatusAfterGenBatch } from "@/lib/ecom/ecom-product-design-status";

describe("resolveProductDesignStatusAfterGenBatch", () => {
  it("clears generating after failed detail batch when main empty", () => {
    expect(
      resolveProductDesignStatusAfterGenBatch({
        mainImages: [],
        detailPages: [{ index: 1, imageUrl: "" }],
      }),
    ).toBe("draft");
  });

  it("returns main_ready when main done and detail partial", () => {
    expect(
      resolveProductDesignStatusAfterGenBatch({
        mainImages: [{ index: 1, imageUrl: "https://x/a.jpg" }],
        detailPages: [
          { index: 1, imageUrl: "https://x/d1.jpg" },
          { index: 2, imageUrl: "" },
        ],
      }),
    ).toBe("main_ready");
  });
});
