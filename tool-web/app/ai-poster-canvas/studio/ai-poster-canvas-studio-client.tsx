"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Layers, Palette, Wand2 } from "lucide-react";
import { getCanvasWebOrigin } from "@/lib/canvas-web-origin";

export function AiPosterCanvasStudioClient() {
  const canvasOrigin = getCanvasWebOrigin();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8">
        <Link
          href="/ai-poster-canvas"
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          ← AI 海报画布首页
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">创意画室</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          点击下方大图，进入 canvas-web 的无限画布编辑器：拖入参考图、连接节点、一键运行，模型与素材统一归口
          book-mall。
        </p>
      </div>

      <a
        href={canvasOrigin}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block aspect-[16/9] w-full overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-cyan-50 shadow-xl transition hover:shadow-2xl"
        aria-label="进入无限画布"
      >
        <Image
          src="/images/v3.png"
          alt="无限画布预览"
          fill
          className="object-cover opacity-90 transition group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, 1100px"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 text-white sm:p-8">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Palette className="size-3.5" />
            canvas-web · 无限画布
          </p>
          <h2 className="text-2xl font-semibold sm:text-3xl">进入无限画布</h2>
          <p className="max-w-xl text-sm text-white/90 sm:text-base">
            ComfyUI 风格节点工作流：图片 / 文本 / 产品参数 / AI 文本 / 图片生成 / 输出
            6 类节点自由拼接，多模型一键切换。
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            打开 {canvasOrigin}
            <ExternalLink className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </a>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <FeatureCard
          icon={<Layers className="size-5 text-violet-500" />}
          title="可视化节点"
          body="像积木一样拼接 6 类节点，每个节点可独立运行，便于复用与调试。"
        />
        <FeatureCard
          icon={<Wand2 className="size-5 text-violet-500" />}
          title="多模型切换"
          body="nano-banana-pro / gpt-image-1 / kling-image，统一走 KIE，密钥归口主站。"
        />
        <FeatureCard
          icon={<ArrowRight className="size-5 text-violet-500" />}
          title="多图融合"
          body="一个生成节点可接 1..N 张参考图，实现风格融合 / 三视图 / 同款换风格。"
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
