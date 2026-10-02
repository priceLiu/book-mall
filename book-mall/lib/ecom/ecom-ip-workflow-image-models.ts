import { isRefCapableEcomImageModel } from "@/lib/ecom/ecom-image-gen-invoke";
import type { registryRowsToEcomModels } from "@/lib/gateway/ecom-storyboard-chat-models";

type EcomModelRow = ReturnType<typeof registryRowsToEcomModels>[number];

/**
 * 手办创作 / 品牌 VI · 优先展示的生图模型（须支持参考图）。
 * 已在 scene 列表中的保留顺序；其余从全站 IMAGE 池按序补入。
 */
export const ECOM_IP_WORKFLOW_PREFERRED_IMAGE_KEYS = [
  "wan2.7-image",
  "gpt-image-2",
  "seedream-4.5",
  "kling-3.0-image",
  "nano-banana-pro",
  "nano-banana-2",
] as const;

export function mergeIpWorkflowImageModels(
  primary: EcomModelRow[],
  fullPool: EcomModelRow[],
): EcomModelRow[] {
  const refFromPrimary =
    primary.filter((m) => isRefCapableEcomImageModel(m.modelKey)).length > 0
      ? primary.filter((m) => isRefCapableEcomImageModel(m.modelKey))
      : primary;
  const out = [...refFromPrimary];
  const seen = new Set(out.map((m) => m.modelKey));
  for (const key of ECOM_IP_WORKFLOW_PREFERRED_IMAGE_KEYS) {
    if (seen.has(key)) continue;
    const hit = fullPool.find(
      (m) => m.modelKey === key && isRefCapableEcomImageModel(m.modelKey),
    );
    if (!hit) continue;
    out.push(hit);
    seen.add(key);
  }
  for (const m of fullPool) {
    if (seen.has(m.modelKey)) continue;
    if (!isRefCapableEcomImageModel(m.modelKey)) continue;
    out.push(m);
    seen.add(m.modelKey);
  }
  return out;
}
