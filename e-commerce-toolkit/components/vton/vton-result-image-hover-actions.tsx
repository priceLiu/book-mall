"use client";

import { Download, Eye, Save, Shirt } from "lucide-react";

import {
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS,
  ECOM_SLOT_HOVER_OVERLAY_CLASS,
  ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { cn } from "@/lib/utils";

type Props = {
  onPreview?: () => void;
  onDownload?: () => void;
  onSaveToAssets?: () => void;
  onOpenFittingRoom?: () => void;
  disabled?: boolean;
};

function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

export function VtonResultImageHoverActions({
  onPreview,
  onDownload,
  onSaveToAssets,
  onOpenFittingRoom,
  disabled,
}: Props) {
  if (!onPreview && !onDownload && !onSaveToAssets && !onOpenFittingRoom) return null;

  const btnClass = cn(
    ECOM_STORYBOARD_HOVER_ACTION_BTN_CLASS,
    disabled && "pointer-events-none opacity-50",
  );

  return (
    <>
      <div aria-hidden className={ECOM_SLOT_HOVER_OVERLAY_CLASS} />
      <div className={ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS}>
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
            <Eye className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onDownload ? (
          <button
            type="button"
            title="下载"
            aria-label="下载"
            className={cn(btnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onDownload();
            }}
          >
            <Download className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onSaveToAssets ? (
          <button
            type="button"
            title="保存到试衣库"
            aria-label="保存到试衣库"
            className={cn(btnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onSaveToAssets();
            }}
          >
            <Save className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onOpenFittingRoom ? (
          <button
            type="button"
            title="试衣库"
            aria-label="试衣库"
            className={cn(btnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onOpenFittingRoom();
            }}
          >
            <Shirt className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
      </div>
    </>
  );
}
