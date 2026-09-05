"use client";

import { Images, Play, Plus, X } from "lucide-react";
import type React from "react";

import { EcomRefImageThumb } from "@/components/media/ecom-ref-image-thumb";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomVideoThumb } from "@/components/media/ecom-video-player";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/image-upload-utils";
import { cn } from "@/lib/utils";

export type EcomRefUploadItem = {
  id: string;
  ossUrl: string;
  label: string;
  kind?: "image" | "video";
};

type Props = {
  title: string;
  items: EcomRefUploadItem[];
  emptyHint: string;
  busy?: boolean;
  /** 0–100 上传进度；null 表示不确定进度 */
  uploadProgress?: number | null;
  /** 进度条下方文案；默认「正在上传…」 */
  uploadProgressLabel?: string;
  /** AI 生图进行中（槽位扫光） */
  generating?: boolean;
  generatingLabel?: string;
  /** 助手步骤建议高亮（微剧故事版） */
  suggested?: boolean;
  onUploadFiles: (files: File[]) => void;
  onOpenFilePicker: () => void;
  onOpenAssetPicker?: () => void;
  onRemove?: (id: string) => void;
  onPreviewItem?: (item: EcomRefUploadItem) => void;
  removeLabel?: string;
  onTitleClick?: () => void;
  onMouseEnterCard?: () => void;
  onMouseLeaveCard?: () => void;
  inputRef?: ((el: HTMLInputElement | null) => void) | React.RefObject<HTMLInputElement | null>;
  /** 渲染在「上传」钮左侧（与上传钮同排） */
  toolbarPrefix?: React.ReactNode;
  accept?: string;
  multiple?: boolean;
  /** 拖放 / 粘贴同时接受视频（拆图拆视频） */
  allowVideo?: boolean;
  /** 为 false 时仅拖放，粘贴由父级热区统一处理 */
  listenPaste?: boolean;
};

const REF_THUMB_SIZE = 56;

function EcomRefGeneratingThumb({ label }: { label: string }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md border border-[#d2d2d7] bg-[#ececee]"
      style={{ width: REF_THUMB_SIZE, height: REF_THUMB_SIZE }}
      aria-busy
      aria-label={label}
    >
      <EcomMediaGeneratingBusy
        className="absolute inset-0"
        background="black"
      />
    </div>
  );
}

function EcomRefVideoThumb({
  src,
  alt,
  size = 56,
  onRemove,
  removeLabel = "删除",
  onPreview,
}: {
  src: string;
  alt: string;
  size?: number;
  onRemove?: () => void;
  removeLabel?: string;
  onPreview?: () => void;
}) {
  return (
    <div className="group relative shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        title={alt}
        className="relative h-full w-full overflow-hidden rounded-md border border-[#d2d2d7] bg-black"
        onClick={onPreview}
      >
        <EcomVideoThumb src={src} className="absolute inset-0 size-full" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
          <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
        </span>
      </button>
      {onRemove ? (
        <button
          type="button"
          className="absolute right-0.5 top-0.5 z-[1] rounded-full bg-black/65 p-0.5 text-white"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={removeLabel}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

/** 产品图 / 素材图上传卡片 — 电商产品创作与微剧故事版统一 */
export function EcomRefUploadCard({
  title,
  items,
  emptyHint,
  busy,
  uploadProgress = null,
  uploadProgressLabel,
  generating = false,
  generatingLabel = "AI 生成中…",
  suggested = false,
  onUploadFiles,
  onOpenFilePicker,
  onOpenAssetPicker,
  onRemove,
  onPreviewItem,
  removeLabel = "删除",
  onTitleClick,
  onMouseEnterCard,
  onMouseLeaveCard,
  inputRef,
  toolbarPrefix,
  accept = IMAGE_UPLOAD_ACCEPT,
  multiple = true,
  allowVideo = false,
  listenPaste = true,
}: Props) {
  const { dragOver, pasteReady, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: !busy && !generating,
    multiple,
    allowVideo,
    listenPaste,
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
      onMouseEnter={() => {
        dropZoneProps.onMouseEnter?.();
        onMouseEnterCard?.();
      }}
      onMouseLeave={() => {
        dropZoneProps.onMouseLeave?.();
        onMouseLeaveCard?.();
      }}
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
        accept={accept}
        multiple={multiple}
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
            {uploadProgress >= 100
              ? "完成"
              : (uploadProgressLabel?.trim() || "正在上传…")}
          </p>
        </div>
      ) : null}

      <div className="relative min-h-[56px]">
        {generating && items.length === 0 ? (
          <EcomRefGeneratingThumb label={generatingLabel} />
        ) : null}

        {items.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {items.map((r) =>
              r.kind === "video" ? (
                <div
                  key={r.id}
                  className="relative shrink-0"
                  style={{ width: REF_THUMB_SIZE, height: REF_THUMB_SIZE }}
                >
                  <EcomRefVideoThumb
                    src={r.ossUrl}
                    alt={r.label}
                    size={REF_THUMB_SIZE}
                    onPreview={onPreviewItem ? () => onPreviewItem(r) : undefined}
                    onRemove={onRemove ? () => void onRemove(r.id) : undefined}
                    removeLabel={removeLabel}
                  />
                  {generating ? (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
                      <EcomMediaGeneratingBusy
                        className="absolute inset-0"
                        background="black"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  key={r.id}
                  className="relative shrink-0"
                  style={{ width: REF_THUMB_SIZE, height: REF_THUMB_SIZE }}
                >
                  <EcomRefImageThumb
                    src={r.ossUrl}
                    alt={r.label}
                    size={REF_THUMB_SIZE}
                    onRemove={onRemove ? () => void onRemove(r.id) : undefined}
                    removeLabel={removeLabel}
                  />
                  {generating ? (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
                      <EcomMediaGeneratingBusy
                        className="absolute inset-0"
                        background="black"
                      />
                    </div>
                  ) : null}
                </div>
              ),
            )}
          </div>
        ) : !generating ? (
          <p className="text-[10px] text-[#86868b]">{emptyHint}</p>
        ) : null}
      </div>
    </div>
  );
}
