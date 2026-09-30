"use client";

import { useRef } from "react";

import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { ProductImageSetReference } from "@/lib/product-image-set-types";
import { PRODUCT_IMAGE_SET_MAX_PRODUCT_REFS } from "@/lib/product-image-set-types";

type Props = {
  references: ProductImageSetReference[];
  busy?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: (refId: string) => void;
};

export function ProductImageSetRefUploader({ references, busy, onUpload, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const maxCount = PRODUCT_IMAGE_SET_MAX_PRODUCT_REFS;
  const atLimit = references.length >= maxCount;
  const disabled = Boolean(busy) || atLimit;

  async function handleFiles(files: File[]) {
    if (!files.length || disabled) return;
    let remaining = maxCount - references.length;
    for (const file of files) {
      if (remaining <= 0) break;
      await onUpload(file);
      remaining -= 1;
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#1d1d1f]">商品原图</span>
        <span className="text-[10px] text-[#86868b]">
          {references.length}/{maxCount} · 首张为主参考 · {IMAGE_UPLOAD_DROP_HINT}
        </span>
      </div>
      <EcomRefUploadCard
        title="商品原图"
        hideTitle
        items={references.map((r, i) => ({
          id: r.id,
          ossUrl: r.ossUrl,
          label: i === 0 ? "首张" : r.label || `图 ${i + 1}`,
        }))}
        emptyHint="上传商品实拍（可多选）。AI 帮写会分析全部产品图；支持 Ctrl+V / ⌘V 粘贴。"
        busy={disabled}
        multiple
        onUploadFiles={(files) => void handleFiles(files)}
        onOpenFilePicker={() => inputRef.current?.click()}
        onRemove={(id) => onRemove(id)}
        removeLabel="删除商品原图"
        inputRef={inputRef}
        contentMinHeightClass="min-h-[72px]"
      />
    </div>
  );
}
