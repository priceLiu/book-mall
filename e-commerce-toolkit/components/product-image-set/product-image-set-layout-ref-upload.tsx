"use client";

import { useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { uploadProductImageSetRef } from "@/lib/ecom-product-image-set-api";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  disabled?: boolean;
};

/** 版式选择弹层 · 自定义版式参考（与全站 EcomRefUploadCard 同一套拖放 / 粘贴 / 点击） */
export function ProductImageSetLayoutRefUpload({ projectId, disabled }: Props) {
  const { alert } = useDialogs();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function ingest(files: File[]) {
    const f = files[0];
    if (!f || disabled || uploading) return;
    setUploading(true);
    try {
      await uploadProductImageSetRef(projectId, f, {
        role: "layout-ref",
        label: f.name.slice(0, 30),
      });
      await alert({
        title: "已上传版式参考",
        message: "参考图已加入项目，可在生成时作为补充参考。",
      });
    } catch (e) {
      await alert({
        title: "上传失败",
        message: e instanceof Error ? e.message : "无法上传",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  const { dragOver, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: !disabled && !uploading,
    multiple: false,
    onFiles: (files) => void ingest(files),
  });

  return (
    <div
      {...dropZoneProps}
      className={cn(
        "mt-4 rounded-lg border border-dashed px-3 py-3 outline-none transition-colors",
        dragOver
          ? "border-[#0071e3] bg-[#f0f6ff]"
          : "border-[#c7c7cc] bg-[#fafafa] hover:border-[#0071e3]/50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) void ingest(Array.from(files));
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#6e6e73]">
          自定义版式参考 · {IMAGE_UPLOAD_DROP_HINT}
          {uploading ? " · 上传中…" : ""}
        </p>
        <EcomButtonSecondary
          size="sm"
          type="button"
          disabled={disabled || uploading}
          className="h-7 px-2 text-[10px]"
          onClick={() => {
            focusZone();
            inputRef.current?.click();
          }}
        >
          选择图片
        </EcomButtonSecondary>
      </div>
      {dragOver ? (
        <p className="mt-1 text-[10px] text-[#0071e3]">松开以上传</p>
      ) : null}
    </div>
  );
}
