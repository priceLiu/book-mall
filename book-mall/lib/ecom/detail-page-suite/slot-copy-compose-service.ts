import { composeEcomCopyOverlayImage } from "@/lib/ecom/copy-overlay/compose-image";
import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";
import { prisma } from "@/lib/prisma";

import {
  getDetailPageSuiteHitProject,
  updateDetailPageSuiteHitProject,
} from "./project-service";
import { ECOM_DETAIL_PAGE_SUITE_HIT_MODULE, type DetailPageSuiteSlot } from "./types";

function appendComposedImageVersion(
  slot: DetailPageSuiteSlot,
  url: string,
  assetId: string,
  meta?: { exportTargetId?: string; platformLabel?: string },
): DetailPageSuiteSlot {
  const prevHistory =
    Array.isArray(slot.imageHistory) && slot.imageHistory.length > 0
      ? slot.imageHistory.filter((v) => v.url?.trim())
      : slot.imageUrl?.trim()
        ? [
            {
              url: slot.imageUrl.trim(),
              assetId: slot.assetId,
              createdAt: new Date(0).toISOString(),
            },
          ]
        : [];
  const version = {
    url,
    assetId,
    createdAt: new Date().toISOString(),
    ...(meta?.exportTargetId ? { exportTargetId: meta.exportTargetId } : {}),
    ...(meta?.platformLabel ? { platformLabel: meta.platformLabel } : {}),
  };
  const imageHistory = [...prevHistory, version];
  return {
    ...slot,
    imageUrl: url,
    assetId,
    imageHistory,
    activeImageIndex: imageHistory.length - 1,
  };
}

export async function composeDetailPageSuiteHitSlotCopy(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  slotKey: string;
  baseImageUrl: string;
  overlay: EcomCopyOverlay;
  slotCopy?: string;
  persistOverlay?: boolean;
}): Promise<{ url: string; project: NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteHitProject>>> }> {
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const mod = project.suite.modules.find((m) => m.module_id === opts.moduleId);
  if (!mod) throw new Error("模块不存在");
  const slotIndex = mod.slots.findIndex((s) => s.item_key === opts.slotKey);
  if (slotIndex < 0) throw new Error("点位不存在");

  const { url, overlay } = await composeEcomCopyOverlayImage({
    userId: opts.userId,
    baseImageUrl: opts.baseImageUrl,
    overlay: opts.overlay,
    syncText: opts.slotCopy,
  });

  const copyTrim = opts.slotCopy?.trim();
  const slotTitle = `${mod.module_name} · ${mod.slots[slotIndex]!.item_label}`.slice(0, 80);
  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
      kind: "image",
      title: slotTitle,
      prompt: mod.slots[slotIndex]!.positive_prompt,
      ossUrl: url,
      thumbnailUrl: url,
      meta: {
        projectId: opts.projectId,
        source: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
        moduleId: opts.moduleId,
        slotKey: opts.slotKey,
        composedCopyOverlay: true,
      },
    },
  });

  const modules = project.suite.modules.map((m) => {
    if (m.module_id !== opts.moduleId) return m;
    const slots = m.slots.map((s, i) => {
      if (i !== slotIndex) return s;
      let next: DetailPageSuiteSlot = appendComposedImageVersion(s, url, asset.id);
      if (opts.persistOverlay !== false) {
        next = {
          ...next,
          copy_overlay: overlay,
          burn_copy_in_image: false,
          ...(copyTrim ? { slot_copy: copyTrim, slot_copy_ai: s.slot_copy_ai ?? copyTrim } : {}),
        };
      }
      return next;
    });
    return { ...m, slots };
  });

  const updated = await updateDetailPageSuiteHitProject(opts.userId, opts.projectId, {
    suite: { ...project.suite, modules },
  });
  if (!updated) throw new Error("保存失败");
  return { url, project: updated };
}
