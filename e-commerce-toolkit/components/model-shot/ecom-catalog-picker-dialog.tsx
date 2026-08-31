"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { EcomDialogCloseButton } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CatalogPickerEntry = {
  id: string;
  name: string;
  subtitle: string;
  scope?: "platform" | "user";
  lockedAt?: string | null;
};

type Props = {
  open: boolean;
  title: string;
  entries: CatalogPickerEntry[];
  onOpenChange: (open: boolean) => void;
  onPick: (entry: CatalogPickerEntry) => void | Promise<void>;
};

export function EcomCatalogPickerDialog({
  open,
  title,
  entries,
  onOpenChange,
  onPick,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const platform = entries.filter((e) => (e.scope ?? "platform") === "platform");
    const user = entries.filter((e) => e.scope === "user");
    return { platform, user };
  }, [entries]);

  useEffect(() => {
    if (!open) setBusyId(null);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[#e5e5ea] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e5e5ea] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">{title}</h2>
          <EcomDialogCloseButton onClick={() => onOpenChange(false)} />
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {grouped.platform.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-medium text-[#86868b]">系统推荐</p>
              <div className="space-y-1">
                {grouped.platform.map((entry) => (
                  <CatalogPickerRow
                    key={entry.id}
                    entry={entry}
                    busy={busyId === entry.id}
                    onPick={async () => {
                      setBusyId(entry.id);
                      try {
                        await onPick(entry);
                        onOpenChange(false);
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {grouped.user.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-medium text-[#86868b]">我的库</p>
              <div className="space-y-1">
                {grouped.user.map((entry) => (
                  <CatalogPickerRow
                    key={entry.id}
                    entry={entry}
                    busy={busyId === entry.id}
                    onPick={async () => {
                      setBusyId(entry.id);
                      try {
                        await onPick(entry);
                        onOpenChange(false);
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {entries.length === 0 ? (
            <p className="text-center text-sm text-[#86868b]">暂无条目</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CatalogPickerRow({
  entry,
  busy,
  onPick,
}: {
  entry: CatalogPickerEntry;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onPick()}
      className={cn(
        "w-full rounded-xl border border-[#e5e5ea] px-3 py-2 text-left transition hover:border-[#0071e3] hover:bg-[#f0f6ff]",
        busy && "opacity-60",
      )}
    >
      <div className="text-sm font-medium text-[#1d1d1f]">{entry.name}</div>
      <div className="mt-0.5 line-clamp-2 text-xs text-[#86868b]">{entry.subtitle}</div>
    </button>
  );
}
