"use client";

import { cn } from "@/lib/utils";

export type Pro2ColorBlockValue = {
  primary?: string;
  secondary?: string;
  highlight?: string;
  shadow?: string;
  notes?: string;
};

function normalizeHex(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t}`;
  return t;
}

function ColorSwatchInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const hex = normalizeHex(value ?? "");
  const pickerVal = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#888888";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-neutral-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          disabled={disabled}
          value={pickerVal}
          onChange={(e) => onChange(e.target.value)}
          className="nodrag size-8 shrink-0 cursor-pointer rounded border border-neutral-200 bg-white p-0.5"
          aria-label={`${label} 色块`}
        />
        <input
          type="text"
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#F5D76E"
          className="nodrag min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 font-mono text-[11px] text-neutral-800"
        />
      </div>
    </label>
  );
}

export function Pro2ColorBlockPicker({
  value,
  onChange,
  disabled,
  showSecondary = true,
  showNotes = false,
  className,
}: {
  value?: Pro2ColorBlockValue;
  onChange: (next: Pro2ColorBlockValue) => void;
  disabled?: boolean;
  showSecondary?: boolean;
  showNotes?: boolean;
  className?: string;
}) {
  const v = value ?? {};
  const set = (key: keyof Pro2ColorBlockValue, raw: string) => {
    onChange({ ...v, [key]: raw.trim() || undefined });
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-violet-200/80 bg-violet-50/40 p-3",
        className,
      )}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-violet-700/80">
        色块 / 调色板
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ColorSwatchInput
          label="主色 primary"
          value={v.primary}
          onChange={(n) => set("primary", n)}
          disabled={disabled}
        />
        {showSecondary ? (
          <ColorSwatchInput
            label="辅色 secondary"
            value={v.secondary}
            onChange={(n) => set("secondary", n)}
            disabled={disabled}
          />
        ) : null}
        <ColorSwatchInput
          label="高光 highlight"
          value={v.highlight}
          onChange={(n) => set("highlight", n)}
          disabled={disabled}
        />
        <ColorSwatchInput
          label="阴影 shadow"
          value={v.shadow}
          onChange={(n) => set("shadow", n)}
          disabled={disabled}
        />
      </div>
      {showNotes ? (
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-[10px] font-medium text-neutral-500">备注</span>
          <input
            type="text"
            disabled={disabled}
            value={v.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            className="nodrag rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-800"
          />
        </label>
      ) : null}
    </div>
  );
}
