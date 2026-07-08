"use client";

import { CloudUpload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 3;

export function ImageMultiUpload({
  images,
  onChange,
  max = MAX_IMAGES,
  emptyLabel = "将图片拖放到此处 或点击浏览",
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  emptyLabel?: string;
}) {
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= max) break;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      const dataUrl = await readFileAsDataUrl(file);
      next.push(dataUrl);
    }
    onChange(next.slice(0, max));
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/jpeg,image/png,image/webp";
          input.multiple = images.length < max;
          input.onchange = () => void handleFiles(input.files);
          input.click();
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:px-6 sm:py-10",
          images.length > 0
            ? "border-[#e5e5ea] py-4"
            : "border-violet-300 hover:border-violet-500 hover:bg-violet-50/30",
        )}
      >
        {images.length === 0 ? (
          <>
            <CloudUpload className="h-10 w-10 text-violet-500" />
            <p className="mt-3 font-medium">{emptyLabel}</p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              JPG、PNG、WebP，最大 10MB，最多 {max} 张
            </p>
          </>
        ) : (
          <p className="text-sm text-[#0071e3]">继续添加图片（{images.length}/{max}）</p>
        )}
      </button>

      {images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((src, idx) => (
            <div
              key={`${idx}-${src.slice(0, 24)}`}
              className="relative overflow-hidden rounded-xl border border-[#e5e5ea] bg-[#fafafa]"
            >
              <button
                type="button"
                onClick={() => onChange(images.filter((_, i) => i !== idx))}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                aria-label="移除图片"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`参考图 ${idx + 1}`} className="h-40 w-full object-contain" />
              <p className="border-t border-[#e5e5ea] px-2 py-1 text-center text-xs text-[#6e6e73]">
                图 {idx + 1}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}
