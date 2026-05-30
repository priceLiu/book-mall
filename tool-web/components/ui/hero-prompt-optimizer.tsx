"use client";

import Link from "next/link";
import { ExternalLink, MessageSquareText, Sparkles, Wand2 } from "lucide-react";
import { mainSitePromptOptimizerOpenHref } from "@/lib/main-site-app-open-links";

export function PromptOptimizerHero() {
  const openHref = mainSitePromptOptimizerOpenHref("/");

  return (
    <div className="w-full py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-5">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
              <MessageSquareText className="size-3.5" />
              提示词优化器
            </p>
            <h2 className="max-w-lg text-left text-3xl font-semibold tracking-tight sm:text-4xl">
              写好提示词，让 AI 更懂你的意图
            </h2>
            <p className="max-w-md text-left text-base leading-relaxed text-neutral-600">
              基于上游 prompt-optimizer（Vue + Naive UI）：编写、优化、对比与测试提示词。模型经
              Book Gateway 路由，厂商 Key 仅在 Gateway 管理。
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-600">
              <li className="inline-flex items-center gap-1.5">
                <Wand2 className="size-4 text-indigo-500" />
                一键优化
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Sparkles className="size-4 text-indigo-500" />
                多模型对比
              </li>
              <li className="inline-flex items-center gap-1.5">
                <MessageSquareText className="size-4 text-indigo-500" />
                对话测试
              </li>
            </ul>
            <div className="flex flex-row flex-wrap gap-3">
              <Link
                href="/prompt-optimizer/studio"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                进入优化工作台 <Sparkles className="size-4" />
              </Link>
              <a
                href={openHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                打开提示词优化器 <ExternalLink className="size-4" />
              </a>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-indigo-100 via-violet-50 to-slate-50 shadow-lg">
            <div className="absolute inset-0 flex flex-col justify-end p-6 text-slate-800">
              <p className="text-sm font-medium">平台版 · Gateway 断直连</p>
              <p className="mt-1 text-xs text-slate-600">
                同域 BFF → Book SSO → Gateway BYOK
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
