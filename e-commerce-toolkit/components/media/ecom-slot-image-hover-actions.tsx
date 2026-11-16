"use client";

import type { ReactNode, MouseEvent } from "react";
import {
  Archive,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Sparkles,
  Video,
} from "lucide-react";

import {
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_SLOT_HOVER_ACTION_BTN_CLASS,
  ECOM_SLOT_HOVER_ACTIONS_GRID_CLASS,
  ECOM_SLOT_HOVER_ACTIONS_INLINE_GRID_CLASS,
  ECOM_SLOT_HOVER_OVERLAY_CLASS,
  ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { cn } from "@/lib/utils";

function stopClick(e: MouseEvent) {
  e.stopPropagation();
}

export type EcomSlotHoverActionBtnClass = "slot" | "storyboard";

export type EcomSlotImageHoverActionsProps = {
  onPreview?: () => void;
  onRegenerate?: () => void;
  onRefine?: () => void;
  /** 编辑 / 查看 Prompt（与 onPreviewPrompt 二选一） */
  onEditPrompt?: () => void;
  /** @deprecated 使用 onEditPrompt */
  onPreviewPrompt?: () => void;
  onDownload?: () => void;
  onGoToVideo?: () => void;
  onSaveToCatalog?: () => void;
  /** 无图占位 · 生成（Sparkles） */
  onQuickGenerate?: () => void;
  disabled?: boolean;
  btnVariant?: EcomSlotHoverActionBtnClass;
  /** overlay=有成图悬停；inline=无图占位区常显；embed=仅按钮（外层自备遮罩宫格） */
  layout?: "overlay" | "inline" | "embed";
};

function defaultBtnClass(variant: EcomSlotHoverActionBtnClass) {
  return variant === "storyboard"
    ? ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS
    : ECOM_SLOT_HOVER_ACTION_BTN_CLASS;
}

export function EcomSlotHoverActionButton({
  title,
  ariaLabel,
  disabled,
  className,
  onClick,
  children,
}: {
  title: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      disabled={disabled}
      className={cn(className, "pointer-events-auto justify-self-center")}
      onClick={(e) => {
        stopClick(e);
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** 电商成图槽 · 悬停宫格操作（主图 / 套图 / 详情点位 / 分镜格等统一） */
export function EcomSlotImageHoverActions({
  onPreview,
  onRegenerate,
  onRefine,
  onEditPrompt,
  onPreviewPrompt,
  onDownload,
  onGoToVideo,
  onSaveToCatalog,
  onQuickGenerate,
  disabled,
  btnVariant = "slot",
  layout = "overlay",
}: EcomSlotImageHoverActionsProps) {
  const onPrompt = onEditPrompt ?? onPreviewPrompt;
  const baseBtn = defaultBtnClass(btnVariant);
  const actionBtnClass = cn(baseBtn, disabled && "pointer-events-none opacity-50");

  const buttons: ReactNode[] = [];

  if (onPreview) {
    buttons.push(
      <EcomSlotHoverActionButton
        key="preview"
        title="预览"
        disabled={disabled}
        className={actionBtnClass}
        onClick={onPreview}
      >
        <Eye className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
      </EcomSlotHoverActionButton>,
    );
  }
  if (onRegenerate) {
    buttons.push(
      <EcomSlotHoverActionButton
        key="regenerate"
        title="重新生成"
        disabled={disabled}
        className={actionBtnClass}
        onClick={onRegenerate}
      >
        <RefreshCw className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
      </EcomSlotHoverActionButton>,
    );
  }
  if (onRefine) {
    buttons.push(
      <EcomSlotHoverActionButton
        key="refine"
        title="精修"
        disabled={disabled}
        className={actionBtnClass}
        onClick={onRefine}
      >
        <Sparkles className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
      </EcomSlotHoverActionButton>,
    );
  }
  if (onDownload) {
    buttons.push(
      <EcomSlotHoverActionButton
        key="download"
        title="下载"
        disabled={disabled}
        className={actionBtnClass}
        onClick={onDownload}
      >
        <Download className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
      </EcomSlotHoverActionButton>,
    );
  }
  if (onPrompt) {
    buttons.push(
      <EcomSlotHoverActionButton
        key="prompt"
        title={layout === "inline" ? "编辑 Prompt" : "编辑"}
        disabled={disabled}
        className={actionBtnClass}
        onClick={onPrompt}
      >
        <FileText className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
      </EcomSlotHoverActionButton>,
    );
  }
  if (onGoToVideo) {
    buttons.push(
      <EcomSlotHoverActionButton
        key="video"
        title="去做视频"
        disabled={disabled}
        className={actionBtnClass}
        onClick={onGoToVideo}
      >
        <Video className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
      </EcomSlotHoverActionButton>,
    );
  }
  if (onSaveToCatalog) {
    buttons.push(
      <EcomSlotHoverActionButton
        key="catalog"
        title="保存平台资产库"
        disabled={disabled}
        className={actionBtnClass}
        onClick={onSaveToCatalog}
      >
        <Archive className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
      </EcomSlotHoverActionButton>,
    );
  }
  if (onQuickGenerate) {
    buttons.push(
      <EcomSlotHoverActionButton
        key="generate"
        title="生成"
        disabled={disabled}
        className={actionBtnClass}
        onClick={onQuickGenerate}
      >
        <Sparkles className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
      </EcomSlotHoverActionButton>,
    );
  }

  if (buttons.length === 0) return null;

  if (layout === "inline") {
    return <div className={ECOM_SLOT_HOVER_ACTIONS_INLINE_GRID_CLASS}>{buttons}</div>;
  }

  if (layout === "embed") {
    return <>{buttons}</>;
  }

  return (
    <>
      <div aria-hidden className={ECOM_SLOT_HOVER_OVERLAY_CLASS} />
      <div className={ECOM_SLOT_HOVER_ACTIONS_GRID_CLASS}>{buttons}</div>
    </>
  );
}