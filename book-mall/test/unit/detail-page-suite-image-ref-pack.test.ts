import { describe, expect, it } from "vitest";

import {
  appendDetailPageSuiteImageRefLegend,
  resolveDetailPageSuiteImageRefPack,
} from "@/lib/ecom/detail-page-suite/image-ref-pack";

describe("resolveDetailPageSuiteImageRefPack", () => {
  it("orders model refs before product refs when both exist", () => {
    const pack = resolveDetailPageSuiteImageRefPack(
      [
        { id: "p1", role: "product", ossUrl: "https://x/p.png", label: "平铺" },
        { id: "m1", role: "model", ossUrl: "https://x/m.png", label: "模特A" },
      ],
      "wan2.7-image-pro",
    );
    expect(pack.urls).toEqual(["https://x/m.png", "https://x/p.png"]);
    expect(pack.modelCount).toBe(1);
    expect(pack.productCount).toBe(1);
    expect(pack.styleFirst).toBe(true);
  });

  it("ignores reference_suite", () => {
    const pack = resolveDetailPageSuiteImageRefPack(
      [
        {
          id: "s1",
          role: "reference_suite",
          ossUrl: "https://x/suite.png",
          label: "竞品",
        },
        { id: "p1", role: "product", ossUrl: "https://x/p.png", label: "商品" },
      ],
      "wan2.7-image-pro",
    );
    expect(pack.urls).toEqual(["https://x/p.png"]);
    expect(pack.productCount).toBe(1);
  });
});

describe("appendDetailPageSuiteImageRefLegend", () => {
  it("requires @模特1 when slot involves model", () => {
    const pack = resolveDetailPageSuiteImageRefPack(
      [{ id: "m1", role: "model", ossUrl: "https://x/m.png", label: "模特A" }],
      "wan2.7-image-pro",
    );
    const out = appendDetailPageSuiteImageRefLegend("场景描述", pack, true);
    expect(out).toContain("@模特1");
    expect(out).toContain("同一人");
  });
});
