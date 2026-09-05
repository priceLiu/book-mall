"use client";

import type React from "react";
import { Check, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { normalizeMarketingPlanText } from "@/lib/product-design-marketing-parse";
import type { BuyingReasonTable } from "@/lib/product-design-buying-reason-parse";

function renderCellText(text: string, keyPrefix: string): React.ReactNode {
  const normalized = normalizeMarketingPlanText(text);
  if (!normalized) return "—";

  const parts = normalized.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-[#1d1d1f]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part.split("\n").map((line, j, arr) => (
      <span key={`${keyPrefix}-${i}-${j}`}>
        {line}
        {j < arr.length - 1 ? <br /> : null}
      </span>
    ));
  });
}

function EditableCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  async function commit() {
    const next = draft.trim();
    if (next === value.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
        <textarea
          className="w-full rounded-lg border border-[#0071e3]/40 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-[#1d1d1f] outline-none ring-2 ring-[#0071e3]/15"
          rows={3}
          value={draft}
          disabled={saving}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
        />
        <div className="flex gap-1">
          <EcomButtonPrimary
            size="sm"
            type="button"
            className="h-6 px-2 text-[10px]"
            disabled={saving}
            onClick={() => void commit()}
          >
            <Check className="h-3 w-3" />
            保存
          </EcomButtonPrimary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            className="h-6 px-2 text-[10px]"
            disabled={saving}
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
          >
            取消
          </EcomButtonSecondary>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-start gap-1">
      <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-[#1d1d1f]">
        {renderCellText(value, "cell")}
      </div>
      <button
        type="button"
        className="mt-0.5 shrink-0 rounded-md p-1 text-[#86868b] opacity-0 transition hover:bg-[#f0f0f2] hover:text-[#1d1d1f] group-hover:opacity-100"
        title="编辑"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

type Props = {
  intro?: string;
  table: BuyingReasonTable;
  onSaveTable: (table: BuyingReasonTable) => void | Promise<void>;
};

/** Step3 购买理由表：列名与会话区同源，单元格可编辑保存 */
export function ProductDesignBuyingReasonMatrixTable({ intro, table, onSaveTable }: Props) {
  if (table.headers.length === 0 || table.rows.length === 0) return null;

  const colCount = table.headers.length;

  return (
    <div>
      {intro ? (
        <p className="mb-3 text-[11px] leading-relaxed text-[#424245]">{intro}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-[#e8e8ed]">
        <table className="w-full min-w-[560px] border-collapse text-left text-xs">
          <thead>
            <tr className="bg-[#1d1d1f] text-white">
              {table.headers.map((header, hi) => (
                <th key={hi} className="px-3 py-2 font-medium whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-[#e8e8ed] bg-white">
                {table.headers.map((_, ci) => (
                  <td key={ci} className="px-3 py-2 align-top">
                    <EditableCell
                      value={row[ci] ?? ""}
                      onSave={async (next) => {
                        const rows = table.rows.map((r, ridx) => {
                          if (ridx !== ri) return [...r];
                          const cells = [...r];
                          while (cells.length < colCount) cells.push("");
                          cells[ci] = next;
                          return cells;
                        });
                        await onSaveTable({ headers: table.headers, rows });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
