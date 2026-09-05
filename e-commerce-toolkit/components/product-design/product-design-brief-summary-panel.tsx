"use client";

import { ProductDesignEditableField } from "@/components/product-design/product-design-editable-field";
import { BRIEF_FIELDS } from "@/lib/product-design-workflow";
import type { ProductDesignBrief } from "@/lib/product-design-types";

function formatBriefFieldValue(
  brief: ProductDesignBrief | null,
  key: keyof ProductDesignBrief,
): string {
  const v = brief?.[key];
  if (Array.isArray(v)) return v.join("\n");
  return String(v ?? "");
}

function parseBriefFieldValue(
  key: keyof ProductDesignBrief,
  text: string,
): string | string[] {
  const trimmed = text.trim();
  if (
    key === "mainPainPoint" ||
    key === "productCoreAdvantage" ||
    key === "hasTrustBadge"
  ) {
    return trimmed
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return trimmed;
}

type Props = {
  brief: ProductDesignBrief;
  onSaveField: (
    key: keyof ProductDesignBrief,
    value: string | string[],
  ) => void | Promise<void>;
};

/** Step0 信息采集结论：助手区选完后在中间区展示，字段可编辑保存 */
export function ProductDesignBriefSummaryPanel({ brief, onSaveField }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {BRIEF_FIELDS.map((field) => (
        <ProductDesignEditableField
          key={field.key}
          label={field.label}
          value={formatBriefFieldValue(brief, field.key)}
          multiline={Boolean(field.multiSelect)}
          rows={field.multiSelect ? 3 : 2}
          onSave={(text) => onSaveField(field.key, parseBriefFieldValue(field.key, text))}
        />
      ))}
    </div>
  );
}
