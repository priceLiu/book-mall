"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, rowsToCsv, tsForFilename } from "@/lib/csv-export";

export type ExportLine = {
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  toolKey: string;
  modelKey: string;
  pricingTemplateKey: string | null;
  internalCloudCostUnitYuan: string | null;
  internalRetailMultiplier: string | null;
  internalChargedPoints: number | null;
  yuan: number;
};

/** 客户端按钮：把 server 传来的 rows 直接转 CSV 下载（避免多走一次 HTTP）。 */
export function UsageOverviewExportButton({
  rows,
  rangeLabel,
}: {
  rows: ExportLine[];
  rangeLabel: string;
}) {
  function onClick() {
    if (rows.length === 0) return;
    const csv = rowsToCsv(
      [
        { key: "createdAt", label: "时间" },
        { key: "userName", label: "用户" },
        { key: "userEmail", label: "邮箱" },
        { key: "userId", label: "用户 ID" },
        { key: "toolKey", label: "工具" },
        { key: "modelKey", label: "模型" },
        { key: "pricingTemplateKey", label: "计价模板" },
        { key: "internalCloudCostUnitYuan", label: "云成本(¥)" },
        { key: "internalRetailMultiplier", label: "系数 M" },
        { key: "internalChargedPoints", label: "扣点" },
        { key: "yuan", label: "≈¥" },
      ],
      rows,
    );
    downloadCsv(`usage-overview-${rangeLabel}-${tsForFilename()}.csv`, csv);
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={rows.length === 0}
    >
      <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
      导出 CSV（{rows.length} 条）
    </Button>
  );
}
