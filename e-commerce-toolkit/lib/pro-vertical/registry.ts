import { FASHION_APPAREL_CONFIG } from "@/lib/pro-vertical/configs/fashion-apparel";
import { BAGS_CONFIG } from "@/lib/pro-vertical/configs/bags";
import type { ProVerticalConfig, ProVerticalId } from "@/lib/pro-vertical/types";

const REGISTRY: Record<ProVerticalId, ProVerticalConfig> = {
  fashion_apparel: FASHION_APPAREL_CONFIG,
  bags: BAGS_CONFIG,
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
  return isProVerticalId(typeof raw === "string" ? raw : null) ? raw : null;
}

export function isProVerticalWorkflow(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  const wf = (meta?.workflow as Record<string, unknown> | undefined) ?? {};
  return isProVerticalId(typeof wf.vertical === "string" ? wf.vertical : null);
}

export { FASHION_APPAREL_CONFIG, BAGS_CONFIG };
