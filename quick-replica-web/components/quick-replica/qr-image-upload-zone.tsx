"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { extractImageFilesFromClipboard } from "@/lib/qr-image-upload-paste";

type Props = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** 默认 true：一次粘贴可上传多张 */
  multiple?: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
  /** 是否展示「支持粘贴」提示 */
  showHint?: boolean;
};

/**
 * 图片上传热区：鼠标悬停或焦点在区内时，支持 Ctrl+V / ⌘V 粘贴图片。
 * QuickReplica 所有图片上传区须包裹此组件（见 `.cursor/rules/quick-replica-image-upload.mdc`）。
 */
export function QrImageUploadZone({
  children,
  className,
  disabled = false,
  multiple = true,
  onFiles,
  showHint = true,
}: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return;
      const zone = zoneRef.current;
      if (!zone) return;

      const active = document.activeElement;
      const inZone =
        hovered ||
        focused ||
        (active != null && zone.contains(active as Node));
      if (!inZone) return;

      const files = extractImageFilesFromClipboard(event);
      if (!files.length) return;

      event.preventDefault();
      void onFilesRef.current(multiple ? files : files.slice(0, 1));
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [disabled, hovered, focused, multiple]);

  return (
    <div
      ref={zoneRef}
      className={className}
      tabIndex={disabled ? undefined : 0}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!zoneRef.current?.contains(event.relatedTarget as Node)) {
          setFocused(false);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {showHint && !disabled ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--qr-text-muted)]">
          支持 Ctrl+V / ⌘V 粘贴图片{multiple ? "（可多图）" : ""}
        </p>
      ) : null}
    </div>
  );
}
