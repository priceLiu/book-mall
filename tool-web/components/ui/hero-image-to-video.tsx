"use client";

import Image from "next/image";
import Link from "next/link";
import { Clapperboard, Film, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const HERO_IMAGES = [
  { src: "/images/1.jpeg", alt: "图生视频示例 1" },
  { src: "/images/2.jpeg", alt: "图生视频示例 2" },
  { src: "/images/3.jpeg", alt: "图生视频示例 3" },
] as const;

export type ImageToVideoHeroProps = {
  labHref?: string;
};

export function ImageToVideoHero({ labHref = "/image-to-video/lab" }: ImageToVideoHeroProps) {
  return (
    <div className="w-full py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-5">
            <div>
              <Badge
                variant="outline"
                className="border-violet-500/50 text-violet-700 dark:text-violet-300"
              >
                图生视频 · 实验室预览
              </Badge>
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="max-w-lg text-left text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                静帧起势，让画面动起来
              </h2>
              <p className="max-w-md text-left text-lg leading-relaxed tracking-tight text-muted-foreground md:text-xl">
                上传或选用示例首帧，用提示词描述镜头与动态。成片链路将在服务端完成；当前页面为交互与版式预览，模型对接稍后接入。
              </p>
            </div>
            <div className="flex flex-row flex-wrap gap-4">
              <Button size="lg" className="gap-2 bg-violet-600 hover:bg-violet-700" asChild>
                <Link href={labHref}>
                  进入实验室 <Clapperboard className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 border-violet-400/60" asChild>
                <Link href="/image-to-video/library">
                  我的视频库 <Film className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 border-violet-400/60" asChild>
                <Link href="#image-to-video-intro">
                  能力说明 <Sparkles className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 md:gap-8">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-violet-500/15">
              <Image
                src={HERO_IMAGES[0].src}
                alt={HERO_IMAGES[0].alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="relative row-span-2 overflow-hidden rounded-lg bg-muted ring-1 ring-violet-500/15">
              <Image
                src={HERO_IMAGES[1].src}
                alt={HERO_IMAGES[1].alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-violet-500/15">
              <Image
                src={HERO_IMAGES[2].src}
                alt={HERO_IMAGES[2].alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
