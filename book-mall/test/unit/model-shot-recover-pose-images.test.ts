import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelShotPlan } from "@/lib/ecom/ecom-model-shot-types";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ecomAsset: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

describe("recoverModelShotPoseImagesFromAssets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("backfills missing pose image from ecomAsset meta", async () => {
    findMany.mockResolvedValue([
      {
        id: "asset-3",
        ossUrl: "https://example.com/pose-3.png",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        meta: { projectId: "proj-1", index: 3 },
      },
    ]);

    const plan: ModelShotPlan = {
      status: "confirmed",
      items: [{ index: 3, title: "姿势 3", prompt: "p", status: "generating" }],
    };

    const { recoverModelShotPoseImagesFromAssets } = await import(
      "@/lib/ecom/model-shot/recover-pose-images-from-assets"
    );

    const recovered = await recoverModelShotPoseImagesFromAssets({
      userId: "user-1",
      projectId: "proj-1",
      plan,
    });

    expect(recovered?.items[0]?.imageUrl).toBe("https://example.com/pose-3.png");
    expect(recovered?.items[0]?.status).toBe("ready");
  });
});
