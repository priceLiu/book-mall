"use client";

import Link from "next/link";
import { Check, ChevronDown, Cloud, Download, PanelLeft, PanelRight, Redo2, Undo2, Upload } from "lucide-react";
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
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  panelsDisabled?: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  /** 自动保存完成后的时间文案，例如 10:49 已保存 */
  savedLabel?: string | null;
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
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
  panelsDisabled = false,
  savedLabel,
}: Props) {
  const [fileOpen, setFileOpen] = useState(false);

  return (
    <header className="relative flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-3 py-2 lg:px-4">
      <PanelSideSwitch
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        onToggleLeft={onToggleLeft}
        onToggleRight={onToggleRight}
        disabled={panelsDisabled}
      />
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

      {savedLabel ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-[var(--ie-ink)]">
          <span className="relative inline-flex h-4 w-4 items-center justify-center" aria-hidden>
            <Cloud className="h-4 w-4" strokeWidth={1.75} />
            <Check className="absolute h-2 w-2" strokeWidth={3} />
          </span>
          {savedLabel}
        </span>
      ) : null}

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
              <FileMenuItem
                label={panelsDisabled ? "保存抠图" : "下载 PNG"}
                disabled={!canDownload}
                onClick={() => { setFileOpen(false); onDownload(); }}
              />
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

function PanelSideSwitch({
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
  disabled = false,
}: {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  disabled?: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="侧栏开关"
      className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-[var(--ie-border)] bg-[var(--ie-cream)] shadow-[0_1px_0_#fff,0_1px_2px_rgba(42,36,32,0.12)]"
    >
      <SideSwitchButton
        pressed={leftCollapsed}
        label={leftCollapsed ? "展开左栏" : "收起左栏"}
        icon={PanelLeft}
        disabled={disabled}
        onClick={onToggleLeft}
      />
      <span className="w-px self-stretch bg-[var(--ie-border-soft)]" aria-hidden />
      <SideSwitchButton
        pressed={rightCollapsed}
        label={rightCollapsed ? "展开右栏" : "收起右栏"}
        icon={PanelRight}
        disabled={disabled}
        onClick={onToggleRight}
      />
    </div>
  );
}

function SideSwitchButton({
  pressed,
  label,
  icon: Icon,
  disabled = false,
  onClick,
}: {
  pressed: boolean;
  disabled?: boolean;
  label: string;
  icon: typeof PanelLeft;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-11 items-center justify-center transition-colors",
        disabled && "cursor-not-allowed opacity-40",
        pressed
          ? "bg-[var(--ie-ink)] text-[var(--ie-cream)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]"
          : "bg-[var(--ie-cream)] text-[var(--ie-ink)] shadow-[inset_0_1px_0_#fff] hover:bg-[var(--ie-cream-muted)]",
        disabled && !pressed && "hover:bg-[var(--ie-cream)]",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
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