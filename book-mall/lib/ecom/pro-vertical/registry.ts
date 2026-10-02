import { FASHION_APPAREL_CONFIG } from "@/lib/ecom/pro-vertical/configs/fashion-apparel";
import { BAGS_CONFIG } from "@/lib/ecom/pro-vertical/configs/bags";
import { DIGITAL_3C_CONFIG } from "@/lib/ecom/pro-vertical/configs/digital_3c";
import { FOOTWEAR_CONFIG } from "@/lib/ecom/pro-vertical/configs/footwear";
import { JEWELRY_CONFIG } from "@/lib/ecom/pro-vertical/configs/jewelry";
import { OUTDOOR_GEAR_CONFIG } from "@/lib/ecom/pro-vertical/configs/outdoor_gear";
import { LOUNGEWEAR_CONFIG } from "@/lib/ecom/pro-vertical/configs/loungewear";
import { KITCHENWARE_CONFIG } from "@/lib/ecom/pro-vertical/configs/kitchenware";
import { BABY_MATERNAL_CONFIG } from "@/lib/ecom/pro-vertical/configs/baby_maternal";
import type { ProVerticalConfig, ProVerticalId } from "@/lib/ecom/pro-vertical/types";

export const PRO_VERTICAL_IDS = [
  "fashion_apparel",
  "bags",
  "digital_3c",
  "footwear",
  "jewelry",
  "outdoor_gear",
  "loungewear",
  "kitchenware",
  "baby_maternal",
] as const satisfies readonly ProVerticalId[];

export const PRO_VERTICAL_ID_PATTERN = PRO_VERTICAL_IDS.join("|");

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

/** 非 fashion 的 Pro vertical（走 pro-v1 deliverable） */
export function isNonFashionProWorkflow(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  const vertical = resolveWorkflowVertical(
    (meta?.workflow as Record<string, unknown> | undefined) ?? {},
  );
  return vertical != null && vertical !== "fashion_apparel";
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
