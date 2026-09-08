"use client";

import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import { mentionTokenDisplay } from "@/lib/product-design-mention-tokens";
import { cn } from "@/lib/utils";

export const ECOM_PROMPT_MENTION_REF_BAR_HINT =
  "参考资产 · 顶栏已绑定；Prompt 内只写代号（如 人物A），输入 @ 可插入";

type Props = {
  refs: EcomPromptImageRef[];
  className?: string;
  /** 顶栏标题/说明 */
  hint?: string;
  refsEmptyHint?: string;
  onPreviewImage?: (url: string, label: string) => void;
};

/** 顶栏绑定全部参考资产（人物/产品/道具/场景等）；Prompt 正文不再重复带图角标 */
export function EcomPromptMentionRefBar({
  refs,
  className,
  hint = ECOM_PROMPT_MENTION_REF_BAR_HINT,
  refsEmptyHint,
  onPreviewImage,
}: Props) {
  if (refs.length === 0) {
    if (!refsEmptyHint) return null;
    return (
      <p className={cn("text-[11px] leading-relaxed text-[#86868b]", className)}>{refsEmptyHint}</p>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {refs.map((ref) => {
          const alias = mentionTokenDisplay(ref.token);
          const inner = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ref.url}
                alt={ref.label}
                className="h-10 w-10 shrink-0 rounded-md border border-[#e8e8ed] object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="min-w-0 pr-1">
                <span className="block font-mono text-[10px] font-medium text-[#0071e3]">{ref.token}</span>
                <span className="block truncate text-[9px] text-[#86868b]">代号 {alias}</span>
              </span>
            </>
          );
          if (onPreviewImage) {
            return (
              <button
                key={ref.token}
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-[#e8e8ed] bg-white px-1.5 py-1 text-left transition hover:border-[#0071e3]/35 hover:bg-[#f0f6ff]"
                title={`${ref.label} · 点击放大`}
                onClick={() => onPreviewImage(ref.url, ref.label)}
              >
                {inner}
              </button>
            );
          }
          return (
            <div
              key={ref.token}
              className="flex items-center gap-1.5 rounded-lg border border-[#e8e8ed] bg-white px-1.5 py-1"
              title={ref.label}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
