"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EcomDialogPrimaryButton,
  EcomDialogCancelButton,
} from "@/components/ui/dialog";

function sanitizeSaveName(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "手伴IP";
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

/** 保存手伴工作流镜像到资产库：IP 名可改，时间戳由服务端自动追加 */
export function HandCraftSaveDialog({
  open,
  onOpenChange,
  defaultIpName,
  busy,
  onConfirm,
}: Props) {
  const [name, setName] = useState(defaultIpName);
  const [timestampPreview] = useState(() => formatSaveTimestampPreview());

  useEffect(() => {
    if (open) setName(defaultIpName);
  }, [open, defaultIpName]);

  const titlePreview = useMemo(() => {
    const base = sanitizeSaveName(name.trim() || "手伴IP");
    return `${base}_${timestampPreview}`;
  }, [name, timestampPreview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>保存到资产库</DialogTitle>
          <DialogDescription>
            将完整手伴工作流（线稿、10 步计划、会话与设置）镜像保存到「我的资产 · 手伴创作」。
            可在资产库一键复用：复制流程后换线稿即可再出图。
          </DialogDescription>
        </DialogHeader>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#6e6e73]">IP 名</span>
          <input
            className="w-full rounded-lg border border-[#e8e8ed] px-3 py-2 text-sm text-[#1d1d1f] focus:border-[#0071e3]/40 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15"
            value={name}
            autoFocus
            disabled={busy}
            placeholder="如：灰紫潮玩小兔"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !busy) {
                e.preventDefault();
                void onConfirm(name.trim());
              }
            }}
          />
        </label>
        <p className="rounded-lg bg-[#f5f5f7] px-3 py-2 font-mono text-[11px] text-[#6e6e73]">
          资产库标题预览：{titlePreview}
          <span className="mt-1 block text-[10px] text-[#86868b]">
            实际时间戳以点击保存时的服务器时间为准
          </span>
        </p>
        <DialogFooter>
          <EcomDialogCancelButton disabled={busy} onClick={() => onOpenChange(false)}>
            取消
          </EcomDialogCancelButton>
          <EcomDialogPrimaryButton
            disabled={busy || !name.trim()}
            onClick={() => void onConfirm(name.trim())}
          >
            {busy ? "保存中…" : "保存"}
          </EcomDialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
