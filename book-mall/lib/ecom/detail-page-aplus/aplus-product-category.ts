import type { DetailPageSuiteBrief } from "@/lib/ecom/detail-page-suite/types";
import { getProVerticalConfig } from "@/lib/ecom/pro-vertical/registry";
import { PRO_SHARED_DIMENSION_TAIL } from "@/lib/ecom/pro-vertical/shared-enums";
import type { DimensionStepDef } from "@/lib/ecom/pro-vertical/types";

import { normalizeAplusProductVertical, type AplusProductVertical } from "./aplus-subdim-match";

const TAIL_KEYS = new Set(PRO_SHARED_DIMENSION_TAIL.map((s) => s.key));

export const APLUS_VERTICAL_LABELS: Record<AplusProductVertical, string> = {
  fashion_apparel: "服装",
  bags: "包包",
  digital_3c: "3C 数码",
  footwear: "鞋子",
  jewelry: "珠宝",
  outdoor_gear: "户外用品",
  loungewear: "家居服",
  kitchenware: "厨房用品",
  baby_maternal: "母婴用品",
};

function briefDimensionValue(brief: DetailPageSuiteBrief, key: string): string | undefined {
  const raw = (brief as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : undefined;
}

/** AI 详情页 · 一级品类下的二/三级（对齐 Pro Vertical 前两档可选维度） */
export function getAplusProductCategorySteps(
  vertical: string | undefined,
): DimensionStepDef[] {
  const v = normalizeAplusProductVertical(vertical);
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
  step: DimensionStepDef,
  brief: DetailPageSuiteBrief,
): readonly string[] {
  if (step.subOptionsMap && step.parentKey) {
    const parent = briefDimensionValue(brief, step.parentKey);
    if (parent && step.subOptionsMap[parent]) return step.subOptionsMap[parent]!;
    return step.subOptionsMap["通用"] ?? ["通用"];
  }
  return step.options ?? [];
}

export function buildAplusProductCategoryContextLines(
  brief: DetailPageSuiteBrief | null | undefined,
): string[] {
  const b = brief ?? {};
  const vertical = normalizeAplusProductVertical(b.productVertical);
  const lines: string[] = [`产品一级品类：${APLUS_VERTICAL_LABELS[vertical]}`];
  for (const step of getAplusProductCategorySteps(vertical)) {
    const val = briefDimensionValue(b, step.key);
    if (val) lines.push(`${step.label}：${val}`);
  }
  return lines;
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
      const opts = resolveAplusCategoryStepOptions(step1, next);
      if (!parentVal || !opts.includes(childVal)) {
        delete record[step1.key];
      }
    }
  }

  return next;
}