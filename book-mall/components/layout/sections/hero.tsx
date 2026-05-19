"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Maximize2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const HERO_VIDEO_SRC = "/home-hero.mp4";
const HERO_POSTER = "/main-hero.jpg";
/** 与历史首页大图一致，避免布局跳动 */
const POSTER_DIM = { w: 1920, h: 1013 } as const;

function requestVideoFullscreen(video: HTMLVideoElement) {
  if (video.requestFullscreen) {
    void video.requestFullscreen();
    return;
  }
  const anyV = video as HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitRequestFullscreen?: () => void;
  };
  if (typeof anyV.webkitEnterFullscreen === "function") {
    anyV.webkitEnterFullscreen();
    return;
  }
  if (typeof anyV.webkitRequestFullscreen === "function") {
    anyV.webkitRequestFullscreen();
  }
}

export const HeroSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onFullscreen = useCallback(() => {
    const v = videoRef.current;
    if (v) requestVideoFullscreen(v);
  }, []);

  /** 仅客户端挂载 video：带 controls 时浏览器会改写 video 内部 DOM，与 SSR 不一致会触发 hydration error */
  const showLoadingOverlay = mounted && !videoReady && !videoError;

  return (
    <section id="hero-video" className="container w-full scroll-mt-28">
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
              <span
                className={cn(
                  "inline-block whitespace-nowrap text-xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl",
                  "bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text text-transparent",
                  // iOS / WebKit：仅 `color: transparent` 时常出现渐变色块盖住字形，需同步 -webkit 裁剪与填充
                  "[-webkit-background-clip:text] [-webkit-text-fill-color:transparent]",
                )}
              >
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

          <div
            className={cn(
              "relative w-full overflow-hidden rounded-lg border border-secondary border-t-2 border-t-primary/30 bg-black/5",
              "shadow-sm",
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/40 transition-opacity duration-300",
                showLoadingOverlay ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              aria-hidden={!showLoadingOverlay}
            >
              <Loader2 className="size-10 animate-spin text-primary" aria-label="视频加载中" />
            </div>

            {videoError ? (
              <div className="relative aspect-video w-full flex flex-col items-center justify-center gap-2 bg-muted p-8 text-center text-muted-foreground">
                <p>视频暂时无法播放，请刷新页面或检查网络。</p>
              </div>
            ) : !mounted ? (
              <Image
                width={POSTER_DIM.w}
                height={POSTER_DIM.h}
                sizes="(max-width: 1280px) calc(100vw - 1rem), 1280px"
                priority
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
                className="relative z-[1] w-full h-auto max-h-[min(85vh,1013px)] object-contain mx-auto bg-black/5"
                src={HERO_POSTER}
                alt="智选 AI Mall 主视觉"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="relative z-[1] block w-full h-auto max-h-[min(85vh,1013px)] object-contain mx-auto bg-black/5"
                  poster={HERO_POSTER}
                  controls
                  playsInline
                  preload="auto"
                  muted
                  autoPlay
                  loop
                  onLoadedData={(e) => {
                    setVideoReady(true);
                    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                      e.currentTarget.pause();
                      e.currentTarget.removeAttribute("autoplay");
                    }
                  }}
                  onCanPlay={() => setVideoReady(true)}
                  onError={() => {
                    setVideoError(true);
                    setVideoReady(true);
                  }}
                >
                  <source src={HERO_VIDEO_SRC} type="video/mp4" />
                </video>

                <div className="absolute top-3 right-3 z-[2] flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="pointer-events-auto touch-manipulation shadow-md"
                    onClick={onFullscreen}
                    aria-label="全屏播放视频"
                  >
                    <Maximize2 className="size-4 sm:mr-1" />
                    <span className="hidden sm:inline">全屏</span>
                  </Button>
                </div>
              </>
            )}

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/50 to-background rounded-lg z-[1]" />
          </div>
        </div>
      </div>
    </section>
  );
};
