import { describe, expect, it, vi } from "vitest";

import { recoverProductDesignImagesFromAssets } from "@/lib/ecom/ecom-product-design-recover-slot-images";
import type { ProductDesign } from "@/lib/ecom/ecom-product-design-types";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ecomAsset: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const design: ProductDesign = {
  mainImages: [],
  detailPages: [
    {
      index: 6,
      title: "第 6 屏",
      purpose: "",
      layers: { title: "第 6 屏", bullets: [] },
      emphasis: { bold: [], color: [] },
    },
  ],
  buyingReasons: [],
  detailOutline: [],
};

describe("recoverProductDesignImagesFromAssets", () => {
  it("回填缺失的详情第 6 屏", async () => {
    vi.mocked(prisma.ecomAsset.findMany).mockResolvedValue([
      {
        id: "asset-6",
        ossUrl: "https://oss.example/6.png",
        prompt: "prompt six",
        module: "detail-page",
        createdAt: new Date("2026-01-02"),
        meta: {
          projectId: "proj-1",
          kind: "detail_page",
          index: 6,
          source: "product-creation",
        },
      },
    ] as never);

    const recovered = await recoverProductDesignImagesFromAssets(
      "user-1",
      "proj-1",
      design,
    );
    expect(recovered?.detailPages[0]?.imageUrl).toBe("https://oss.example/6.png");
    expect(recovered?.detailPages[0]?.assetId).toBe("asset-6");
  });
});
