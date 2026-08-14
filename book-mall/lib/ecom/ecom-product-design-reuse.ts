import { Prisma } from "@prisma/client";

import { clampPlatformCounts, getEcomPlatformSpec } from "@/lib/ecom/ecom-platform-spec";
import type { ProductDesignWorkflowSnapshot } from "@/lib/ecom/ecom-product-design-snapshot";
import { findProductDesignSnapshotInProjectMeta } from "@/lib/ecom/ecom-library-service";
import {
  getProductDesignProject,
  type EcomProductDesignProjectDto,
} from "@/lib/ecom/ecom-product-design-service";
import {
  mergeProductDesign,
  normalizeEcomProjectModule,
  sanitizeProductDesignChatMessages,
  sanitizeProductDesignReferences,
  type ProductDesign,
} from "@/lib/ecom/ecom-product-design-types";
import { prisma } from "@/lib/prisma";

function stripGeneratedOutputs(design: ProductDesign | null): ProductDesign | null {
  if (!design) return null;
  return {
    ...design,
    mainImages: design.mainImages.map((m) => ({
      ...m,
      imageUrl: undefined,
      assetId: undefined,
    })),
    detailPages: design.detailPages.map((d) => ({
      ...d,
      imageUrl: undefined,
      assetId: undefined,
    })),
  };
}

/** 从工作流快照创建新项目（去掉已生成成图，保留文案/Prompt/参考图） */
export async function createProductDesignProjectFromSnapshot(
  userId: string,
  snap: ProductDesignWorkflowSnapshot,
): Promise<EcomProductDesignProjectDto> {
  const module = normalizeEcomProjectModule(snap.module);
  const spec = getEcomPlatformSpec(snap.platform);
  const clamped = clampPlatformCounts(snap.platform, snap.settings);
  const design = stripGeneratedOutputs(snap.design);
  const prevMeta = snap.meta ?? {};

  const row = await prisma.ecomProductDesignProject.create({
    data: {
      userId,
      module,
      title: snap.title.slice(0, 120),
      platform: spec.code,
      status: "draft",
      brief: (snap.brief ?? {}) as Prisma.InputJsonValue,
      settings: {
        ...snap.settings,
        mainImageCount: clamped.mainImageCount,
        detailPageCount: clamped.detailPageCount,
        mainImageRatio: clamped.mainImageRatio,
        detailPageRatio: clamped.detailPageRatio,
      } as Prisma.InputJsonValue,
      references: sanitizeProductDesignReferences(snap.references) as Prisma.InputJsonValue,
      chatHistory: sanitizeProductDesignChatMessages(snap.chatHistory) as Prisma.InputJsonValue,
      design: design
        ? (mergeProductDesign(null, design) as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      meta: {
        ...prevMeta,
        reusedFrom: {
          savedAt: snap.savedAt,
          title: snap.title,
          at: new Date().toISOString(),
        },
        setupPhase: snap.references.some((r) => r.role === "product")
          ? "workflow-choice"
          : "product",
      } as Prisma.InputJsonValue,
    },
  });

  const project = await getProductDesignProject(userId, row.id);
  if (!project) throw new Error("创建项目失败");
  return project;
}

/** 打开已有项目，或将历史快照复用到新项目 */
export async function reuseProductDesignLibraryItem(
  userId: string,
  projectId: string,
  savedAt?: string,
): Promise<EcomProductDesignProjectDto> {
  const source = await getProductDesignProject(userId, projectId);
  if (!source) throw new Error("项目不存在");

  if (!savedAt) return source;

  const snap = findProductDesignSnapshotInProjectMeta(source.meta, savedAt);
  if (!snap) throw new Error("找不到该版本快照");
  return createProductDesignProjectFromSnapshot(userId, snap);
}
