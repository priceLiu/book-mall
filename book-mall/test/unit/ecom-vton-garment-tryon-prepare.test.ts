import { describe, expect, it, vi } from "vitest";

import { prepareVtonGarmentUrlForTryon } from "@/lib/ecom/ecom-vton/garment-tryon-prepare";

vi.mock("@/lib/ecom/ecom-vton/garment-crop-normalize", () => ({
  tightenVtonGarmentUrlIfNeeded: vi.fn(async ({ garmentUrl }: { garmentUrl: string }) => garmentUrl),
}));

vi.mock("@/lib/ecom/ecom-dashscope-image-normalize", () => ({
  ensureDashscopeImageUrl: vi.fn(async ({ imageUrl }: { imageUrl: string }) => ({
    url: `${imageUrl}?norm=1`,
    normalized: true,
  })),
}));

describe("prepareVtonGarmentUrlForTryon", () => {
  it("dedupes identical garment URLs within one batch cache", async () => {
    const cache = new Map<string, string>();
    const userId = "u1";
    const source = "https://example.com/top.png";

    const first = await prepareVtonGarmentUrlForTryon({ userId, garmentUrl: source, cache });
    const second = await prepareVtonGarmentUrlForTryon({ userId, garmentUrl: source, cache });

    expect(first).toBe("https://example.com/top.png?norm=1");
    expect(second).toBe(first);
    expect(cache.size).toBe(1);
  });
});
