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
  /** 为 true 时展示上传进度（uploadProgress 为 null 时为不确定进度） */
  showUploadProgress?: boolean;
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
  /** 渲染在标题行右侧、「我的资产 / 上传」钮左侧（与上传钮同排） */
  headerActions?: React.ReactNode;
  /** @deprecated 使用 headerActions；保留兼容旧布局（标题下方第二行） */
  toolbarPrefix?: React.ReactNode;
  accept?: string;
  multiple?: boolean;
  /** 拖放 / 粘贴同时接受视频（拆图拆视频） */
  allowVideo?: boolean;
  /** 为 false 时仅拖放，粘贴由父级热区统一处理 */
  listenPaste?: boolean;
  /** 标题由父级渲染在卡片外时使用 */
  hideTitle?: boolean;
  /** 内容区最小高度（服装池等需更高空状态） */
  contentMinHeightClass?: string;
  /** 为 true 时不于内容区展示 emptyHint（提示由父级放在卡片外） */
  hideEmptyHint?: boolean;
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
  uploadProgress,
  uploadProgressLabel,
  showUploadProgress = false,
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
  headerActions,
  toolbarPrefix,
  accept = IMAGE_UPLOAD_ACCEPT,
  multiple = true,
  allowVideo = false,
  listenPaste = true,
  hideTitle = false,
  contentMinHeightClass = "min-h-[56px]",
  hideEmptyHint = false,
}: Props) {
  const { dragOver, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: !busy && !generating,
    multiple,
    allowVideo,
    listenPaste,
    onFiles: onUploadFiles,
  });

  const highlight = dragOver;

  const setInputRef = (el: HTMLInputElement | null) => {
    if (typeof inputRef === "function") {
      inputRef(el);
    } else if (inputRef && "current" in inputRef) {
      (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    }
  };

  const TitleTag = onTitleClick ? "button" : "span";
  const progressVisible = showUploadProgress || typeof uploadProgress === "number";

  return (
    <div
      {...dropZoneProps}
      className={cn(
        "rounded-lg border px-2.5 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#0071e3]/30",
        highlight && "border-[#0071e3] bg-white ring-1 ring-[#0071e3]/30",
        !highlight && suggested && "border-[#0071e3]/45 bg-white ring-1 ring-[#0071e3]/15",
        !highlight && !suggested && "border-[#e8e8ed] bg-white hover:border-[#0071e3]/40",
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
      <div className={cn("mb-1.5", toolbarPrefix ? "space-y-2" : undefined)}>
        <div
          className={cn(
            "flex items-center gap-2",
            hideTitle ? "justify-end" : "justify-between",
          )}
        >
          {!hideTitle ? (
            <TitleTag
              type={onTitleClick ? "button" : undefined}
              className="min-w-0 text-left text-xs font-semibold text-[#1d1d1f]"
              onClick={onTitleClick}
            >
              {title}
            </TitleTag>
          ) : null}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {headerActions}
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
        {toolbarPrefix ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{toolbarPrefix}</div>
        ) : null}
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

      {progressVisible ? (
        <div className="mb-2 space-y-1">
          <div
            className={cn(
              "ecom-upload-progress",
              typeof uploadProgress !== "number" && "ecom-upload-progress-indeterminate",
            )}
          >
            <span
              style={
                typeof uploadProgress === "number"
                  ? { width: `${Math.min(100, Math.max(0, uploadProgress))}%` }
                  : undefined
              }
            />
          </div>
          <p className="text-[10px] text-[#0071e3]">
            {typeof uploadProgress === "number" && uploadProgress >= 100
              ? "完成"
              : (uploadProgressLabel?.trim() || "正在上传…")}
          </p>
        </div>
      ) : null}

      <div className={cn("relative", toolbarPrefix ? "min-h-[80px]" : contentMinHeightClass)}>
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
              ),
            )}
          </div>
        ) : !generating ? (
          hideEmptyHint ? (
            highlight ? (
              <p className="text-[10px] text-[#0071e3]">松开以上传</p>
            ) : null
          ) : (
            <p className={cn("text-[10px]", highlight ? "text-[#0071e3]" : "text-[#86868b]")}>
              {highlight ? "松开以上传" : emptyHint}
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}
