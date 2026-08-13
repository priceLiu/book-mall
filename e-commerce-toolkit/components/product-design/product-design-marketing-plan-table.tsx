"use client";

import type React from "react";
import { Check, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  marketingPlanDisplayNo,
  marketingPlanDisplayRows,
  normalizeMarketingPlanText,
  type MarketingPlanRow,
} from "@/lib/product-design-marketing-parse";
import type { ProductDesign } from "@/lib/product-design-types";
import { cn } from "@/lib/utils";

type Plan = ProductDesign["marketingPlans"][number];

type Props = {
  plan: Plan;
  selected: boolean;
  /** 不传则仅展示结果（不可点选）；Step-by-step 在会话区选方案 */
  onSelect?: () => void;
  onSaveRows: (rows: MarketingPlanRow[]) => void | Promise<void>;
};

function renderPlanRichText(text: string, keyPrefix: string): React.ReactNode {
  const normalized = normalizeMarketingPlanText(text);
  if (!normalized) return null;

  const withItalic = normalized.split(/(\*[^*]+\*)/g);
  return withItalic.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={`${keyPrefix}-em-${i}`} className="text-[#86868b] not-italic">
          {part.slice(1, -1)}
        </em>
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

function splitPlanTitle(name: string): { headline: string; tagline?: string } {
  const normalized = normalizeMarketingPlanText(name);
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return { headline: lines[0]!, tagline: lines.slice(1).join(" ") };
  }
  const paren = normalized.match(/^(.+?)\s*(\([^)]+\))\s*$/);
  if (paren) {
    return { headline: paren[1]!.trim(), tagline: paren[2]!.trim() };
  }
  return { headline: normalized };
}

function isPlanNameRow(label: string): boolean {
  return /^方案名称$|^名称$/.test(label.trim());
}

function planCardHeader(
  plan: Plan,
  rows: MarketingPlanRow[],
  planNoLabel: string,
): { headline: string; tagline?: string; bodyRows: MarketingPlanRow[] } {
  const nameRow = rows.find((r) => isPlanNameRow(r.label));
  const bodyRows = rows.filter((r) => !isPlanNameRow(r.label));

  if (nameRow?.content.trim()) {
    const { headline, tagline } = splitPlanTitle(nameRow.content);
    return { headline, tagline, bodyRows };
  }

  const { headline, tagline } = splitPlanTitle(plan.name);
  if (!/^[123]$/.test(headline)) {
    return { headline, tagline, bodyRows: rows };
  }

  const angleRow = rows.find((r) => /切入|逻辑/.test(r.label));
  if (angleRow?.content.trim()) {
    return {
      headline: normalizeMarketingPlanText(angleRow.content).slice(0, 48),
      tagline: planNoLabel,
      bodyRows,
    };
  }

  return { headline: planNoLabel, tagline, bodyRows: rows };
}

function EditableField({
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
      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <textarea
          className="w-full rounded-lg border border-[#0071e3]/40 bg-white px-2.5 py-2 text-[11px] leading-relaxed text-[#1d1d1f] outline-none ring-2 ring-[#0071e3]/15"
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
    <div className="group flex min-w-0 items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-[#1d1d1f]">
        {renderPlanRichText(value, "field") ?? "—"}
      </p>
      <button
        type="button"
        className="mt-0.5 shrink-0 rounded-md p-1 text-[#86868b] opacity-0 transition hover:bg-[#f0f0f2] hover:text-[#1d1d1f] group-hover:opacity-100"
        title="编辑"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

/** Step2 营销方案 · 三列卡片（左列名 / 右内容，与会话区同源数据） */
export function ProductDesignMarketingPlanTable({
  plan,
  selected,
  onSelect,
  onSaveRows,
}: Props) {
  const rows = marketingPlanDisplayRows(plan);
  const planNoLabel = `方案 ${marketingPlanDisplayNo(plan.no)}`;
  const { headline, tagline, bodyRows } = planCardHeader(plan, rows, planNoLabel);

  const selectable = Boolean(onSelect);

  return (
    <article
      role={selectable && !selected ? "button" : undefined}
      tabIndex={selectable && !selected ? 0 : undefined}
      aria-pressed={selected}
      aria-label={
        selected
          ? `${planNoLabel} 已选用`
          : selectable
            ? `选用 ${planNoLabel}`
            : planNoLabel
      }
      onClick={selectable ? () => onSelect?.() : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!selected) onSelect?.();
              }
            }
          : undefined
      }
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all",
        selected
          ? "border-[var(--ecom-chrome-accent)] ring-2 ring-[var(--ecom-chrome-accent)]/25"
          : selectable
            ? "cursor-pointer border-[#e8e8ed] hover:border-[var(--ecom-chrome-accent)]/50 hover:shadow-md"
            : "border-[#e8e8ed]",
      )}
    >
      <header
        className={cn(
          "border-b px-3.5 py-3",
          selected ? "bg-[var(--ecom-content-selected-bg)]" : "bg-[#fafafa]",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded-full bg-[#1d1d1f] px-2 py-0.5 text-[10px] font-medium text-white">
            {planNoLabel}
          </span>
          {selected ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--ecom-primary-on-dark)]">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              已选用
            </span>
          ) : null}
        </div>
        <h3 className="text-[13px] font-semibold leading-snug text-[#1d1d1f]">{headline}</h3>
        {tagline ? (
          <p className="mt-1 text-[10px] leading-relaxed text-[#86868b]">
            {renderPlanRichText(tagline, "tag")}
          </p>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col divide-y divide-[#f0f0f2] px-3.5 py-1">
        {bodyRows.map((row, rowIndex) => (
          <div
            key={`${row.label}-${rowIndex}`}
            className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-x-2.5 py-2.5"
          >
            <p className="pt-0.5 text-[10px] font-medium leading-snug text-[#86868b]">
              {row.label}
            </p>
            <EditableField
              value={row.content}
              onSave={(content) => {
                const targetLabel = row.label;
                const next = rows.map((r) =>
                  r.label === targetLabel ? { ...r, content } : r,
                );
                onSaveRows(next);
              }}
            />
          </div>
        ))}
      </div>
    </article>
  );
}
