"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Layers, Palette, Sparkles, Wand2 } from "lucide-react";
import { mainSiteCanvasOpenHref } from "@/lib/main-site-app-open-links";

export function AiPosterCanvasHero() {
  const canvasOpenHref = mainSiteCanvasOpenHref("/");

  return (
    <div className="w-full py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-5">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
              <Palette className="size-3.5" />
              AI 海报画布
            </p>
            <h2 className="max-w-lg text-left text-3xl font-semibold tracking-tight sm:text-4xl">
              拖拽节点，让 AI 把灵感拼成海报
            </h2>
            <p className="max-w-md text-left text-base leading-relaxed text-neutral-600">
              ComfyUI 风格的可视化画布：导入参考图、写一句产品介绍、连一根线，AI 就能融合风格与产品。多图融合、三视图、模板复用，一人即设计室。
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-600">
              <li className="inline-flex items-center gap-1.5">
                <Layers className="size-4 text-violet-500" />
                节点工作流
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Wand2 className="size-4 text-violet-500" />
                多模型一键切换
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Sparkles className="size-4 text-violet-500" />
                30 秒级出图
              </li>
            </ul>
            <div className="flex flex-row flex-wrap gap-3">
              <Link
                href="/ai-poster-canvas/studio"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                进入创意画室 <Sparkles className="size-4" />
              </Link>
              <a
                href={canvasOpenHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                打开 canvas-web <ExternalLink className="size-4" />
              </a>
              <Link
                href="/ai-poster-canvas/gallery"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                浏览画作 <Layers className="size-4" />
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-cyan-50 shadow-lg">
            <Image
              src="/images/v3.png"
              alt="AI 海报画布视觉示意"
              fill
              className="object-cover opacity-90"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-sm font-medium">无限画布 · 节点工作流 v1</p>
              <p className="text-xs text-white/80">导入图片 → 选模型 → 一键出图</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
