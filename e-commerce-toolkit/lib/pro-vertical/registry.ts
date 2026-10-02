import { FASHION_APPAREL_CONFIG } from "@/lib/pro-vertical/configs/fashion-apparel";
import { BAGS_CONFIG } from "@/lib/pro-vertical/configs/bags";
import { DIGITAL_3C_CONFIG } from "@/lib/pro-vertical/configs/digital_3c";
import { FOOTWEAR_CONFIG } from "@/lib/pro-vertical/configs/footwear";
import { JEWELRY_CONFIG } from "@/lib/pro-vertical/configs/jewelry";
import { OUTDOOR_GEAR_CONFIG } from "@/lib/pro-vertical/configs/outdoor_gear";
import { LOUNGEWEAR_CONFIG } from "@/lib/pro-vertical/configs/loungewear";
import { KITCHENWARE_CONFIG } from "@/lib/pro-vertical/configs/kitchenware";
import { BABY_MATERNAL_CONFIG } from "@/lib/pro-vertical/configs/baby_maternal";
import type { ProVerticalConfig, ProVerticalId } from "@/lib/pro-vertical/types";

const REGISTRY: Record<ProVerticalId, ProVerticalConfig> = {
  fashion_apparel: FASHION_APPAREL_CONFIG,
  bags: BAGS_CONFIG,
  digital_3c: DIGITAL_3C_CONFIG,
  footwear: FOOTWEAR_CONFIG,
  jewelry: JEWELRY_CONFIG,
  outdoor_gear: OUTDOOR_GEAR_CONFIG,
  loungewear: LOUNGEWEAR_CONFIG,
  kitchenware: KITCHENWARE_CONFIG,
  baby_maternal: BABY_MATERNAL_CONFIG,
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
  if (typeof raw !== "string") return null;
  return isProVerticalId(raw) ? raw : null;
}

export function isProVerticalWorkflow(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  const wf = (meta?.workflow as Record<string, unknown> | undefined) ?? {};
  return isProVerticalId(typeof wf.vertical === "string" ? wf.vertical : null);
}

export {
  FASHION_APPAREL_CONFIG,
  BAGS_CONFIG,
  DIGITAL_3C_CONFIG,
  FOOTWEAR_CONFIG,
  JEWELRY_CONFIG,
  OUTDOOR_GEAR_CONFIG,
  LOUNGEWEAR_CONFIG,
  KITCHENWARE_CONFIG,
  BABY_MATERNAL_CONFIG,
};
