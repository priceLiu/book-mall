import type { VtonModelGeneration } from "@/lib/vton-types";

export type ModelGenerationBodyBadge = {
  label: string;
  tone: "success" | "warn" | "muted" | "pending";
};

export function canConfirmModelGeneration(
  generation: VtonModelGeneration | null | undefined,
): boolean {
  if (!generation) return false;
  if (generation.source === "ai-generate") return true;
  const bc = generation.bodyCheck;
  return bc?.status === "done" && bc.isFullBody === true;
}

export function modelGenerationBodyBadge(
  generation: VtonModelGeneration | null | undefined,
): ModelGenerationBodyBadge | null {
  if (!generation) return null;
  if (generation.source === "ai-generate" || generation.bodyCheck?.fromAiGenerate) {
    return { label: "AI 全身", tone: "success" };
  }
  const bc = generation.bodyCheck;
  if (!bc || bc.status === "pending") {
    return { label: "检测中", tone: "pending" };
  }
  if (bc.status === "failed") {
    return { label: "未识别", tone: "muted" };
  }
  if (bc.isFullBody) {
    return { label: "全身", tone: "success" };
  }
  if (bc.shotType === "portrait") {
    return { label: "头像", tone: "warn" };
  }
  if (bc.shotType === "half_body") {
    return { label: "半身", tone: "warn" };
  }
  return { label: "非全身", tone: "warn" };
}

export function modelGenerationConfirmedBadge(
  generation: VtonModelGeneration | null | undefined,
): ModelGenerationBodyBadge | null {
  if (!generation?.confirmedAt?.trim()) return null;
  return { label: "待试衣", tone: "success" };
}

export function previewModelBodyHint(
  generation: VtonModelGeneration | null | undefined,
): string | null {
  if (!generation?.ossUrl) return null;
  if (generation.source === "ai-generate" || generation.bodyCheck?.fromAiGenerate) {
    return "AI 全身模特，可确认加入待试衣。";
  }
  const bc = generation.bodyCheck;
  if (!bc || bc.status === "pending") {
    return "全身取景识别中，请稍候…";
  }
  if (bc.status === "failed") {
    return "识别失败，请重新上传或换一张图。";
  }
  if (bc.isFullBody) {
    return "全身模特照，可确认加入待试衣。";
  }
  if (bc.shotType === "portrait" || bc.shotType === "half_body") {
    return "当前为头像/半身，请先「头像生成全身图」后再确认试衣。";
  }
  return "未识别为全身照，请上传全身图或 AI 生成全身模特。";
}

export function activeTryonModelBodyHint(
  generation: VtonModelGeneration | null | undefined,
): string | null {
  if (!generation?.ossUrl) return null;
  if (canConfirmModelGeneration(generation)) {
    return generation.bodyCheck?.fromAiGenerate || generation.source === "ai-generate"
      ? "已就绪：AI 全身模特，可开始试衣。"
      : "已就绪：全身模特照，可开始试衣。";
  }
  const bc = generation.bodyCheck;
  if (!bc || bc.status === "pending") {
    return "试衣模特全身取景识别中，请稍候…";
  }
  if (bc.shotType === "portrait" || bc.shotType === "half_body") {
    return "当前试衣模特为头像/半身，请换全身模特或「头像生成全身图」后再试衣。";
  }
  return "当前试衣模特未识别为全身照，请换全身模特后再试衣。";
}
