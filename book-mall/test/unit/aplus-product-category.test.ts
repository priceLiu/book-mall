import { describe, expect, it } from "vitest";

import {
  buildAplusProductCategoryContextLines,
  getAplusProductCategorySteps,
  patchAplusProductCategoryBrief,
} from "@/lib/ecom/detail-page-aplus/aplus-product-category";
import { buildDetailPageSuiteBriefContextBlock } from "@/lib/ecom/detail-page-suite/brief-context";

describe("getAplusProductCategorySteps", () => {
  it("returns gender + style for fashion", () => {
    const steps = getAplusProductCategorySteps("fashion_apparel");
    expect(steps.map((s) => s.key)).toEqual(["genderCategory", "styleCategory"]);
  });

  it("returns product category + sub for digital", () => {
    const steps = getAplusProductCategorySteps("digital_3c");
    expect(steps.map((s) => s.key)).toEqual(["productCategory", "productSubCategory"]);
  });
});

describe("buildAplusProductCategoryContextLines", () => {
  it("includes L1–L3 labels when set", () => {
    const lines = buildAplusProductCategoryContextLines({
      productVertical: "fashion_apparel",
      genderCategory: "女装",
      styleCategory: "连衣裙",
    });
    expect(lines).toContain("产品一级品类：服装");
    expect(lines).toContain("性别品类：女装");
    expect(lines).toContain("款式品类：连衣裙");
  });
});

describe("patchAplusProductCategoryBrief", () => {
  it("clears child when parent changes", () => {
    const next = patchAplusProductCategoryBrief(
      {
        productVertical: "digital_3c",
        productCategory: "手机",
        productSubCategory: "旗舰机",
      },
      "digital_3c",
      { productCategory: "耳机", productSubCategory: undefined },
    );
    expect(next.productCategory).toBe("耳机");
    expect(next.productSubCategory).toBeUndefined();
  });
});

describe("brief context with aplus category", () => {
  it("avoids duplicate gender lines", () => {
    const block = buildDetailPageSuiteBriefContextBlock({
      productVertical: "bags",
      genderCategory: "女包",
      styleCategory: "托特包",
      productDesc: "牛皮托特",
    });
    const genderCount = block.split("性别定位").length - 1;
    expect(genderCount).toBeLessThanOrEqual(1);
    expect(block).toContain("产品一级品类：包包");
  });
});