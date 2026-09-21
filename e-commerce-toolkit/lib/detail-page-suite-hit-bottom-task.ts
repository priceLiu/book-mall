import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import { hitDecomposeStatusCopy, hitJobProgressPercent } from "@/lib/detail-page-suite-hit-progress";
import {
  isVisionSellpointJobRunning,
  readHitVisionSellpointJob,
  visionSellpointProgressLabel,
  visionSellpointProgressPercent,
} from "@/lib/detail-page-suite-vision-sellpoint-progress";

export type HitBottomTaskView = {
  active: boolean;
  title: string;
  detail?: string;
  progress?: number | null;
};

export function resolveHitBottomTask(opts: {
  project: DetailPageSuiteProject | null;
  uploadBusy: boolean;
  uploadProgress: number | null;
  uploadProgressLabel?: string;
  decomposing: boolean;
  rewriting: boolean;
  visionBusy: boolean;
  imageGenSlotCount: number;
}): HitBottomTaskView {
  const meta = opts.project?.meta ?? null;

  if (opts.uploadBusy) {
    return {
      active: true,
      title: "上传参考图中",
      detail: opts.uploadProgressLabel ?? "正在写入 OSS…",
      progress: opts.uploadProgress,
    };
  }

  if (opts.decomposing || meta?.hitStatus === "decomposing") {
    const copy = hitDecomposeStatusCopy(meta);
    return {
      active: true,
      title: copy?.title ?? "拆解爆款范式",
      detail:
        copy?.detail ?? "识别结构骨架、爆款洞察与七维场景氛围…长任务可在右下角 Dock 查看。",
      progress: hitJobProgressPercent(meta),
    };
  }

  const visionJob = readHitVisionSellpointJob(meta);
  if (opts.visionBusy || isVisionSellpointJobRunning(visionJob)) {
    return {
      active: true,
      title: visionJob?.progress?.title ?? "AI 识图卖点",
      detail: visionSellpointProgressLabel(visionJob),
      progress: visionSellpointProgressPercent(visionJob),
    };
  }

  if (opts.rewriting || meta?.hitStatus === "polishing") {
    const copy = hitDecomposeStatusCopy(meta);
    return {
      active: true,
      title: copy?.title ?? "生成原创文案与 Prompt",
      detail: copy?.detail ?? "结合爆款洞察、场景氛围与新品卖点…",
      progress: hitJobProgressPercent(meta),
    };
  }

  if (opts.imageGenSlotCount > 0) {
    return {
      active: true,
      title: "详情页出图中",
      detail: `Gateway 图像任务进行中（${opts.imageGenSlotCount} 个点位）…`,
      progress: null,
    };
  }

  return { active: false, title: "" };
}
