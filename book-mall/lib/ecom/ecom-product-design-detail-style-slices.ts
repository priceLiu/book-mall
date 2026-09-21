import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { prepareWan27ReferenceBuffer } from "@/lib/ecom/ecom-dashscope-image-normalize";
import {
  filterProductDesignReferencesByRole,
  type ImageGenPlan,
  type ImageGenPlanItem,
  type ProductDesignReference,
} from "@/lib/ecom/ecom-product-design-types";
import {
  getProductDesignProject,
  updateProductDesignProject,
} from "@/lib/ecom/ecom-product-design-service";

async function downloadImageBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl.trim());
  if (!res.ok) {
    throw new Error(`下载详情参考长图失败 HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** 将详情页风格长图按屏数均分竖条，逐条规范化后上传 OSS */
export async function materializeDetailStyleSliceUrls(opts: {
  userId: string;
  sourceOssUrl: string;
  sliceCount: number;
}): Promise<string[]> {
  const sliceCount = Math.max(1, Math.min(Math.floor(opts.sliceCount), 24));
  const input = await downloadImageBuffer(opts.sourceOssUrl);
  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error("无法读取详情页风格参考图尺寸");
  }

  const baseSliceH = Math.floor(height / sliceCount);
  if (baseSliceH < 1) {
    throw new Error("详情长图过短，无法按屏数切分");
  }

  const urls: string[] = [];
  for (let i = 0; i < sliceCount; i++) {
    const top = i * baseSliceH;
    const extractH = i === sliceCount - 1 ? height - top : baseSliceH;
    const cropped = await sharp(input, { failOn: "none" })
      .rotate()
      .extract({
        left: 0,
        top,
        width,
        height: extractH,
      })
      .toBuffer();
    const prepared = await prepareWan27ReferenceBuffer(cropped);
    const url = await uploadCanvasUserBuffer({
      userId: opts.userId,
      ext: "jpg",
      buf: prepared,
      contentType: "image/jpeg",
    });
    urls.push(url);
  }
  return urls;
}

export function detailStyleSlicePlanStale(
  plan: ImageGenPlan | undefined,
  primaryStyleRef: ProductDesignReference | undefined,
): boolean {
  if (!plan || plan.target !== "detail") return true;
  if (!primaryStyleRef) return false;
  const meta = plan.styleSliceMeta;
  if (!meta) return true;
  if (meta.sourceRefId !== primaryStyleRef.id) return true;
  if (meta.sourceOssUrl !== primaryStyleRef.ossUrl) return true;
  if (meta.sliceCount !== plan.items.length) return true;
  return plan.items.some((item) => !item.styleSliceOssUrl?.trim());
}

export async function attachDetailStyleSlicesToPlan(opts: {
  userId: string;
  projectId: string;
  plan: ImageGenPlan;
  primaryStyleRef: ProductDesignReference;
}): Promise<ImageGenPlan> {
  const sliceUrls = await materializeDetailStyleSliceUrls({
    userId: opts.userId,
    sourceOssUrl: opts.primaryStyleRef.ossUrl,
    sliceCount: opts.plan.items.length,
  });
  const items: ImageGenPlanItem[] = opts.plan.items.map((item, idx) => ({
    ...item,
    styleSliceOssUrl: sliceUrls[idx] ?? sliceUrls[sliceUrls.length - 1],
  }));
  return {
    ...opts.plan,
    items,
    styleSliceMeta: {
      sourceRefId: opts.primaryStyleRef.id,
      sourceOssUrl: opts.primaryStyleRef.ossUrl,
      sliceCount: items.length,
    },
  };
}

/** 拆解或出图前：为详情计划写入各屏切片 URL */
export async function ensureDetailStyleSlicesOnPlan(opts: {
  userId: string;
  projectId: string;
}): Promise<ImageGenPlan | undefined> {
  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project?.design) return undefined;
  const plan = project.design.imageGenPlans?.detail;
  if (!plan?.items.length) return plan;

  const styleRefs = filterProductDesignReferencesByRole(project.references, [
    "detail-style",
  ]);
  const primary = styleRefs[0];
  if (!primary) return plan;

  if (!detailStyleSlicePlanStale(plan, primary)) return plan;

  const nextPlan = await attachDetailStyleSlicesToPlan({
    userId: opts.userId,
    projectId: opts.projectId,
    plan,
    primaryStyleRef: primary,
  });

  await updateProductDesignProject(opts.userId, opts.projectId, {
    designPatch: {
      imageGenPlans: {
        ...(project.design.imageGenPlans ?? {}),
        detail: nextPlan,
      },
    },
  });

  return nextPlan;
}
