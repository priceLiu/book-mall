"use client";

import Link from "next/link";
import { ChevronDown, Download, Redo2, Undo2, Upload } from "lucide-react";
import { useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";

type Props = {
  canUndo: boolean;
  canRedo: boolean;
  canDownload: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenFile: () => void;
  onDownload: () => void;
  onOpenNewTab: () => void;
};

export function ImageEditorHeader({
  canUndo,
  canRedo,
  canDownload,
  onUndo,
  onRedo,
  onOpenFile,
  onDownload,
  onOpenNewTab,
}: Props) {
  const [fileOpen, setFileOpen] = useState(false);

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-3 py-2 lg:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-[13px] font-semibold text-[var(--ie-ink)]">电商设计室</span>
        <div className="hidden items-center gap-1 md:flex">
          <span className="rounded-lg bg-[var(--ie-cream-muted)] px-2.5 py-1 text-[12px] font-semibold text-[var(--ie-ink)]">
            图片编辑
          </span>
          <Link
            href="/brand/poster"
            className="rounded-lg px-2.5 py-1 text-[12px] text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] hover:text-[var(--ie-ink)]"
          >
            海报设计
          </Link>
        </div>
      </div>

      <div className="min-w-2 flex-1" aria-hidden />

      <div className="relative">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--ie-border-soft)] px-2.5 py-1.5 text-[12px] text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)]"
          onClick={() => setFileOpen((v) => !v)}
        >
          文件
          <ChevronDown className="h-3.5 w-3.5 text-[var(--ie-subtle)]" />
        </button>
        {fileOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[80] cursor-default"
              aria-label="关闭菜单"
              onClick={() => setFileOpen(false)}
            />
            <div className="absolute right-0 top-full z-[90] mt-1 min-w-[10rem] rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] py-1 shadow-lg">
              <FileMenuItem label="打开图片…" onClick={() => { setFileOpen(false); onOpenFile(); }} />
              <FileMenuItem label="下载 PNG" disabled={!canDownload} onClick={() => { setFileOpen(false); onDownload(); }} />
              <FileMenuItem label="新标签页打开" onClick={() => { setFileOpen(false); onOpenNewTab(); }} />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <ToolbarIconBtn label="撤销" disabled={!canUndo} onClick={onUndo} icon={Undo2} />
        <ToolbarIconBtn label="重做" disabled={!canRedo} onClick={onRedo} icon={Redo2} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <EcomButtonSecondary size="sm" type="button" className="gap-1" onClick={onOpenFile}>
          <Upload className="h-3.5 w-3.5" />
          打开图片
        </EcomButtonSecondary>
        <EcomButtonPrimary size="sm" type="button" className="gap-1" disabled={!canDownload} onClick={onDownload}>
          <Download className="h-3.5 w-3.5" />
          下载
        </EcomButtonPrimary>
      </div>
    </header>
  );
}

function FileMenuItem({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="block w-full px-3 py-2 text-left text-[12px] text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ToolbarIconBtn({
  label,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  icon: typeof Undo2;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      className={cn(
        "rounded-lg border border-[var(--ie-border-soft)] p-2 text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] hover:text-[var(--ie-ink)] disabled:opacity-40",
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}