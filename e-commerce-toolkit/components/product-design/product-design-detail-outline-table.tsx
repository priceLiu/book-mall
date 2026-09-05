"use client";

import type React from "react";
import { Check, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { normalizeMarketingPlanText } from "@/lib/product-design-marketing-parse";
import type { ProductDesign } from "@/lib/product-design-types";
import {
  DETAIL_OUTLINE_TAG_LABEL,
} from "@/lib/product-design-step-sync-parse";
import { cn } from "@/lib/utils";

type OutlineRow = ProductDesign["detailOutline"][number];

function renderCell(text: string, keyPrefix: string): React.ReactNode {
  const normalized = normalizeMarketingPlanText(text);
  if (!normalized) return "—";
  return normalized.split("\n").map((line, i, arr) => (
    <span key={`${keyPrefix}-${i}`}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </span>
  ));
}

const TAG_CLASS: Record<OutlineRow["tag"], string> = {
  emotion: "bg-violet-50 text-violet-700",
  proof: "bg-sky-50 text-sky-700",
  risk: "bg-amber-50 text-amber-800",
  other: "bg-[#f5f5f7] text-[#6e6e73]",
};

const TAG_OPTIONS: OutlineRow["tag"][] = ["emotion", "proof", "risk", "other"];

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
        {renderCell(value, "cell")}
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

function EditableTag({
  tag,
  onSave,
}: {
  tag: OutlineRow["tag"];
  onSave: (tag: OutlineRow["tag"]) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(tag);
  }, [tag, editing]);

  async function commit() {
    if (draft === tag) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
        <select
          className="w-full rounded-lg border border-[#0071e3]/40 bg-white px-2 py-1 text-[11px] text-[#1d1d1f] outline-none ring-2 ring-[#0071e3]/15"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value as OutlineRow["tag"])}
        >
          {TAG_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {DETAIL_OUTLINE_TAG_LABEL[opt]}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <EcomButtonPrimary
            size="sm"
            type="button"
            className="h-6 px-2 text-[10px]"
            disabled={saving}
            onClick={() => void commit()}
          >
            保存
          </EcomButtonPrimary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            className="h-6 px-2 text-[10px]"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            取消
          </EcomButtonSecondary>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
          TAG_CLASS[tag],
        )}
      >
        {DETAIL_OUTLINE_TAG_LABEL[tag]}
      </span>
      <button
        type="button"
        className="shrink-0 rounded-md p-1 text-[#86868b] opacity-0 transition hover:bg-[#f0f0f2] hover:text-[#1d1d1f] group-hover:opacity-100"
        title="编辑"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

type Props = {
  rows: OutlineRow[];
  onSaveRows?: (rows: OutlineRow[]) => void | Promise<void>;
};

/** Step7 详情页销售逻辑框架表（单元格可编辑） */
export function ProductDesignDetailOutlineTable({ rows, onSaveRows }: Props) {
  if (rows.length === 0) return null;

  function patchRow(
    index: number,
    patch: Partial<OutlineRow>,
  ) {
    if (!onSaveRows) return;
    void onSaveRows(
      rows.map((row) => (row.index === index ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e8e8ed]">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-xs">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "16%" }} />
        </colgroup>
        <thead>
          <tr className="bg-[#1d1d1f] text-white">
            <th className="px-3 py-2 font-medium">屏号</th>
            <th className="px-3 py-2 font-medium">核心营销任务</th>
            <th className="px-3 py-2 font-medium">解答下单疑虑</th>
            <th className="px-3 py-2 font-medium">标题方向</th>
            <th className="px-3 py-2 font-medium">页面类型</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.index} className="border-t border-[#e8e8ed] bg-white">
              <td className="px-3 py-2 align-top font-semibold text-[#1d1d1f]">
                第{row.index}屏
              </td>
              <td className="px-3 py-2 align-top text-[#1d1d1f]">
                {onSaveRows ? (
                  <EditableCell
                    value={row.mission}
                    onSave={(v) => patchRow(row.index, { mission: v })}
                  />
                ) : (
                  renderCell(row.mission, `m-${row.index}`)
                )}
              </td>
              <td className="px-3 py-2 align-top text-[#424245]">
                {onSaveRows ? (
                  <EditableCell
                    value={row.doubtResolved}
                    onSave={(v) => patchRow(row.index, { doubtResolved: v })}
                  />
                ) : (
                  renderCell(row.doubtResolved, `d-${row.index}`)
                )}
              </td>
              <td className="px-3 py-2 align-top text-[#424245]">
                {onSaveRows ? (
                  <EditableCell
                    value={row.titleDirection}
                    onSave={(v) => patchRow(row.index, { titleDirection: v })}
                  />
                ) : (
                  renderCell(row.titleDirection, `t-${row.index}`)
                )}
              </td>
              <td className="px-3 py-2 align-top">
                {onSaveRows ? (
                  <EditableTag
                    tag={row.tag}
                    onSave={(tag) => patchRow(row.index, { tag })}
                  />
                ) : (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                      TAG_CLASS[row.tag],
                    )}
                  >
                    {DETAIL_OUTLINE_TAG_LABEL[row.tag]}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
