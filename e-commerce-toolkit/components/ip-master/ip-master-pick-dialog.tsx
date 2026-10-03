"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

import { EcomDialogCloseButton, EcomDialogPrimaryButton } from "@/components/ui/dialog";
import {
  getIpMasterProject,
  listIpMasterProjectSummaries,
} from "@/lib/ecom-ip-master-api";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onConfirm: (opts: { ipMasterProjectId: string; version?: string }) => void | Promise<void>;
};

export function IpMasterPickDialog({ open, onOpenChange, busy, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<
    Array<{
      id: string;
      title: string | null;
      updatedAt: string;
      thumbnailUrl: string | null;
      activeVersion: string | null;
      importable?: boolean;
    }>
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ version: string; label: string }>>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | undefined>();

  const importableItems = useMemo(
    () => items.filter((i) => i.importable !== false && i.activeVersion),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void listIpMasterProjectSummaries()
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        const first = list.find((i) => i.importable !== false && i.activeVersion);
        setSelectedId(first?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selectedId) {
      setVersions([]);
      setSelectedVersion(undefined);
      return;
    }
    let cancelled = false;
    void getIpMasterProject(selectedId).then((p) => {
      if (cancelled) return;
      const vs = (p.meta?.templateVersions ?? []).map((v) => ({
        version: v.version,
        label: v.label?.trim() || v.version,
      }));
      setVersions(vs);
      const active =
        p.meta?.workflow?.activeVersion ?? vs[vs.length - 1]?.version ?? undefined;
      setSelectedVersion(active);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selectedId]);

  if (!open || typeof document === "undefined") return null;

  const dismissOnBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget && !busy) onOpenChange(false);
  };

  const canConfirm =
    Boolean(selectedId) &&
    Boolean(selectedVersion) &&
    importableItems.some((i) => i.id === selectedId);

  return createPortal(
    <div
      className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-master-pick-title"
      onClick={dismissOnBackdrop}
    >
      <div
        className={cn(
          "flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl",
          busy && "pointer-events-none opacity-80",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e8e8ed] p-5">
          <div>
            <h2 id="ip-master-pick-title" className="text-lg font-semibold text-[#1d1d1f]">
              从母版库导入
            </h2>
            <p className="mt-1 text-sm text-[#6e6e73]">
              仅展示已保存「基准图 + 结构化模板」的条目；导入后写入参考图并绑定 Prompt 约束。
            </p>
          </div>
          <EcomDialogCloseButton onClick={() => !busy && onOpenChange(false)} />
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8 text-[#86868b]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : importableItems.length === 0 ? (
            <p className="text-sm text-[#6e6e73]">
              母版库暂无可导入条目。请在「IP 母版」上传基准图、生成结构化模板并保存进母版库。
            </p>
          ) : (
            <ul className="space-y-2">
              {importableItems.map((item) => {
                const selected = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                        selected
                          ? "border-[#0071e3] bg-[#f0f6ff]"
                          : "border-[#e8e8ed] hover:border-[#d2d2d7]",
                      )}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#f5f5f7]">
                        {item.thumbnailUrl ? (
                          <Image
                            src={item.thumbnailUrl}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#1d1d1f]">
                          {item.title?.trim() || "未命名 IP 母版"}
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                          当前版 {item.activeVersion ?? "—"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {versions.length > 0 ? (
            <div className="mt-4">
              <label className="text-xs font-medium text-[#6e6e73]">模板版本</label>
              <select
                className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
                value={selectedVersion ?? ""}
                onChange={(e) => setSelectedVersion(e.target.value || undefined)}
                disabled={busy}
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e8e8ed] p-5">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm text-[#0071e3]"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <EcomDialogPrimaryButton
            disabled={busy || !canConfirm}
            onClick={() => {
              if (!selectedId || !canConfirm) return;
              void onConfirm({ ipMasterProjectId: selectedId, version: selectedVersion });
            }}
          >
            {busy ? "导入中…" : "导入"}
          </EcomDialogPrimaryButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
