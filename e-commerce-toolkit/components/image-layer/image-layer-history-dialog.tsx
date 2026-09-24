"use client";

import Image from "next/image";
import { History, ImageOff, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatImageLayerGenerationAt,
  imageLayerGenerationKindLabel,
  resolveImageLayerHistoryPreview,
} from "@/lib/image-layer-history";
import type { ImageLayerProjectGeneration } from "@/lib/image-layer-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  items: ImageLayerProjectGeneration[];
  currentUrl?: string | null;
  restoringId?: string | null;
  onOpenChange: (open: boolean) => void;
  onRestore: (item: ImageLayerProjectGeneration) => void | Promise<void>;
};

function HistoryThumb({
  url,
  label,
}: {
  url: string | null;
  label: string;
}) {
  return (
    <span className="flex w-[88px] shrink-0 flex-col gap-1">
      <span className="relative block aspect-square overflow-hidden rounded-lg bg-[#f5f5f7]">
        {url ? (
          <Image src={url} alt={label} fill className="object-cover" unoptimized />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <ImageOff className="h-4 w-4 text-[#c7c7cc]" />
          </span>
        )}
      </span>
      <span className="truncate text-center text-[10px] text-[#86868b]">{label}</span>
    </span>
  );
}

export function ImageLayerHistoryDialog({
  open,
  items,
  currentUrl,
  restoringId,
  onOpenChange,
  onRestore,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[#f0f0f2] px-5 py-4">
          <DialogTitle className="text-[15px]">处理历史</DialogTitle>
          <p className="text-[12px] text-[#86868b]">
            每条记录含左边原图、右边生成结果，以及当时的提示词与参考图。点一条即可回到当时继续编辑。
          </p>
        </DialogHeader>
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <History className="h-8 w-8 text-[#c7c7cc]" />
              <p className="text-sm text-[#86868b]">还没有处理历史</p>
              <p className="max-w-xs text-[12px] text-[#9ca3af]">
                先上传或生成一张图，记录会出现在这里。
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const active = Boolean(currentUrl && item.ossUrl === currentUrl);
                const restoring = restoringId === item.id;
                const preview = resolveImageLayerHistoryPreview(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={Boolean(restoringId)}
                    onClick={() => void onRestore(item)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border-2 p-2.5 text-left transition-colors",
                      active
                        ? "border-[#0071e3] bg-[#f0f6ff]"
                        : "border-[#e8e8ed] bg-white hover:border-[#d2d2d7]",
                      restoringId && !restoring ? "opacity-60" : "",
                    )}
                  >
                    <HistoryThumb url={preview.beforeUrl} label="原图" />
                    <HistoryThumb url={preview.afterUrl} label="生成" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[#1d1d1f]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[#86868b]">
                        {imageLayerGenerationKindLabel(item.kind)}
                        {item.modelKey ? ` · ${item.modelKey}` : ""}
                        {item.at ? ` · ${formatImageLayerGenerationAt(item.at)}` : ""}
                      </span>
                      {preview.prompt ? (
                        <span className="mt-1 line-clamp-3 text-[12px] leading-5 text-[#374151]">
                          {preview.prompt}
                        </span>
                      ) : (
                        <span className="mt-1 block text-[11px] text-[#9ca3af]">
                          当时没有填写提示词
                        </span>
                      )}
                      {preview.refs.length > 0 ? (
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {preview.refs.map((ref) => (
                            <span
                              key={`${item.id}-${ref.url}`}
                              className="inline-flex items-center gap-1 rounded-md bg-[#f5f5f7] px-1.5 py-1"
                            >
                              <span className="relative h-8 w-8 overflow-hidden rounded">
                                <Image
                                  src={ref.url}
                                  alt={ref.label ?? "参考图"}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </span>
                              <span className="max-w-[88px] truncate text-[10px] text-[#6b7280]">
                                {ref.label ?? "参考图"}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {active ? (
                        <span className="mt-1 block text-[11px] text-[#0071e3]">
                          当前工作图
                        </span>
                      ) : null}
                    </span>
                    {restoring ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0071e3]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
