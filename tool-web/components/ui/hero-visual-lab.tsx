"use client";

import Image from "next/image";
import Link from "next/link";
import { Images, Microscope, Sparkles } from "lucide-react";

const HERO_IMAGES = [
  { src: "/images/cankao4_1.png", alt: "视觉实验示例 · 参考构图" },
  { src: "/images/v5.jpg", alt: "视觉实验示例 · 光影" },
  { src: "/images/3.jpeg", alt: "视觉实验示例 · 色彩" },
] as const;

export type VisualLabHeroProps = {
  analysisHref?: string;
};

export function VisualLabHero({ analysisHref = "/visual-lab/analysis" }: VisualLabHeroProps) {
  return (
    <div className="w-full py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <h2 className="vl-h2-lg max-w-lg text-left">把画面拆开来看清楚</h2>
              <p className="vl-lead max-w-md text-left">
                在分析室对静态图做尺幅、亮度与平均色速写；满意时一键收入成果展。多模态「读懂画面」与主站计费将在后续迭代接入，本版聚焦本地可用的视觉底稿。
              </p>
            </div>
            <div className="flex flex-row flex-wrap gap-4">
              <Link href={analysisHref} className="vl-btn vl-btn-primary">
                进入分析室 <Microscope className="h-4 w-4" strokeWidth={2} />
              </Link>
              <Link href="/visual-lab/gallery" className="vl-btn vl-btn-outline">
                成果展 <Images className="h-4 w-4" strokeWidth={2} />
              </Link>
              <Link href="#visual-lab-intro" className="vl-btn vl-btn-outline">
                能力说明 <Sparkles className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 md:gap-8">
            <div className="vl-hero-media relative aspect-square">
              <Image
                src={HERO_IMAGES[0].src}
                alt={HERO_IMAGES[0].alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="vl-hero-media relative row-span-2">
              <Image
                src={HERO_IMAGES[1].src}
                alt={HERO_IMAGES[1].alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="vl-hero-media relative aspect-square">
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
