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
  onSubmitAll: () => void;
  onRemove: (layerId: string) => void;
  submitCount?: number;
  /** 外层 assistantHeader 已展示标题时隐藏本面板标题 */
  hideHeader?: boolean;
};

export function ImageLayerEditPanel({
  entries,
  busy,
  editingLayerId,
  busyTitle,
  busyDetail,
  onPromptChange,
  onSubmitAll,
  onRemove,
  submitCount = 0,
  hideHeader = false,
}: Props) {
  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      {hideHeader ? null : (
        <div className="col-span-full shrink-0 border-b border-[#e5e7eb] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#111827]">图层编辑</h2>
          <p className="mt-1 text-xs text-[#6b7280]">
            点击图层追加编辑卡片，填好各层描述后，底部一次提交（一次改层后重拆）。
          </p>
        </div>
      )}

      <div className="ecom-scrollbar-thin col-span-full min-h-0 overflow-y-auto p-4">
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
                        placeholder="例如：去掉文字 / 把叶子改成红色"
                        disabled={busy}
                        className={cn(
                          "w-full resize-none rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm",
                          "focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]",
                          busy && "opacity-60",
                        )}
                      />
                      {rowBusy ? (
                        <p className="mt-2 text-xs text-[#2563eb]">正在修改本层…</p>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="shrink-0 border-t border-[#e5e7eb] bg-white p-4">
          <EcomButtonPrimary
            type="button"
            className="w-full"
            disabled={busy || submitCount === 0}
            onClick={onSubmitAll}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {submitCount > 0
              ? `AI 提交全部修改（${submitCount} 层）`
              : "AI 提交全部修改"}
          </EcomButtonPrimary>
          <p className="mt-2 text-center text-[11px] text-[#9ca3af]">
            仅提交已填写描述的图层；合并为一次改层并重拆
          </p>
        </div>
      ) : null}
    </div>
  );
}
