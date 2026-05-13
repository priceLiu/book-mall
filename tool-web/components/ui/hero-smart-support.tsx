"use client";

import Image from "next/image";
import Link from "next/link";
import { Headphones, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** 与文案对应的客服 / 会话场景配图（Unsplash，需在 next.config remotePatterns 中放行）。 */
const HERO_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80",
    alt: "前台接待与咨询场景",
  },
  {
    src: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=900&q=80",
    alt: "客服人员佩戴耳机专注解答",
  },
  {
    src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    alt: "即时消息与多端会话",
  },
] as const;

export type SmartSupportHeroProps = {
  panelAnchorId?: string;
};

export function SmartSupportHero({
  panelAnchorId = "smart-support-panel",
}: SmartSupportHeroProps) {
  const anchor = `#${panelAnchorId}`;

  return (
    <div className="w-full py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-5">
            <div>
              <Badge variant="outline">AI智能客服已就绪</Badge>
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="max-w-lg text-left text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                7×24，接住每一句问询
              </h2>
              <p className="max-w-md text-left text-lg leading-relaxed tracking-tight text-muted-foreground md:text-xl">
                常见问题由 AI
                即时归纳产品与账单口径；复杂场景可预留转人工。会话经工具站服务端处理，不在浏览器暴露上游模型密钥。
              </p>
            </div>
            <div className="flex flex-row flex-wrap gap-4">
              <Button size="lg" className="gap-2" asChild>
                <Link href="/smart-support/chat">
                  我的智能客服 <MessageCircle className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" className="gap-2" variant="outline" asChild>
                <a href={anchor}>
                  功能说明 <Headphones className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 md:gap-8">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              <Image
                src={HERO_IMAGES[0].src}
                alt={HERO_IMAGES[0].alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="relative row-span-2 overflow-hidden rounded-lg bg-muted">
              <Image
                src={HERO_IMAGES[1].src}
                alt={HERO_IMAGES[1].alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
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
