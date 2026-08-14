"use client";

import { useEffect, useRef, useState } from "react";

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

function MediaPreview({
  url,
  accept,
  className,
}: {
  url: string;
  accept: AdminMediaAccept;
  className?: string;
}) {
  if (isVideoUrl(url, accept)) {
    return (
      <video
        src={url}
        controls
        playsInline
        className={className ?? "max-h-56 w-full rounded-md bg-black object-contain"}
      />
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
  url?: string;
  urls?: string[];
  onUrlChange?: (url: string) => void;
  onFiles: (files: File[]) => void;
  onRemoveAt?: (index: number) => void;
  accept?: AdminMediaAccept;
  multiple?: boolean;
  disabled?: boolean;
};

export function AdminMediaField({
  label,
  url = "",
  urls,
  onUrlChange,
  onFiles,
  onRemoveAt,
  accept = "media",
  multiple = false,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const previews = multiple ? (urls ?? []).filter(Boolean) : url.trim() ? [url.trim()] : [];

  function takeFiles(files: File[]) {
    if (disabled || files.length === 0) return;
    onFilesRef.current(multiple ? files : files.slice(0, 1));
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return;
      const zone = zoneRef.current;
      if (!zone) return;
      const active = document.activeElement;
      const inZone =
        hovered || focused || (active != null && zone.contains(active as Node));
      if (!inZone) return;
      const files = extractMediaFiles(event.clipboardData, accept);
      if (!files.length) return;
      event.preventDefault();
      takeFiles(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [accept, disabled, focused, hovered]);

  return (
    <div className="block text-xs sm:col-span-2">
      <div className="mb-1 font-medium text-[#1f2328]">{label}</div>
      <div
        ref={zoneRef}
        tabIndex={disabled ? undefined : 0}
        className={`relative rounded-lg border border-dashed p-2 outline-none ${
          dragging
            ? "border-[#0969da] bg-[#ddf4ff]"
            : "border-[#d0d7de] bg-[#f6f8fa]"
        } ${disabled ? "opacity-60" : "cursor-pointer"}`}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!zoneRef.current?.contains(e.relatedTarget as Node)) setFocused(false);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!zoneRef.current?.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFiles(extractMediaFiles(e.dataTransfer, accept));
        }}
        onClick={(e) => {
          if (disabled) return;
          if ((e.target as HTMLElement).closest("button, video, input")) return;
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
                  className={
                    multiple
                      ? "h-20 w-16 rounded-md object-cover"
                      : "max-h-56 w-full rounded-md object-contain"
                  }
                />
                {onRemoveAt ? (
                  <button
                    type="button"
                    className="absolute right-0 top-0 rounded bg-white/90 px-1 text-[10px] text-[#cf222e]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAt(index);
                    }}
                  >
                    删
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
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-[#ddf4ff]/80 text-[#0969da]">
            松开以上传
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
        支持拖入、Ctrl+V / ⌘V 粘贴
        {previews.length > 0 && !multiple ? " · 点击空白处更换" : ""}
      </p>
    </div>
  );
}
