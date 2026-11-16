import type { AplusProductVertical, DetailPageSuiteBrief } from "@/lib/detail-page-suite-types";
import { resolveDimensionStepOptions } from "@/lib/pro-vertical/dimensions";
import { getProVerticalConfig } from "@/lib/pro-vertical/registry";
import { PRO_SHARED_DIMENSION_TAIL } from "@/lib/pro-vertical/shared-enums";
import type { DimensionStepDef, ProVerticalId } from "@/lib/pro-vertical/types";

const TAIL_KEYS = new Set(PRO_SHARED_DIMENSION_TAIL.map((s) => s.key));

export const APLUS_VERTICAL_OPTIONS: { value: AplusProductVertical; label: string }[] = [
  { value: "fashion_apparel", label: "服装" },
  { value: "bags", label: "包包" },
  { value: "digital_3c", label: "3C 数码" },
  { value: "footwear", label: "鞋子" },
  { value: "jewelry", label: "珠宝" },
  { value: "outdoor_gear", label: "户外用品" },
  { value: "loungewear", label: "家居服" },
  { value: "kitchenware", label: "厨房用品" },
  { value: "baby_maternal", label: "母婴用品" },
];

function normalizeVertical(
  raw: string | undefined,
): AplusProductVertical {
  if (raw === "apparel" || raw === "general" || !raw) return "fashion_apparel";
  return raw as AplusProductVertical;
}

function briefDimensionValue(brief: DetailPageSuiteBrief, key: string): string | undefined {
  const raw = (brief as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : undefined;
}

export function getAplusProductCategorySteps(vertical: string | undefined): DimensionStepDef[] {
  const v = normalizeVertical(vertical) as ProVerticalId;
  const steps = getProVerticalConfig(v)?.dimensionSteps ?? [];
  const categorySteps: DimensionStepDef[] = [];
  for (const step of steps) {
    if (TAIL_KEYS.has(step.key)) break;
    if (!step.options?.length && !step.subOptionsMap && !step.freeText) continue;
    categorySteps.push(step);
    if (categorySteps.length >= 2) break;
  }
  return categorySteps;
}

export function resolveAplusCategoryStepOptions(
  vertical: AplusProductVertical,
  step: DimensionStepDef,
  brief: DetailPageSuiteBrief,
): readonly string[] {
  const parentDims: Partial<Record<string, string>> = {};
  for (const s of getAplusProductCategorySteps(vertical)) {
    const val = briefDimensionValue(brief, s.key);
    if (val) parentDims[s.key] = val;
  }
  return resolveDimensionStepOptions(vertical as ProVerticalId, step, parentDims);
}

export function clearAplusCategoryDimensionKeys(
  brief: DetailPageSuiteBrief,
  vertical: AplusProductVertical,
): DetailPageSuiteBrief {
  const next = { ...brief };
  for (const step of getAplusProductCategorySteps(vertical)) {
    delete (next as Record<string, unknown>)[step.key];
  }
  return next;
}

export function patchAplusProductCategoryBrief(
  brief: DetailPageSuiteBrief,
  vertical: AplusProductVertical,
  patch: Partial<Record<string, string | undefined>>,
): DetailPageSuiteBrief {
  const steps = getAplusProductCategorySteps(vertical);
  const next: DetailPageSuiteBrief = { ...brief, productVertical: vertical };
  const record = next as Record<string, unknown>;

  for (const step of steps) {
    if (!(step.key in patch)) continue;
    const val = patch[step.key]?.trim();
    if (val) record[step.key] = val;
    else delete record[step.key];
  }

  const step1 = steps[1];
  if (step1?.parentKey) {
    const parentVal = briefDimensionValue(next, step1.parentKey);
    const childVal = briefDimensionValue(next, step1.key);
    if (childVal) {
      const opts = resolveAplusCategoryStepOptions(vertical, step1, next);
      if (!parentVal || !opts.includes(childVal)) {
        delete record[step1.key];
      }
    }
  }

  return next;
}

export function resolveAiDetailPageProductVertical(
  raw: string | undefined,
): AplusProductVertical {
  return normalizeVertical(raw);
}