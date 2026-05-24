"use client";

import Image from "next/image";
import Link from "next/link";
import { Clapperboard, ExternalLink, Sparkles, Theater } from "lucide-react";
import { mainSiteStoryOpenHref } from "@/lib/main-site-app-open-links";

export function StoryTheaterHero() {
  const storyOpenHref = mainSiteStoryOpenHref("/");

  return (
    <div className="w-full py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-5">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
              <Theater className="size-3.5" />
              漫剧剧场
            </p>
            <h2 className="max-w-lg text-left text-3xl font-semibold tracking-tight sm:text-4xl">
              你的漫剧，值得一座专属剧场
            </h2>
            <p className="max-w-md text-left text-base leading-relaxed text-neutral-600">
              在 story-web 搭建个人空间：固定模板首页可对外发布，创作室、影像室与模型配置将逐步接入。工具站负责发现与收藏，完整创作在独立空间完成。
            </p>
            <div className="flex flex-row flex-wrap gap-3">
              <Link
                href="/story-theater/creator"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                创作幻想家 <Sparkles className="size-4" />
              </Link>
              <a
                href={storyOpenHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                打开 story-web <ExternalLink className="size-4" />
              </a>
              <Link
                href="/story-theater/library"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
              >
                我的剧场 <Clapperboard className="size-4" />
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-lg">
            <Image
              src="/images/v5.jpg"
              alt="漫剧剧场视觉示意"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-sm font-medium">个人空间 · 模板 v1</p>
              <p className="text-xs text-white/80">首页 → 发布到主站 → 直接播放代表作</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
