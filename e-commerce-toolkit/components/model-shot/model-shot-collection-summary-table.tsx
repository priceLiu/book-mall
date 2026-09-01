"use client";

import { EcomDataTable } from "@/components/ui/ecom-data-table";
import type { ModelShotCollectionSummaryRow } from "@/lib/model-shot-workflow";

type Props = {
  rows: ModelShotCollectionSummaryRow[];
};

/** 信息采集完成 · 汇总表（助手会话内） */
export function ModelShotCollectionSummaryTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <EcomDataTable
      headers={["项目", "已选配置"]}
      rows={rows.map((row) => [row.label, row.value])}
      minWidth={240}
      labelColumn
    />
  );
}
