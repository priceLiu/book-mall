"use client";

import {
  APLUS_VERTICAL_OPTIONS,
  getAplusProductCategorySteps,
  patchAplusProductCategoryBrief,
  resolveAiDetailPageProductVertical,
  resolveAplusCategoryStepOptions,
  clearAplusCategoryDimensionKeys,
} from "@/lib/aplus-product-category";
import type { AplusProductVertical, DetailPageSuiteBrief } from "@/lib/detail-page-suite-types";
import { cn } from "@/lib/utils";

type Props = {
  brief: DetailPageSuiteBrief | undefined;
  disabled?: boolean;
  onBriefChange: (next: DetailPageSuiteBrief) => void;
};

export function AiDetailPageProductCategoryPicker({
  brief,
  disabled,
  onBriefChange,
}: Props) {
  const vertical = resolveAiDetailPageProductVertical(brief?.productVertical);
  const steps = getAplusProductCategorySteps(vertical);
  const [step0, step1] = steps;

  const b = brief ?? {};
  const l2Value = step0 ? (b as Record<string, string | undefined>)[step0.key] ?? "" : "";
  const l3Value = step1 ? (b as Record<string, string | undefined>)[step1.key] ?? "" : "";
  const l2Options = step0 ? (step0.options ?? []) : [];
  const l3Options = step1 ? resolveAplusCategoryStepOptions(vertical, step1, b) : [];

  return (
    <div className="flex gap-2">
      <select
        className="min-w-0 flex-1 rounded-lg border border-[var(--ecom-divider)] bg-white px-2 py-1.5 text-[11px]"
        disabled={disabled}
        value={vertical}
        onChange={(e) => {
          const nextVertical = e.target.value as AplusProductVertical;
          const cleared = clearAplusCategoryDimensionKeys(b, vertical);
          onBriefChange({
            ...cleared,
            productVertical: nextVertical,
          });
        }}
      >
        {APLUS_VERTICAL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {step0 ? (
          <select
            className="w-full rounded-lg border border-[var(--ecom-divider)] bg-white px-2 py-1.5 text-[11px]"
            disabled={disabled}
            value={l2Value}
            onChange={(e) => {
              const val = e.target.value;
              const next = patchAplusProductCategoryBrief(b, vertical, {
                [step0.key]: val || undefined,
                ...(step1 ? { [step1.key]: undefined } : {}),
              });
              onBriefChange(next);
            }}
          >
            <option value="">{`选择${step0.label}`}</option>
            {(l2Options.length > 0 ? l2Options : resolveAplusCategoryStepOptions(vertical, step0, b)).map(
              (opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ),
            )}
          </select>
        ) : null}

        {step1 ? (
          <select
            className={cn(
              "w-full rounded-lg border border-[var(--ecom-divider)] bg-white px-2 py-1.5 text-[11px]",
              (!l2Value || l3Options.length === 0) && "opacity-60",
            )}
            disabled={disabled || !l2Value || l3Options.length === 0}
            value={l3Value}
            onChange={(e) => {
              const val = e.target.value;
              onBriefChange(
                patchAplusProductCategoryBrief(b, vertical, {
                  [step1.key]: val || undefined,
                }),
              );
            }}
          >
            <option value="">
              {!l2Value
                ? `先选${step0?.label ?? "上级"}`
                : l3Options.length === 0
                  ? "暂无细项"
                  : `选择${step1.label}`}
            </option>
            {l3Options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}