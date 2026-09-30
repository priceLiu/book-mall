"use client";

import { CircleHelp } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  iconClassName?: string;
};

/** 「AI 生模特」旁问号 · 悬停说明（合规与使用须知） */
export function VtonAiModelGenerateHelp({ className, iconClassName }: Props) {
  return (
    <span className={cn("group/vton-ai-help relative inline-flex shrink-0", className)}>
      <button
        type="button"
        tabIndex={0}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[#86868b] transition-colors hover:text-[#1d1d1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40",
          iconClassName,
        )}
        aria-label="AI 生模特功能说明"
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden />
      </button>
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[400] hidden w-[min(92vw,22rem)] -translate-x-1/2 rounded-lg bg-[#3a3a3c] px-3 py-2.5 text-left text-[11px] leading-relaxed text-white shadow-xl group-hover/vton-ai-help:block group-focus-within/vton-ai-help:block"
      >
        <p className="font-medium text-white/95">使用「AI 生模特 / 头像扩全身」前请知悉</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-white/90">
          <li>
            <span className="font-medium text-white">肖像与授权</span>
            ：扩全身会参考您上传的人像；请确保有权用于 AI
            生成与电商展示，勿上传未授权他人照片。
          </li>
          <li>
            <span className="font-medium text-white">生成特性</span>
            ：AI 输出存在随机性，体型/五官可能与描述或参考图略有偏差，需人工筛选确认。
          </li>
          <li>
            <span className="font-medium text-white">使用责任</span>
            ：生成结果用于上架、广告等场景时，由您自行承担合规与版权责任。
          </li>
        </ol>
      </div>
    </span>
  );
}
