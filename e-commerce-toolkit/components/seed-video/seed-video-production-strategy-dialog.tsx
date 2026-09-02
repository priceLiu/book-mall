"use client";

import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";

export type SeedVideoProductionStrategy = "panel" | "auto";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (strategy: SeedVideoProductionStrategy) => void;
};

export function SeedVideoProductionStrategyDialog({
  open,
  onOpenChange,
  onSelect,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="seed-video-strategy-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#e8e8ed] bg-white p-5 pr-12 shadow-xl">
        <EcomDialogCloseButton onClick={() => onOpenChange(false)} />
        <h2 id="seed-video-strategy-title" className="text-base font-semibold text-[#1d1d1f]">
          选择出片方式
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
          选定视频模型前，请先确认生成策略。逐镜模式可逐个预览；自动模式将依次生成全部镜头并尝试合成成片。
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            className="w-full rounded-xl border border-[#e8e8ed] bg-[#f5f5f7] px-4 py-3 text-left transition hover:border-[#0071e3]/40 hover:bg-[#f0f6ff]"
            onClick={() => {
              onSelect("panel");
              onOpenChange(false);
            }}
          >
            <p className="text-sm font-semibold text-[#1d1d1f]">逐镜生视频</p>
            <p className="mt-0.5 text-[11px] text-[#6e6e73]">
              按镜号逐个生成，生成一个显示一个，便于中途调整 Prompt。
            </p>
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-[#e8e8ed] bg-[#f5f5f7] px-4 py-3 text-left transition hover:border-[#0071e3]/40 hover:bg-[#f0f6ff]"
            onClick={() => {
              onSelect("auto");
              onOpenChange(false);
            }}
          >
            <p className="text-sm font-semibold text-[#1d1d1f]">自动合成出片</p>
            <p className="mt-0.5 text-[11px] text-[#6e6e73]">
              自动生成全部镜头 → 批量 TTS → 合成成片（适合一键出片）。
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
