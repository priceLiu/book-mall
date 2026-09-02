import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelShotProject } from "@/lib/ecom/ecom-model-shot-types";

const generateEcomImage = vi.fn();
const getEcomModelShotProject = vi.fn();
const updateEcomModelShotProject = vi.fn();
const assertEcomToolkitGatewayAccess = vi.fn();
const claimModelShotPoseImageGeneration = vi.fn();
const clearModelShotPoseImagesPending = vi.fn();
const findFirst = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/ecom/ecom-model-shot-pending-images", () => ({
  claimModelShotPoseImageGeneration: (...args: unknown[]) =>
    claimModelShotPoseImageGeneration(...args),
  clearModelShotPoseImagesPending: (...args: unknown[]) =>
    clearModelShotPoseImagesPending(...args),
}));

vi.mock("@/lib/ecom/ecom-image-gen-invoke", () => ({
  generateEcomImage: (...args: unknown[]) => generateEcomImage(...args),
}));

vi.mock("@/lib/ecom/ecom-gateway-auth", () => ({
  assertEcomToolkitGatewayAccess: (...args: unknown[]) =>
    assertEcomToolkitGatewayAccess(...args),
}));

vi.mock("@/lib/ecom/ecom-model-shot-service", () => ({
  getEcomModelShotProject: (...args: unknown[]) => getEcomModelShotProject(...args),
  updateEcomModelShotProject: (...args: unknown[]) =>
    updateEcomModelShotProject(...args),
}));

vi.mock("@/lib/ecom/ecom-catalog-lock", () => ({
  touchCatalogLockOnProjectUse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ecomAsset: {
      create: vi.fn().mockResolvedValue({ id: "asset-1" }),
    },
    ecomModelShotProject: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}));

function confirmedProject(): ModelShotProject {
  return {
    id: "proj-1",
    title: "test",
    module: "model-shot",
    status: "draft",
    brief: { styles: ["优雅"] },
    settings: { imageModelKey: "nano-banana-pro" },
    references: [
      {
        id: "g1",
        role: "garment",
        source: "upload",
        ossUrl: "https://example.com/g.jpg",
      },
      {
        id: "m1",
        role: "model",
        source: "model-library",
        ossUrl: "https://example.com/m.jpg",
      },
    ],
    chatHistory: [],
    plan: {
      status: "confirmed",
      items: [
        {
          index: 1,
          title: "姿势 1",
          prompt: "model wearing garment, standing",
          status: "pending",
        },
      ],
    },
    meta: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("generateModelShotImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertEcomToolkitGatewayAccess.mockResolvedValue(undefined);
    claimModelShotPoseImageGeneration.mockImplementation(
      async (_projectId: string, indexes: number[]) => indexes,
    );
    clearModelShotPoseImagesPending.mockResolvedValue(undefined);
    updateMany.mockResolvedValue({ count: 1 });
    updateEcomModelShotProject.mockImplementation(
      async (_userId: string, _id: string, patch: Partial<ModelShotProject>) => {
        const base = confirmedProject();
        return { ...base, ...patch };
      },
    );
  });

  it("invokes generateEcomImage and writes imageUrl via optimistic patch", async () => {
    let project = confirmedProject();
    getEcomModelShotProject.mockImplementation(async () => project);
    findFirst.mockImplementation(async () => ({
      plan: project.plan,
      updatedAt: new Date(project.updatedAt),
    }));
    updateMany.mockImplementation(async (_args: unknown) => {
      project = {
        ...project,
        plan: {
          ...project.plan,
          items: project.plan.items.map((item) =>
            item.index === 1
              ? {
                  ...item,
                  imageUrl: "https://example.com/out.png",
                  assetId: "asset-1",
                  status: "ready",
                }
              : item,
          ),
        },
      };
      return { count: 1 };
    });
    generateEcomImage.mockResolvedValue("https://example.com/out.png");

    const { generateModelShotImages } = await import("@/lib/ecom/ecom-model-shot-image");

    const result = await generateModelShotImages({
      userId: "user-1",
      projectId: "proj-1",
      indexes: [1],
      modelKey: "nano-banana-pro",
    });

    expect(generateEcomImage).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalled();
    expect(result.generated).toBe(1);
    expect(result.project.plan.items[0]?.imageUrl).toBe("https://example.com/out.png");
  });
});
