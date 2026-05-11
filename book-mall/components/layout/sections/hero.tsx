"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/** 首页大图：由 public/main.png 等比缩至 1920 宽后导出 main-hero.jpg（更小体积，视觉一致） */
const HERO_IMG = {
  src: "/main-hero.jpg",
  w: 1920,
  h: 1013,
} as const;

export const HeroSection = () => {
  return (
    <section className="container w-full">
      <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
        <div className="text-center space-y-8">
          <Badge variant="outline" className="text-sm py-2">
            <span className="mr-2 text-primary">
              <Badge>新品</Badge>
            </span>
            <span> 找AI上智选, 学AI找智选 </span>
          </Badge>

          <div className="w-full max-w-screen-xl mx-auto px-2 text-center font-bold">
            <h1 className="flex flex-nowrap items-end justify-center gap-x-1 sm:gap-x-2 md:gap-x-4 leading-none">
              <span className="whitespace-nowrap text-base sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl">
                一人公司
              </span>
              <span className="whitespace-nowrap text-xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl text-transparent bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                AI打工仔
              </span>
              <span className="whitespace-nowrap text-base sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl">
                指挥就行
              </span>
            </h1>
          </div>

          <p className="max-w-screen-sm mx-auto text-xl text-muted-foreground">
            {`AI 是帮助您实现梦想的。获取独家资源、教程与支持。`}
          </p>

          <div className="space-y-4 md:space-y-0 md:space-x-4">
            <Button className="w-5/6 md:w-1/4 font-bold group/arrow" asChild>
              <Link href="/subscribe">
                了解订阅
                <ArrowRight className="size-5 ml-2 group-hover/arrow:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative group mt-14 w-full max-w-screen-xl mx-auto px-2">
          <div className="pointer-events-none absolute top-2 lg:-top-8 inset-x-0 mx-auto h-24 lg:h-80 max-w-full bg-primary/50 rounded-full blur-3xl" />
          <Image
            width={HERO_IMG.w}
            height={HERO_IMG.h}
            sizes="(max-width: 1280px) calc(100vw - 1rem), 1280px"
            priority
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            className="relative w-full h-auto rounded-lg border border-secondary border-t-2 border-t-primary/30"
            src={HERO_IMG.src}
            alt="AI 工具集与智选产品示意"
          />

          <div className="absolute bottom-0 left-0 right-0 h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/50 to-background rounded-lg pointer-events-none" />
        </div>
      </div>
    </section>
  );
};
