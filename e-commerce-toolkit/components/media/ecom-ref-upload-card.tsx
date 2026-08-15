"use client";

import { Images, Plus } from "lucide-react";
import type React from "react";

import { EcomRefImageThumb } from "@/components/media/ecom-ref-image-thumb";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { cn } from "@/lib/utils";

export type EcomRefUploadItem = {
  id: string;
  ossUrl: string;
  label: string;
};

type Props = {
  title: string;
  items: EcomRefUploadItem[];
  emptyHint: string;
  busy?: boolean;
  /** 0–100 上传进度；null 表示不确定进度 */
  uploadProgress?: number | null;
  /** 助手步骤建议高亮（微剧故事版） */
  suggested?: boolean;
  onUploadFiles: (files: File[]) => void;
  onOpenFilePicker: () => void;
  onOpenAssetPicker?: () => void;
  onRemove?: (id: string) => void;
  removeLabel?: string;
  onTitleClick?: () => void;
  onMouseEnterCard?: () => void;
  onMouseLeaveCard?: () => void;
  inputRef?: ((el: HTMLInputElement | null) => void) | React.RefObject<HTMLInputElement | null>;
  /** 渲染在「上传」钮左侧（与上传钮同排） */
  toolbarPrefix?: React.ReactNode;
};

/** 产品图 / 素材图上传卡片 — 电商产品创作与微剧故事版统一 */
export function EcomRefUploadCard({
  title,
  items,
  emptyHint,
  busy,
  uploadProgress = null,
  suggested = false,
  onUploadFiles,
  onOpenFilePicker,
  onOpenAssetPicker,
  onRemove,
  removeLabel = "删除",
  onTitleClick,
  inputRef,
  toolbarPrefix,
}: Props) {
  const { dragOver, pasteReady, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: !busy,
    multiple: true,
    onFiles: onUploadFiles,
  });

  const highlight = dragOver || pasteReady;

  const setInputRef = (el: HTMLInputElement | null) => {
    if (typeof inputRef === "function") {
      inputRef(el);
    } else if (inputRef && "current" in inputRef) {
      (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    }
  };

  const TitleTag = onTitleClick ? "button" : "span";

  return (
    <div
      {...dropZoneProps}
      className={cn(
        "rounded-lg border px-2.5 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#0071e3]/30",
        highlight && "border-[#0071e3] bg-white ring-1 ring-[#0071e3]/30",
        !highlight && suggested && "border-[#0071e3]/45 bg-white ring-1 ring-[#0071e3]/15",
        !highlight && !suggested && "border-[#e8e8ed] bg-white",
      )}
      onMouseEnter={dropZoneProps.onMouseEnter}
      onMouseLeave={dropZoneProps.onMouseLeave}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <TitleTag
          type={onTitleClick ? "button" : undefined}
          className="text-left text-xs font-semibold text-[#1d1d1f]"
          onClick={onTitleClick}
        >
          {title}
          {highlight ? (
            <span className="ml-1.5 text-[10px] font-normal text-[#0071e3]">
              可拖放 / Ctrl+V 粘贴
            </span>
          ) : null}
        </TitleTag>
        <div className="flex shrink-0 gap-1.5">
          {toolbarPrefix}
          {onOpenAssetPicker ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={busy}
              className="h-7 px-2 text-[10px]"
              onClick={() => {
                focusZone();
                onOpenAssetPicker();
              }}
            >
              <Images className="h-3 w-3 shrink-0" />
              我的资产
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={busy}
            className="h-7 px-2 text-[10px]"
            onClick={() => {
              focusZone();
              onOpenFilePicker();
            }}
          >
            <Plus className="h-3 w-3 shrink-0" />
            上传
          </EcomButtonSecondary>
        </div>
      </div>

      <input
        ref={setInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) onUploadFiles(Array.from(files));
          e.target.value = "";
        }}
      />

      {uploadProgress != null ? (
        <div className="mb-2 space-y-1">
          <div className="ecom-upload-progress">
            <span
              style={{
                width: `${Math.min(100, Math.max(0, uploadProgress))}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-[#0071e3]">
            {uploadProgress >= 100 ? "上传完成" : "正在上传…"}
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((r) => (
            <EcomRefImageThumb
              key={r.id}
              src={r.ossUrl}
              alt={r.label}
              size={56}
              onRemove={onRemove ? () => void onRemove(r.id) : undefined}
              removeLabel={removeLabel}
            />
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[#86868b]">{emptyHint}</p>
      )}
    </div>
  );
}
