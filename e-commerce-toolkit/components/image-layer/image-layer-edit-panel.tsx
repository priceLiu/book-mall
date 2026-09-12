"use client";

import { Loader2, Sparkles, X } from "lucide-react";

import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import type { ImageLayerStackItem } from "@/lib/image-layer-types";
import { cn } from "@/lib/utils";

export type ImageLayerEditEntryView = {
  layer: ImageLayerStackItem;
  prompt: string;
};

type Props = {
  entries: ImageLayerEditEntryView[];
  busy: boolean;
  editingLayerId?: string | null;
  busyTitle?: string;
  busyDetail?: string;
  onPromptChange: (layerId: string, value: string) => void;
  onEdit: (layerId: string) => void;
  onRemove: (layerId: string) => void;
};

export function ImageLayerEditPanel({
  entries,
  busy,
  editingLayerId,
  busyTitle,
  busyDetail,
  onPromptChange,
  onEdit,
  onRemove,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[#e5e7eb] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#111827]">图层编辑</h2>
        <p className="mt-1 text-xs text-[#6b7280]">
          点击画布图层会在此追加编辑项。底图应不含已拆出主体；若出现「两个人」，多为模型未补全底图，请重置后框选再拆分。
        </p>
      </div>

      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {busy ? (
          <StoryboardTaskStatus
            active
            surface="content"
            sweep
            title={busyTitle ?? "生成中…"}
            detail={busyDetail}
            className="mx-0 mb-3"
          />
        ) : null}

        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fafafa] p-4 text-sm text-[#9ca3af]">
            点击画布上的物体层，在此追加编辑卡片（可多个）
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map(({ layer, prompt }) => {
              const rowBusy = busy && editingLayerId === layer.id;
              const disabled = layer.isBackground || busy;
              return (
                <div
                  key={layer.id}
                  className={cn(
                    "rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm",
                    rowBusy && "ring-2 ring-[#2563eb]/30",
                  )}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <img
                      src={layer.url}
                      alt={layer.name ?? "图层"}
                      className="h-14 w-14 shrink-0 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#111827]">
                        {layer.name ?? (layer.isBackground ? "底图" : "物体层")}
                      </p>
                      <p className="text-xs text-[#6b7280]">z-index: {layer.zIndex}</p>
                    </div>
                    <EcomIconButton
                      label="移除此层编辑"
                      icon={X}
                      disabled={busy}
                      onClick={() => onRemove(layer.id)}
                    />
                  </div>

                  {layer.isBackground ? (
                    <p className="text-sm text-[#6b7280]">底图不可 AI 改层。</p>
                  ) : (
                    <>
                      <label className="mb-1 block text-xs font-medium text-[#374151]">
                        修改描述
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => onPromptChange(layer.id, e.target.value)}
                        rows={3}
                        placeholder="例如：把包包改成红色"
                        className={cn(
                          "mb-3 w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm",
                          "focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]",
                        )}
                      />
                      <EcomButtonPrimary
                        type="button"
                        className="w-full"
                        disabled={disabled || !prompt.trim()}
                        onClick={() => onEdit(layer.id)}
                      >
                        {rowBusy ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-4 w-4" />
                        )}
                        AI 修改本层
                      </EcomButtonPrimary>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
