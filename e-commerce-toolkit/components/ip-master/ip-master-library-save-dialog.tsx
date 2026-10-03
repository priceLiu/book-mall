"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { EcomDialogCloseButton, EcomDialogPrimaryButton } from "@/components/ui/dialog";
import { sanitizeIpMasterLibraryLabel } from "@/lib/ip-master-library-label";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLabel: string;
  busy?: boolean;
  onConfirm: (libraryLabel: string) => void | Promise<void>;
};

export function IpMasterLibrarySaveDialog({
  open,
  onOpenChange,
  defaultLabel,
  busy,
  onConfirm,
}: Props) {
  const [name, setName] = useState(defaultLabel);
  const openSyncedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      openSyncedRef.current = false;
      return;
    }
    if (openSyncedRef.current) return;
    openSyncedRef.current = true;
    setName(defaultLabel);
  }, [open, defaultLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  const dismissOnBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget && !busy) onOpenChange(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-master-library-save-title"
      onClick={dismissOnBackdrop}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl bg-white p-6 shadow-xl",
          busy && "pointer-events-none opacity-80",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="ip-master-library-save-title" className="text-lg font-semibold text-[#1d1d1f]">
              保存进母版库
            </h2>
            <p className="mt-1 text-sm text-[#6e6e73]">
              系统已生成默认名称，可修改后在母版库 / 导入列表中显示。
            </p>
          </div>
          <EcomDialogCloseButton onClick={() => !busy && onOpenChange(false)} />
        </div>
        <label className="block text-xs font-medium text-[#6e6e73]">母版库条目名称</label>
        <input
          className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          placeholder={defaultLabel}
        />
        <p className="mt-2 text-[11px] text-[#86868b]">
          默认规则：IP 名称 + 版本号（如「波波仔 · V1.0」）。版本号仍由系统自动递增。
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm text-[#0071e3]"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <EcomDialogPrimaryButton
            disabled={busy}
            onClick={() =>
              void onConfirm(
                sanitizeIpMasterLibraryLabel(name.trim() || defaultLabel),
              )
            }
          >
            {busy ? "保存中…" : "保存"}
          </EcomDialogPrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
