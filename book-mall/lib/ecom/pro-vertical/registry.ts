import { FASHION_APPAREL_CONFIG } from "@/lib/ecom/pro-vertical/configs/fashion-apparel";
import { BAGS_CONFIG } from "@/lib/ecom/pro-vertical/configs/bags";
import { DIGITAL_3C_CONFIG } from "@/lib/ecom/pro-vertical/configs/digital_3c";
import type { ProVerticalConfig, ProVerticalId } from "@/lib/ecom/pro-vertical/types";

const REGISTRY: Record<ProVerticalId, ProVerticalConfig> = {
  fashion_apparel: FASHION_APPAREL_CONFIG,
  bags: BAGS_CONFIG,
  digital_3c: DIGITAL_3C_CONFIG,
};

export function listProVerticals(): ProVerticalConfig[] {
  return Object.values(REGISTRY);
}

export function getProVerticalConfig(id: ProVerticalId | string | undefined | null): ProVerticalConfig | null {
  if (!id || typeof id !== "string") return null;
  return REGISTRY[id as ProVerticalId] ?? null;
}

export function isProVerticalId(id: string | undefined | null): id is ProVerticalId {
  return Boolean(id && id in REGISTRY);
}

export function resolveWorkflowVertical(
  workflow: Record<string, unknown> | undefined | null,
): ProVerticalId | null {
  const raw = workflow?.vertical;
  const id = typeof raw === "string" ? raw : null;
  return isProVerticalId(id) ? id : null;
}

export function isProVerticalWorkflow(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  const wf = (meta?.workflow as Record<string, unknown> | undefined) ?? {};
  if (wf.proMode === true) return true;
  return isProVerticalId(typeof wf.vertical === "string" ? wf.vertical : null);
}

/** 包包 / 3C 等非 fashion 的 Pro vertical（走 pro-v1 deliverable） */
export function isNonFashionProWorkflow(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  const vertical = resolveWorkflowVertical(
    (meta?.workflow as Record<string, unknown> | undefined) ?? {},
  );
  return vertical === "bags" || vertical === "digital_3c";
}

export { FASHION_APPAREL_CONFIG, BAGS_CONFIG, DIGITAL_3C_CONFIG };
