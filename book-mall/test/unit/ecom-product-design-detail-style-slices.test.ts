import { describe, expect, it } from "vitest";

import {
  refUrlsForDetailScreen,
  referencesForDetailScreenLegend,
} from "@/lib/ecom/ecom-product-design-ref-rules";

describe("refUrlsForDetailScreen", () => {
  const refs = [
    {
      id: "1",
      role: "detail-style" as const,
      label: "长图",
      ossUrl: "https://example.com/full.jpg",
    },
    {
      id: "2",
      role: "product" as const,
      label: "商品",
      ossUrl: "https://example.com/p.jpg",
    },
    {
      id: "3",
      role: "model" as const,
      label: "模特",
      ossUrl: "https://example.com/m.jpg",
    },
  ];

  it("uses slice instead of full detail-style", () => {
    const slice = "https://example.com/slice-2.jpg";
    const packed = refUrlsForDetailScreen(refs, "wan2.7-image-pro", slice);
    expect(packed.urls).toContain(slice);
    expect(packed.urls).toContain("https://example.com/p.jpg");
    expect(packed.urls).toContain("https://example.com/m.jpg");
    expect(packed.urls).not.toContain("https://example.com/full.jpg");
  });

  it("legend replaces detail-style with slice label", () => {
    const slice = "https://example.com/slice-2.jpg";
    const legendRefs = referencesForDetailScreenLegend(refs, 2, slice);
    expect(legendRefs.filter((r) => r.role === "detail-style")).toHaveLength(1);
    expect(legendRefs.find((r) => r.role === "detail-style")?.ossUrl).toBe(slice);
    expect(legendRefs.find((r) => r.role === "detail-style")?.label).toContain("第 2 屏");
  });
});
