"use client";

import { Check, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  value: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  /** light = 主内容呈现区浅色底（默认） */
  variant?: "light" | "dark";
  onSave: (value: string) => void | Promise<void>;
};

/** 主内容区 · 点击铅笔就地编辑文案，失焦或点保存落库 */
export function ProductDesignEditableField({
  label,
  value,
  multiline = false,
  rows = 3,
  className,
  variant = "light",
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const isDark = variant === "dark";

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
    const Input = multiline ? "textarea" : "input";
    return (
      <div className={cn("space-y-1", className)}>
        {label ? (
          <span
            className={cn(
              "text-[10px] font-medium",
              isDark ? "text-[var(--ecom-chrome-text-subtle)]" : "text-[#86868b]",
            )}
          >
            {label}
          </span>
        ) : null}
        <Input
          className={cn(
            "w-full rounded-lg border px-2 py-1.5 text-[11px] outline-none",
            isDark
              ? "border-[var(--ecom-chrome-accent)]/50 bg-[var(--ecom-chrome-surface-raised)] text-[var(--ecom-chrome-text)] ring-2 ring-[var(--ecom-chrome-accent)]/20"
              : "border-[#0071e3]/40 bg-white text-[#1d1d1f] ring-2 ring-[#0071e3]/15",
          )}
          value={draft}
          rows={multiline ? rows : undefined}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (!multiline && e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          autoFocus
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
            dark={isDark}
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
    <div className={cn("group flex items-start gap-1", className)}>
      <div className="min-w-0 flex-1">
        {label ? (
          <span
            className={cn(
              "mb-0.5 block text-[10px] font-medium",
              isDark ? "text-[var(--ecom-chrome-text-subtle)]" : "text-[#86868b]",
            )}
          >
            {label}
          </span>
        ) : null}
        <p
          className={cn(
            "whitespace-pre-wrap text-[11px] leading-relaxed",
            isDark ? "text-[var(--ecom-chrome-text-muted)]" : "text-[#6e6e73]",
          )}
        >
          {value || "—"}
        </p>
      </div>
      <button
        type="button"
        className={cn(
          "mt-0.5 shrink-0 rounded p-1 opacity-0 transition group-hover:opacity-100",
          isDark
            ? "text-[var(--ecom-chrome-text-subtle)] hover:bg-[var(--ecom-chrome-hover)] hover:text-[var(--ecom-chrome-text)]"
            : "text-[#86868b] hover:bg-[#f0f0f2] hover:text-[#1d1d1f]",
        )}
        title="编辑"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
