import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  requireBrandViStep,
  type BrandViStepId,
} from "@/lib/ecom/ecom-brand-vi-steps";
import {
  getEcomBrandViProject,
  missingRequirementLabels,
  patchBrandViStep,
  readBrandViStepState,
} from "@/lib/ecom/ecom-brand-vi-service";
import {
  ECOM_BRAND_VI_MODULE,
  type BrandViComposeOutput,
} from "@/lib/ecom/ecom-brand-vi-types";
import { prisma } from "@/lib/prisma";

/**
 * 接收工作区 html2canvas 抓出的拼版 PNG，存 OSS 并登记为资产。
 *
 * 第 8–10 步不调生图模型：版式由 React 组件控制，浏览器负责抓图，服务端只负责落库，
 * 与微剧故事版的 sheetPngUrl 走同一条链。
 */
export async function saveBrandViComposePng(opts: {
  userId: string;
  projectId: string;
  stepId: BrandViStepId;
  /** 第几页（作品集 1–12；长图与招商页恒为 1） */
  pageIndex: number;
  buf: Buffer;
}): Promise<{ imageUrl: string; outputs: BrandViComposeOutput[] }> {
  const step = requireBrandViStep(opts.stepId);
  if (step.kind !== "compose") {
    throw new Error(`第 ${step.no} 步「${step.label}」不是排版步骤`);
  }

  const project = await getEcomBrandViProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const missing = missingRequirementLabels(project.plan, opts.stepId);
  if (missing.length > 0) {
    throw new Error(`请先完成：${missing.join("、")}`);
  }

  const page = step.pages.find((p) => p.index === opts.pageIndex);
  if (!page) throw new Error(`第 ${opts.pageIndex} 页不在本步版式内`);

  const imageUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "png",
    buf: opts.buf,
    contentType: "image/png",
  });

  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_BRAND_VI_MODULE,
      kind: "image",
      title: `${step.label} · ${page.title}`.slice(0, 80),
      ossUrl: imageUrl,
      thumbnailUrl: imageUrl,
      meta: {
        projectId: opts.projectId,
        projectName: project.title?.trim() || undefined,
        source: "brand-vi",
        stepId: step.id,
        stepNo: step.no,
        index: page.index,
        composed: true,
      },
    },
  });

  const state = readBrandViStepState(project.plan, opts.stepId);
  const outputs: BrandViComposeOutput[] = [
    ...state.outputs.filter((o) => o.index !== page.index),
    { index: page.index, title: page.title, imageUrl, assetId: asset.id },
  ].sort((a, b) => a.index - b.index);

  await patchBrandViStep(opts.userId, opts.projectId, opts.stepId, {
    outputs,
    status: outputs.length >= step.pages.length ? "ready" : "generating",
  });

  return { imageUrl, outputs };
}
