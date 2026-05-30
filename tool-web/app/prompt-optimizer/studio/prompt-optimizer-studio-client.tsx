"use client";

import Link from "next/link";
import { ExternalLink, MessageSquareText, Sparkles, Wand2 } from "lucide-react";
import { mainSitePromptOptimizerOpenHref } from "@/lib/main-site-app-open-links";

export function PromptOptimizerStudioClient() {
  const openHref = mainSitePromptOptimizerOpenHref("/");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8">
        <Link
          href="/prompt-optimizer"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← 提示词优化器首页
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">优化工作台</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          点击下方入口进入独立应用 prompt-optimizer-platform：编写与优化提示词、对比模型输出。登录与计费走
          Book 联邦；模型调用经 Gateway，不在浏览器直连厂商。
        </p>
      </div>

      <a
        href={openHref}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block aspect-[16/9] w-full overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-indigo-100 via-violet-50 to-slate-50 shadow-xl transition hover:shadow-2xl"
        aria-label="进入提示词优化器"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 text-white sm:p-8">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <MessageSquareText className="size-3.5" />
            prompt-optimizer-platform
          </p>
          <h2 className="text-2xl font-semibold sm:text-3xl">进入提示词优化器</h2>
          <p className="max-w-xl text-sm text-white/90 sm:text-base">
            上游 Vue 原样 UI；平台版隐藏自填 API Key，模型在 Gateway 控制台配置。
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            打开应用
            <ExternalLink className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </a>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <FeatureCard
          icon={<Wand2 className="size-5 text-indigo-500" />}
          title="提示词优化"
          body="结构化改写、扩写与约束注入，减少反复试错。"
        />
        <FeatureCard
          icon={<Sparkles className="size-5 text-indigo-500" />}
          title="Gateway 路由"
          body="同域 BFF → Book Gateway；DevTools 无厂商直连域名。"
        />
        <FeatureCard
          icon={<MessageSquareText className="size-5 text-indigo-500" />}
          title="工具月费"
          body="navKey: prompt-optimizer；须开通技术服务费并关联 Gateway Key。"
        />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-neutral-50">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-medium text-neutral-900">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-neutral-600">{body}</p>
    </div>
  );
}
