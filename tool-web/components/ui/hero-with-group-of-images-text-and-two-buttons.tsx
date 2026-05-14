"use client";

import Image from "next/image";
import { MoveRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** 本地 Hero 配图：`[0]` 左上、`[1]` 右侧竖图、`[2]` 左下（与栅格 `row-span-2` 一致）。 */
const HERO_IMAGES = [
  { src: "/images/2.jpeg", alt: "文生图示例 1" },
  { src: "/images/1.jpeg", alt: "文生图示例 2" },
  { src: "/images/3.jpeg", alt: "文生图示例 3" },
] as const;

export type TextToImageHeroProps = {
  /** 「跳转生成」滚动到的锚点 id，默认落到面板区域 */
  panelAnchorId?: string;
  /** 点击「填写提示词」打开弹层（与锚点跳转二选一） */
  onFillPrompt?: () => void;
  /** 点击「直接生成」：可先滚动再打开弹层 */
  onDirectGenerate?: () => void;
};

function TextToImageHero({
  panelAnchorId = "text-to-image-panel",
  onFillPrompt,
  onDirectGenerate,
}: TextToImageHeroProps) {
  const anchor = `#${panelAnchorId}`;

  return (
    <div className="w-full py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <h2 className="max-w-lg text-left text-4xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
                用文字，画出下一帧灵感
              </h2>
              <p className="max-w-md text-left text-lg leading-relaxed tracking-tight text-muted-foreground md:text-xl">
                描述你想要的画面与氛围，模型会在服务端完成推理——密钥仅在工具站
                Route Handler 中读取，浏览器拿不到上游 Key。
              </p>
            </div>
            <div className="flex flex-row flex-wrap gap-4">
              {onDirectGenerate ? (
                <Button
                  size="lg"
                  className="gap-2"
                  variant="outline"
                  type="button"
                  onClick={onDirectGenerate}
                >
                  直接生成 <Sparkles className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="lg" className="gap-2" variant="outline" asChild>
                  <a href={anchor}>
                    直接生成 <Sparkles className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {onFillPrompt ? (
                <Button size="lg" className="gap-2" type="button" onClick={onFillPrompt}>
                  填写提示词 <MoveRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="lg" className="gap-2" asChild>
                  <a href={anchor}>
                    填写提示词 <MoveRight className="h-4 w-4" />
                  </a>
                </Button>
              )}
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

export { TextToImageHero as Hero };
