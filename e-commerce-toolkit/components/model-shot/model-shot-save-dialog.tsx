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
} from "@/components/ui/dialog";

function sanitizeSaveName(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "服装模特图";
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
  defaultWorkName: string;
  busy?: boolean;
  onConfirm: (workName: string) => void | Promise<void>;
};

/** 保存服装模特图工作流镜像到资产库 */
export function ModelShotSaveDialog({
  open,
  onOpenChange,
  defaultWorkName,
  busy,
  onConfirm,
}: Props) {
  const [name, setName] = useState(defaultWorkName);
  const [timestampPreview] = useState(() => formatSaveTimestampPreview());

  useEffect(() => {
    if (open) setName(defaultWorkName);
  }, [open, defaultWorkName]);

  const titlePreview = useMemo(() => {
    const base = sanitizeSaveName(name.trim() || "服装模特图");
    return `${base}_${timestampPreview}`;
  }, [name, timestampPreview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>保存到资产库</DialogTitle>
          <DialogDescription>
            将服装/模特/场景参考、助手会话、姿势方案与已生成模特图镜像保存到「我的资产 →
            服装模特图」。可在资产库一键复用：换参考图后继续生成。
          </DialogDescription>
        </DialogHeader>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#6e6e73]">作品名</span>
          <input
            className="w-full rounded-lg border border-[#e8e8ed] px-3 py-2 text-sm text-[#1d1d1f] focus:border-[#0071e3]/40 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15"
            value={name}
            autoFocus
            disabled={busy}
            placeholder="如：春季连衣裙 6 姿势"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !busy) {
                e.preventDefault();
                void onConfirm(name.trim());
              }
            }}
          />
        </label>
        <p className="text-[11px] text-[#86868b]">
          保存文件名预览：<span className="font-mono text-[#424245]">{titlePreview}</span>
          <br />
          实际时间戳以点击保存时的服务器时间为准
        </p>
        <DialogFooter className="gap-2 sm:gap-2">
          <EcomDialogPrimaryButton
            disabled={!name.trim() || busy}
            onClick={() => void onConfirm(name.trim())}
          >
            {busy ? "保存中…" : "保存"}
          </EcomDialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
