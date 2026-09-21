"use client";

import { useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cloneSizeChartTable,
  type DetailPageSuiteSizeChartTable,
} from "@/lib/detail-page-suite-size-chart";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  table: DetailPageSuiteSizeChartTable;
  saving?: boolean;
  onSave: (table: DetailPageSuiteSizeChartTable) => void | Promise<void>;
};

export function DetailPageSuiteSizeChartEditDialog({
  open,
  onOpenChange,
  title,
  table,
  saving = false,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(() => cloneSizeChartTable(table));

  useEffect(() => {
    if (open) setDraft(cloneSizeChartTable(table));
  }, [open, table]);

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    setDraft((prev) => {
      const rows = prev.rows.map((r, ri) =>
        ri === rowIndex ? r.map((c, ci) => (ci === colIndex ? value : c)) : [...r],
      );
      return { ...prev, rows, isDemo: false };
    });
  };

  const addRow = () => {
    setDraft((prev) => ({
      ...prev,
      rows: [...prev.rows, prev.headers.map(() => "")],
      isDemo: false,
    }));
  };

  const removeRow = (rowIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== rowIndex),
      isDemo: false,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="pr-10">
          <DialogTitle className="leading-snug">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs leading-relaxed text-[#86868b]">
          系统将按下方数据直接生成尺码表图片（不经大模型）。演示数据仅作预览，上架前请替换为本款真实尺码。
        </p>
        <label className="block text-sm text-[#6e6e73]">
          表标题
          <input
            className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
            value={draft.title ?? ""}
            onChange={(e) =>
              setDraft((p) => ({ ...p, title: e.target.value, isDemo: false }))
            }
          />
        </label>
        <div className="max-h-[50vh] overflow-auto rounded-lg border border-[#e8e8ed]">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="bg-[#1d1d1f] text-white">
                {draft.headers.map((h) => (
                  <th key={h} className="px-2 py-2 font-medium">
                    {h}
                  </th>
                ))}
                <th className="w-12 px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {draft.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[#f5f5f7]"}>
                  {draft.headers.map((_, ci) => (
                    <td key={ci} className="border-t border-[#e8e8ed] p-0">
                      <input
                        className="w-full bg-transparent px-2 py-1.5 outline-none"
                        value={row[ci] ?? ""}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="border-t border-[#e8e8ed] text-center">
                    <button
                      type="button"
                      className="text-[#86868b] hover:text-[#ff3b30]"
                      onClick={() => removeRow(ri)}
                      aria-label="删除行"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <EcomButtonSecondary type="button" size="sm" onClick={addRow}>
          增加尺码行
        </EcomButtonSecondary>
        <DialogFooter className="gap-2 sm:justify-end">
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={saving || draft.rows.length === 0}
            onClick={() => void onSave(draft)}
          >
            {saving ? "保存中…" : "确认并保存"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
