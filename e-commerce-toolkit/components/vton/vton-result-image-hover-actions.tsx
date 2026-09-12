"use client";

import { Archive, Download, Eye, RefreshCw, Save, Shirt, Sparkles } from "lucide-react";

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
  onSaveToCatalog?: () => void;
  onRegenerate?: () => void;
  onRefine?: () => void;
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
  onSaveToCatalog,
  onRegenerate,
  onRefine,
  onOpenFittingRoom,
  disabled,
}: Props) {
  if (
    !onPreview &&
    !onDownload &&
    !onSaveToAssets &&
    !onSaveToCatalog &&
    !onRegenerate &&
    !onRefine &&
    !onOpenFittingRoom
  ) {
    return null;
  }

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
        {onSaveToCatalog ? (
          <button
            type="button"
            title="保存到库"
            aria-label="保存到库"
            className={cn(btnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onSaveToCatalog();
            }}
          >
            <Archive className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onRegenerate ? (
          <button
            type="button"
            title="重新生成"
            aria-label="重新生成"
            className={cn(btnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onRegenerate();
            }}
          >
            <RefreshCw className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
          </button>
        ) : null}
        {onRefine ? (
          <button
            type="button"
            title="精修"
            aria-label="精修"
            className={cn(btnClass, "pointer-events-auto")}
            disabled={disabled}
            onClick={(e) => {
              stopClick(e);
              onRefine();
            }}
          >
            <Sparkles className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
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
