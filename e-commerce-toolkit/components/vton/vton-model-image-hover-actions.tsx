"use client";

import { Eye, Save, Trash2 } from "lucide-react";

import {
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS,
  ECOM_SLOT_HOVER_OVERLAY_CLASS,
  ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { cn } from "@/lib/utils";

type Props = {
  onPreview?: () => void;
  onSaveToMyModels?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  /** 侧栏窄缩略图：固定三钮横排，避免 clamp 比例在窄格内变形 */
  variant?: "default" | "thumb";
};

function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

const THUMB_HOVER_OVERLAY_CLASS =
  "pointer-events-none absolute inset-x-0 top-0 z-10 aspect-[3/4] bg-black/45 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100";

const THUMB_HOVER_ACTIONS_ROW_CLASS =
  "pointer-events-none absolute inset-x-0 top-0 z-20 flex aspect-[3/4] items-center justify-center gap-1.5 px-1 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100";

const THUMB_HOVER_BTN_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-md ring-1 ring-black/10 transition hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-50";

const THUMB_HOVER_ICON_CLASS = "h-3.5 w-3.5";

export function VtonModelImageHoverActions({
  onPreview,
  onSaveToMyModels,
  onDelete,
  disabled,
  variant = "default",
}: Props) {
  if (!onPreview && !onSaveToMyModels && !onDelete) return null;

  const isThumb = variant === "thumb";
  const btnClass = cn(
    isThumb ? THUMB_HOVER_BTN_CLASS : ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
    disabled && "pointer-events-none opacity-50",
  );
  const iconClass = isThumb ? THUMB_HOVER_ICON_CLASS : ECOM_MEDIA_TILE_ACTION_ICON_CLASS;

  return (
    <>
      <div
        aria-hidden
        className={isThumb ? THUMB_HOVER_OVERLAY_CLASS : ECOM_SLOT_HOVER_OVERLAY_CLASS}
      />
      <div className={isThumb ? THUMB_HOVER_ACTIONS_ROW_CLASS : ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS}>
        {onPreview ? (
          <button
            type="button"
            title="预览"
            aria-label="预览"
            className={cn(btnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onPreview();
            }}
          >
            <Eye className={iconClass} />
          </button>
        ) : null}
        {onSaveToMyModels ? (
          <button
            type="button"
            title="保存到我的模特"
            aria-label="保存到我的模特"
            className={cn(btnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onSaveToMyModels();
            }}
          >
            <Save className={iconClass} />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            title="从本项目移除"
            aria-label="从本项目移除"
            className={cn(btnClass, "pointer-events-auto text-red-100 hover:bg-red-600/80")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onDelete();
            }}
          >
            <Trash2 className={iconClass} />
          </button>
        ) : null}
      </div>
    </>
  );
}
