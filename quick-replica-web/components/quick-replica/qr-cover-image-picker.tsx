"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef } from "react";

import { QrImageUploadZone } from "@/components/quick-replica/qr-image-upload-zone";
import { QrRefImageThumb } from "@/components/quick-replica/qr-ref-image-thumb";

type Props = {
  coverUrl: string;
  disabled?: boolean;
  uploading?: boolean;
  onUploadFile: (file: File) => void | Promise<void>;
  onClear?: () => void;
  hint?: string;
};

/** 模板 / 列表封面：大图预览 + 点击上传 + 粘贴 */
export function QrCoverImagePicker({
  coverUrl,
  disabled = false,
  uploading = false,
  onUploadFile,
  onClear,
  hint = "上传视频后将自动截取首帧；也可手动上传或粘贴替换封面",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasCover = Boolean(coverUrl.trim());

  const handleFiles = (files: File[]) => {
    const file = files[0];
    if (file) void onUploadFile(file);
  };

  return (
    <div className="space-y-2">
      <span className="text-xs text-[var(--qr-text-muted)]">封面图</span>
      <QrImageUploadZone
        className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--qr-brand)]/40 rounded-xl"
        disabled={disabled || uploading}
        multiple={false}
        showHint={!hasCover}
        onFiles={handleFiles}
      >
        <div className="flex flex-wrap items-start gap-3">
          {hasCover ? (
            <QrRefImageThumb
              url={coverUrl}
              size="lg"
              onRemove={onClear && !disabled ? onClear : undefined}
            />
          ) : (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className="flex aspect-video w-full max-w-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 transition hover:border-[var(--qr-brand)]/50 hover:bg-white/[0.02] disabled:opacity-50"
              style={{ borderColor: "var(--qr-border)" }}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-[var(--qr-brand)]" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-[var(--qr-text-muted)]" />
                  <span className="text-xs text-[var(--qr-text-secondary)]">上传封面</span>
                </>
              )}
            </button>
          )}
          {hasCover ? (
            <div className="flex min-w-[120px] flex-1 flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={disabled || uploading}
                className="qr-btn-secondary w-fit px-3 py-1.5 text-xs"
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? "上传中…" : "更换封面"}
              </button>
              <p className="text-[10px] leading-relaxed text-[var(--qr-text-muted)]">{hint}</p>
            </div>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onUploadFile(file);
          }}
        />
      </QrImageUploadZone>
      {hasCover ? (
        <p className="text-[10px] leading-relaxed text-[var(--qr-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
