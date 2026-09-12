import {
  confirmModelGeneration,
  finalizeModelGenerationsMeta,
  resolveActiveModelGeneration,
  resolvePreviewModelGeneration,
} from "@/lib/ecom/ecom-vton/model-generations";
import type { VtonModelImageCheck } from "@/lib/ecom/ecom-vton/types";
import type {
  VtonModelGeneration,
  VtonModelGenerationBodyCheck,
  VtonProjectMeta,
} from "@/lib/ecom/ecom-vton/types";

export function vtonGenerationBodyCheckForAi(): VtonModelGenerationBodyCheck {
  return {
    status: "done",
    shotType: "full_body",
    isFullBody: true,
    checkedAt: new Date().toISOString(),
    fromAiGenerate: true,
  };
}

export function vtonGenerationBodyCheckFromDetect(
  check: VtonModelImageCheck,
): VtonModelGenerationBodyCheck {
  return {
    status: "done",
    shotType: check.shotType,
    isFullBody: check.isFullBody,
    checkedAt: check.checkedAt,
    fromAiGenerate: check.fromAiFourView === true,
  };
}

export function vtonGenerationBodyCheckFailed(): VtonModelGenerationBodyCheck {
  return {
    status: "failed",
    shotType: "unknown",
    isFullBody: false,
  };
}

export function isGenerationBodyCheckReady(
  generation: VtonModelGeneration | null | undefined,
): boolean {
  return generation?.bodyCheck?.status === "done";
}

export function canConfirmModelGenerationByBody(
  generation: VtonModelGeneration | null | undefined,
): boolean {
  if (!generation) return false;
  if (generation.source === "ai-generate") return true;
  const bc = generation.bodyCheck;
  return bc?.status === "done" && bc.isFullBody === true;
}

export function assertGenerationConfirmable(generation: VtonModelGeneration): void {
  if (canConfirmModelGenerationByBody(generation)) return;
  const bc = generation.bodyCheck;
  if (bc?.status === "pending") {
    throw new Error("全身取景识别中，请稍后再确认。");
  }
  if (bc?.status === "failed") {
    throw new Error("全身取景识别失败，请重新上传或换一张图。");
  }
  if (bc?.shotType === "portrait" || bc?.shotType === "half_body") {
    throw new Error("该图为头像/半身，请先「头像生成全身图」后再确认试衣。");
  }
  throw new Error("未识别为全身照，请上传全身图或 AI 生成全身模特后再确认。");
}

export function assertGenerationFullBodyForTryon(generation: VtonModelGeneration): void {
  if (canConfirmModelGenerationByBody(generation)) return;
  const bc = generation.bodyCheck;
  if (bc?.shotType === "portrait" || bc?.shotType === "half_body") {
    throw new Error("当前试衣模特为头像/半身，请先「头像生成全身图」后再试衣。");
  }
  throw new Error("当前试衣模特未识别为全身照，请换全身模特后再试衣。");
}

/**
 * 批量试衣/精修前解析试衣模特：
 * 优先已确认 active；否则若左栏 preview 已是可试衣全身，自动确认并设为 active。
 */
export function prepareTryonModelGeneration(meta: VtonProjectMeta): {
  meta: VtonProjectMeta;
  generation: VtonModelGeneration;
  didAutoConfirm: boolean;
} {
  let working = finalizeModelGenerationsMeta(meta);

  const active = resolveActiveModelGeneration(working);
  if (active?.ossUrl?.trim()) {
    assertGenerationFullBodyForTryon(active);
    return { meta: working, generation: active, didAutoConfirm: false };
  }

  const preview = resolvePreviewModelGeneration(working);
  if (!preview?.ossUrl?.trim()) {
    throw new Error("请先上传或选择模特全身照");
  }

  if (canConfirmModelGenerationByBody(preview)) {
    working = confirmModelGeneration(working, preview.id);
    const confirmed = resolveActiveModelGeneration(working);
    if (!confirmed?.ossUrl?.trim()) {
      throw new Error("请先上传或选择模特全身照");
    }
    assertGenerationFullBodyForTryon(confirmed);
    return { meta: working, generation: confirmed, didAutoConfirm: true };
  }

  assertGenerationFullBodyForTryon(preview);
  throw new Error("请先上传或选择模特全身照");
}

export type ModelGenerationBodyBadge = {
  label: string;
  tone: "success" | "warn" | "muted" | "pending";
};

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

export function patchGenerationBodyCheck(
  meta: VtonProjectMeta,
  generationId: string,
  bodyCheck: VtonModelGenerationBodyCheck,
): VtonProjectMeta {
  const id = generationId.trim();
  const modelGenerations = (meta.modelGenerations ?? []).map((g) =>
    g.id === id ? { ...g, bodyCheck } : g,
  );
  return { ...meta, modelGenerations };
}
