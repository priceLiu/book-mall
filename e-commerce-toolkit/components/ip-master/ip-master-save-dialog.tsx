"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { EcomDialogCloseButton, EcomDialogPrimaryButton } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function sanitizeSaveName(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "IP母版";
}

function formatSaveTimestampPreview(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultIpName: string;
  busy?: boolean;
  onConfirm: (ipName: string) => void | Promise<void>;
};

export function IpMasterSaveDialog({
  open,
  onOpenChange,
  defaultIpName,
  busy,
  onConfirm,
}: Props) {
  const [name, setName] = useState(defaultIpName);
  const [timestampPreview] = useState(() => formatSaveTimestampPreview());

  const openSyncedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      openSyncedRef.current = false;
      return;
    }
    if (openSyncedRef.current) return;
    openSyncedRef.current = true;
    setName(defaultIpName);
  }, [open, defaultIpName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onOpenChange]);

  const titlePreview = useMemo(() => {
    const base = sanitizeSaveName(name.trim() || "IP母版");
    return `${base}_${timestampPreview}`;
  }, [name, timestampPreview]);

  if (!open || typeof document === "undefined") return null;

  const dismissOnBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget && !busy) onOpenChange(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-master-save-title"
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
            <h2 id="ip-master-save-title" className="text-lg font-semibold text-[#1d1d1f]">
              保存 IP 母版工作流
            </h2>
            <p className="mt-1 text-sm text-[#6e6e73]">
              镜像写入「我的资产」，含基准图、模板版本与会话快照。
            </p>
          </div>
          <EcomDialogCloseButton onClick={() => !busy && onOpenChange(false)} />
        </div>
        <label className="block text-xs font-medium text-[#6e6e73]">IP 名称</label>
        <input
          className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <p className="mt-2 text-[11px] text-[#86868b]">保存标题预览：{titlePreview}</p>
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
            onClick={() => void onConfirm(name.trim() || defaultIpName)}
          >
            {busy ? "保存中…" : "保存"}
          </EcomDialogPrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
