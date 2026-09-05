"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Eye, X } from "lucide-react";
import { createPortal } from "react-dom";

import { useAdminMediaPasteTarget } from "@/components/admin/template-admin/admin-media-paste-context";
import { FullscreenImagePreview } from "@/components/media/fullscreen-image-preview";

export type AdminMediaAccept = "image" | "video" | "media";

function acceptAttr(accept: AdminMediaAccept): string {
  if (accept === "image") return "image/*";
  if (accept === "video") return "video/*";
  return "image/*,video/*";
}

function isVideoUrl(url: string, accept: AdminMediaAccept): boolean {
  if (accept === "video") return true;
  if (accept === "image") return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.trim());
}

function fileMatches(file: File, accept: AdminMediaAccept): boolean {
  const type = file.type || "";
  if (accept === "image") return type.startsWith("image/") || !type;
  if (accept === "video") return type.startsWith("video/") || !type;
  return type.startsWith("image/") || type.startsWith("video/") || !type;
}

function extractMediaFiles(
  data: DataTransfer | null | undefined,
  accept: AdminMediaAccept,
): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && fileMatches(file, accept)) out.push(file);
  }
  if (out.length) return out;
  for (const file of Array.from(data.files ?? [])) {
    if (fileMatches(file, accept)) out.push(file);
  }
  return out;
}

function pointerLeftElement(
  container: HTMLElement | null,
  relatedTarget: EventTarget | null,
): boolean {
  if (!container) return true;
  if (!relatedTarget || !(relatedTarget instanceof Node)) return true;
  return !container.contains(relatedTarget);
}

function MediaPreview({
  url,
  accept,
  className,
  hoverChrome = "default",
}: {
  url: string;
  accept: AdminMediaAccept;
  className?: string;
  hoverChrome?: "default" | "canvas";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const video = isVideoUrl(url, accept);

  if (video) {
    return (
      <video
        ref={videoRef}
        src={url}
        controls={hoverChrome !== "canvas"}
        muted={hoverChrome === "canvas"}
        loop={hoverChrome === "canvas"}
        playsInline
        className={className ?? "max-h-56 w-full rounded-md bg-black object-contain"}
        onMouseEnter={() => {
          if (hoverChrome !== "canvas") return;
          void videoRef.current?.play().catch(() => undefined);
        }}
        onMouseLeave={() => {
          if (hoverChrome !== "canvas") return;
          const el = videoRef.current;
          if (!el) return;
          el.pause();
          el.currentTime = 0;
        }}
      />
    );
  }

  if (hoverChrome === "canvas") {
    return (
      <>
        <div className="group/media relative inline-block max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className={className ?? "max-h-56 w-full rounded-md object-contain"}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover/media:opacity-100">
            <button
              type="button"
              title="预览大图"
              aria-label="预览大图"
              className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreen(true);
              }}
            >
              <Eye className="size-4 pointer-events-none" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        {fullscreen
          ? createPortal(
              <FullscreenImagePreview
                src={url}
                onClose={() => setFullscreen(false)}
              />,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={className ?? "max-h-56 w-full rounded-md object-contain"}
    />
  );
}

type Props = {
  label: string;
  /** 粘贴目标 id；同表单内须唯一。省略时本字段独立接收粘贴。 */
  pasteFieldId?: string;
  url?: string;
  urls?: string[];
  onUrlChange?: (url: string) => void;
  onFiles: (files: File[]) => void;
  onRemoveAt?: (index: number) => void;
  accept?: AdminMediaAccept;
  multiple?: boolean;
  disabled?: boolean;
  /** canvas = 悬停 Eye / 视频悬停播放（快速复制） */
  hoverChrome?: "default" | "canvas";
};

export function AdminMediaField({
  label,
  pasteFieldId: pasteFieldIdProp,
  url = "",
  urls,
  onUrlChange,
  onFiles,
  onRemoveAt,
  accept = "media",
  multiple = false,
  disabled = false,
  hoverChrome = "default",
}: Props) {
  const autoId = useId();
  const pasteFieldId = pasteFieldIdProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
  const ctxPaste = useAdminMediaPasteTarget(pasteFieldId);
  const [localPasteActive, setLocalPasteActive] = useState(false);
  const isActive = pasteFieldIdProp ? ctxPaste.isActive : localPasteActive;
  const activate = pasteFieldIdProp
    ? ctxPaste.activate
    : () => setLocalPasteActive(true);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);

  const previews = multiple ? (urls ?? []).filter(Boolean) : url.trim() ? [url.trim()] : [];
  const showTargetFrame = dragging || hovering;
  const showDropOverlay = dragging || pasteFlash;

  function takeFiles(files: File[]) {
    if (disabled || files.length === 0) return;
    onFilesRef.current(multiple ? files : files.slice(0, 1));
  }

  function focusTarget() {
    if (disabled) return;
    activate();
    setHovering(true);
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled || !isActive) return;
      const files = extractMediaFiles(event.clipboardData, accept);
      if (!files.length) return;
      event.preventDefault();
      setPasteFlash(true);
      takeFiles(files);
      window.setTimeout(() => setPasteFlash(false), 600);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [accept, disabled, isActive]);

  return (
    <div
      className="block text-xs sm:col-span-2"
      onMouseEnter={() => {
        if (disabled) return;
        setHovering(true);
        activate();
      }}
      onMouseLeave={(e) => {
        if (pointerLeftElement(e.currentTarget, e.relatedTarget)) setHovering(false);
      }}
    >
      <div className="mb-1 flex items-center gap-2 font-medium text-[#1f2328]">
        <span>{label}</span>
        {isActive && hovering ? (
          <span className="rounded bg-[#ddf4ff] px-1.5 py-0.5 text-[10px] font-normal text-[#0969da]">
            粘贴目标
          </span>
        ) : null}
      </div>
      <div
        ref={zoneRef}
        tabIndex={disabled ? undefined : 0}
        className={`relative rounded-lg border border-dashed p-2 outline-none transition-colors ${
          showTargetFrame
            ? "border-[#0969da] bg-[#ddf4ff]"
            : isActive
              ? "border-[#0969da]/50 bg-[#f6f8fa]"
              : "border-[#d0d7de] bg-[#f6f8fa]"
        } ${disabled ? "opacity-60" : "cursor-pointer"}`}
        onFocus={focusTarget}
        onMouseDown={(e) => {
          if (disabled) return;
          if ((e.target as HTMLElement).closest("button, video, input")) return;
          focusTarget();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) {
            setDragging(true);
            activate();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (pointerLeftElement(zoneRef.current, e.relatedTarget)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          focusTarget();
          takeFiles(extractMediaFiles(e.dataTransfer, accept));
        }}
        onClick={(e) => {
          if (disabled) return;
          if ((e.target as HTMLElement).closest("button, video, input")) return;
          focusTarget();
          inputRef.current?.click();
        }}
      >
        {previews.length > 0 ? (
          <div className={`flex flex-wrap gap-2 ${multiple ? "" : "justify-center"}`}>
            {previews.map((src, index) => (
              <div key={`${src}-${index}`} className="relative">
                <MediaPreview
                  url={src}
                  accept={accept}
                  hoverChrome={hoverChrome}
                  className={
                    multiple
                      ? "h-20 w-16 rounded-md object-cover"
                      : "max-h-56 w-full rounded-md object-contain"
                  }
                />
                {onRemoveAt ? (
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#d0d7de]/80 bg-white text-[#57606a] shadow-sm transition-colors hover:border-[#cf222e]/40 hover:bg-[#fff1f0] hover:text-[#cf222e]"
                    aria-label="删除"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAt(index);
                    }}
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[120px] flex-col items-center justify-center gap-1 text-[#656d76]">
            <span>拖入、粘贴或点击选择</span>
            <span className="text-[10px]">
              {accept === "image"
                ? "图片"
                : accept === "video"
                  ? "视频"
                  : "图片 / 视频"}
              {multiple ? " · 可多选" : ""}
            </span>
          </div>
        )}
        {showDropOverlay ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-[#ddf4ff]/80 text-[#0969da]">
            {dragging ? "松开以上传" : "已粘贴"}
          </div>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr(accept)}
          multiple={multiple}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            takeFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {onUrlChange && !multiple ? (
        <input
          className="mt-1.5 w-full rounded border border-[#d0d7de] px-2 py-1.5"
          value={url}
          placeholder="或粘贴媒体 URL"
          disabled={disabled}
          onChange={(e) => onUrlChange(e.target.value)}
        />
      ) : null}
      <p className="mt-1 text-[10px] text-[#656d76]">
        鼠标移入显示目标框，Ctrl+V / ⌘V 粘贴到此字段
        {previews.length > 0 && !multiple ? " · 点击空白处更换" : ""}
      </p>
    </div>
  );
}
