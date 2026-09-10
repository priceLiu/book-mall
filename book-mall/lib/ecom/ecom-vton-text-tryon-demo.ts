import { randomUUID } from "crypto";

import { buildEcomTextTryonDemoOssKey } from "@/lib/canvas/canvas-constants";
import type { ModelTryonProjectDto } from "@/lib/ecom/ecom-model-tryon-types";
import { updateEcomModelTryonProject } from "@/lib/ecom/ecom-model-tryon-service";
import { mergeVtonMeta, sanitizeVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";
import type { VtonTextTryonRef } from "@/lib/ecom/ecom-vton/types";
import {
  ECOM_VTON_TEXT_TRYON_DEFAULT_PROMPT,
  normalizeEcomVtonTextTryonPrompt,
} from "@/lib/ecom/ecom-vton-text-tryon-default-prompt";
import { readOssEnv } from "@/lib/oss-client";

export type VtonTextTryonDemoSlot = "garment" | "accessory-glasses";

const DEMO_EXT = "png";

/** 内置示例槽位：@图片1 = 服装，@图片2 = 眼镜 */
export const VTON_TEXT_TRYON_DEMO_SLOTS: ReadonlyArray<{
  slot: VtonTextTryonDemoSlot;
  label: string;
}> = [
  { slot: "garment", label: "图片1" },
  { slot: "accessory-glasses", label: "图片2" },
];

export function resolveEcomVtonTextTryonDemoOssUrl(slot: VtonTextTryonDemoSlot): string {
  const cfg = readOssEnv();
  if ("error" in cfg) {
    throw new Error(cfg.error);
  }
  const key = buildEcomTextTryonDemoOssKey(slot, DEMO_EXT);
  const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  return `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${key}`;
}

export function buildEcomVtonTextTryonDemoRefs(now = new Date().toISOString()): VtonTextTryonRef[] {
  return VTON_TEXT_TRYON_DEMO_SLOTS.map(({ slot, label }) => ({
    id: randomUUID(),
    ossUrl: resolveEcomVtonTextTryonDemoOssUrl(slot),
    label,
    createdAt: now,
  }));
}

function countValidTextTryonRefs(project: ModelTryonProjectDto): number {
  return (project.meta?.textTryonRefs ?? []).filter((r) => r.ossUrl?.trim()).length;
}

/** 文生试衣模式 · 首次打开或切换时注入内置示例参考图 + 默认 Prompt */
export async function ensureEcomVtonTextTryonDemoState(
  userId: string,
  project: ModelTryonProjectDto,
): Promise<ModelTryonProjectDto> {
  if (project.settings.outfitRefMode !== "text_to_tryon") return project;

  const meta = sanitizeVtonProjectMeta(project.meta);
  if (meta.textTryonDemoSuppressed) return project;

  const refCount = countValidTextTryonRefs(project);
  const prompt = meta.textTryonPrompt?.trim() ?? "";
  const needsRefs = refCount === 0;
  const needsPrompt = !prompt;

  if (!needsRefs && !needsPrompt) return project;

  const metaPatch: Partial<typeof meta> = {};
  if (needsRefs) {
    metaPatch.textTryonRefs = buildEcomVtonTextTryonDemoRefs();
  }
  if (needsPrompt) {
    metaPatch.textTryonPrompt = normalizeEcomVtonTextTryonPrompt(
      ECOM_VTON_TEXT_TRYON_DEFAULT_PROMPT,
    );
  }

  return updateEcomModelTryonProject(userId, project.id, {
    meta: mergeVtonMeta(meta, metaPatch),
  });
}
