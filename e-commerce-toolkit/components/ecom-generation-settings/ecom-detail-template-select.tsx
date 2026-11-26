"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_ECOM_DETAIL_TEMPLATE_ID,
  ECOM_DETAIL_TEMPLATE_OPTIONS,
  ecomDetailTemplateDisplayLine,
  type EcomDetailTemplateId,
} from "@/lib/ecom-generation-settings/detail-template";
import { cn } from "@/lib/utils";

type Props = {
  value: string | undefined;
  onChange: (id: EcomDetailTemplateId) => void;
  disabled?: boolean;
  className?: string;
};

function OptionRow({
  id,
  label,
  sizeHint,
  selected,
  onPick,
  indent,
}: {
  id: EcomDetailTemplateId;
  label: string;
  sizeHint?: string;
  selected: boolean;
  onPick: () => void;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-[var(--ecom-parchment)]",
        indent && "pl-6",
        selected && "bg-[var(--ecom-content-selected-bg)]",
      )}
      onClick={onPick}
    >
      <span
        className={cn(
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-[var(--ecom-outline-border)] bg-[var(--ecom-primary)]" : "border-[#c7c7cc]",
        )}
      >
        {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--ecom-ink)]">{label}</span>
      {sizeHint ? (
        <span className="shrink-0 tabular-nums text-[10px] text-[var(--ecom-subtle)]">{sizeHint}</span>
      ) : null}
    </button>
  );
}

/** 图 1 · 普通/高级 A+ 与通用比例（单选下拉） */
export function EcomDetailTemplateSelect({ value, onChange, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = (value ?? DEFAULT_ECOM_DETAIL_TEMPLATE_ID) as EcomDetailTemplateId;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const premium = ECOM_DETAIL_TEMPLATE_OPTIONS.filter((o) => o.group === "premium");
  const standard = ECOM_DETAIL_TEMPLATE_OPTIONS.filter((o) => o.group === "standard");
  const ratios = ECOM_DETAIL_TEMPLATE_OPTIONS.filter((o) => o.group === "ratio");

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border bg-[#fafafa] px-2.5 py-2 text-[11px]",
          open ? "border-[var(--ecom-outline-border)]" : "border-[var(--ecom-divider)]",
          disabled && "opacity-50",
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="truncate text-[var(--ecom-ink)]">{ecomDetailTemplateDisplayLine(current)}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[var(--ecom-subtle)]" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ecom-subtle)]" />
        )}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[var(--ecom-divider)] bg-white py-1 shadow-lg">
          <p className="px-3 py-1.5 text-[10px] font-medium text-[var(--ecom-subtle)]">高级A+</p>
          {premium.map((o) => (
            <OptionRow
              key={o.id}
              id={o.id}
              label={o.label}
              sizeHint={o.sizeHint}
              selected={current === o.id}
              indent
              onPick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            />
          ))}
          <p className="mt-1 border-t border-[var(--ecom-divider)] px-3 py-1.5 text-[10px] font-medium text-[var(--ecom-subtle)]">
            A+ 模板
          </p>
          {standard.map((o) => (
            <OptionRow
              key={o.id}
              id={o.id}
              label={o.label}
              sizeHint={o.sizeHint}
              selected={current === o.id}
              onPick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            />
          ))}
          <p className="mt-1 border-t border-[var(--ecom-divider)] px-3 py-1.5 text-[10px] font-medium text-[var(--ecom-subtle)]">
            通用比例
          </p>
          {ratios.map((o) => (
            <OptionRow
              key={o.id}
              id={o.id}
              label={o.label}
              selected={current === o.id}
              onPick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
