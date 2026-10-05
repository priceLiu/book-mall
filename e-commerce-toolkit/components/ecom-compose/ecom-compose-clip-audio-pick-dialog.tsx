"use client";

import { Volume2 } from "lucide-react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import type { EcomComposeTtsOption } from "@/lib/ecom-compose-tts-options";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  clipLabel?: string;
  options: EcomComposeTtsOption[];
  suggestedOptionId?: string;
  busy?: boolean;
  onClose: () => void;
  onUploadLocal: () => void;
  onPickTts: (option: EcomComposeTtsOption) => void;
};

/** 段配音：本地上传 或 选择页面已生成的 TTS（按分镜/套装） */
export function EcomComposeClipAudioPickDialog({
  open,
  clipLabel,
  options,
  suggestedOptionId,
  busy,
  onClose,
  onUploadLocal,
  onPickTts,
}: Props) {
  if (!open) return null;

  const title = clipLabel?.trim()
    ? `段配音 · ${clipLabel.trim()}`
    : "段配音";

  return (
    <div
      className="fixed inset-0 z-[3400] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="ecom-compose-audio-pick-title"
    >
      <div className="relative flex max-h-[min(560px,85dvh)] w-full max-w-md flex-col rounded-2xl border border-[#e8e8ed] bg-white shadow-xl">
        <EcomDialogCloseButton disabled={busy} onClick={onClose} />
        <div className="border-b border-[#e8e8ed] px-5 py-4 pr-12">
          <h2
            id="ecom-compose-audio-pick-title"
            className="text-base font-semibold text-[#1d1d1f]"
          >
            {title}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
            上传本地音频，或从本页已生成的口播 TTS 中选择（按套装/分镜）。
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <button
            type="button"
            disabled={busy}
            className="mb-3 flex w-full items-center justify-center rounded-xl border border-dashed border-[#0071e3]/40 bg-[#f0f6ff] px-3 py-2.5 text-[13px] font-medium text-[#0071e3] hover:bg-[#e8f2ff] disabled:opacity-50"
            onClick={() => {
              if (busy) return;
              onUploadLocal();
            }}
          >
            本地上传音频
          </button>

          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#86868b]">
            页面已生成 TTS
          </p>

          {options.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e8e8ed] bg-[#fafafa] px-3 py-6 text-center text-[12px] text-[#86868b]">
              暂无已生成口播。请先在上方工作区为各镜/套装生成 TTS，或选择本地上传。
            </div>
          ) : (
            <ul className="space-y-2">
              {options.map((opt) => {
                const suggested =
                  suggestedOptionId != null && opt.id === suggestedOptionId;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      disabled={busy}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:border-[#0071e3]/50 hover:bg-[#fafafa] disabled:opacity-50",
                        suggested
                          ? "border-[#0071e3]/60 bg-[#f0f6ff]/60"
                          : "border-[#e8e8ed] bg-white",
                      )}
                      onClick={() => onPickTts(opt)}
                    >
                      <Volume2
                        className="mt-0.5 size-4 shrink-0 text-[#0071e3]"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-[#1d1d1f]">
                          {opt.label}
                          {suggested ? (
                            <span className="ml-1.5 text-[10px] font-normal text-[#0071e3]">
                              推荐
                            </span>
                          ) : null}
                        </span>
                        {opt.voiceover?.trim() ? (
                          <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#6e6e73]">
                            {opt.voiceover.trim()}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-[#e8e8ed] px-5 py-3">
          <EcomButtonSecondary disabled={busy} onClick={onClose}>
            取消
          </EcomButtonSecondary>
        </div>
      </div>
    </div>
  );
}
