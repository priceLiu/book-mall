"use client";

import Link from "next/link";
import { SiteHomeFrameworks } from "@/components/layout/site-home/site-home-frameworks";
import { SiteHomeHeroClips } from "@/components/layout/site-home/site-home-hero-clips";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const HERO_VIDEO_SRC = "/home-hero.mp4";
const HERO_POSTER = "/main-hero.jpg";
const POSTER_DIM = { w: 1920, h: 1013 } as const;

function SiteHomeHeroBackgroundVideo() {
  const [mounted, setMounted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showLoadingOverlay = mounted && !videoReady && !videoError;

  return (
    <div className="site-home-hero-bg-media">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1] flex items-center justify-center transition-opacity duration-300",
          showLoadingOverlay ? "opacity-100" : "opacity-0",
        )}
        aria-hidden={!showLoadingOverlay}
      >
        <Loader2
          className="size-10 animate-spin text-white/80"
          aria-label="视频加载中"
        />
      </div>

      {videoError ? (
        <Image
          width={POSTER_DIM.w}
          height={POSTER_DIM.h}
          sizes="100vw"
          priority
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
          className="site-home-hero-bg-video"
          src={HERO_POSTER}
          alt=""
        />
      ) : !mounted ? (
        <Image
          width={POSTER_DIM.w}
          height={POSTER_DIM.h}
          sizes="100vw"
          priority
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
          className="site-home-hero-bg-video"
          src={HERO_POSTER}
          alt=""
        />
      ) : (
        <video
          className="site-home-hero-bg-video"
          poster={HERO_POSTER}
          playsInline
          preload="auto"
          muted
          autoPlay
          loop
          aria-hidden
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
      )}
    </div>
  );
}

/** 首屏：全屏视频背景 + 底部文案浮层 */
export function SiteHomeHeroSection({ clips }: { clips: string[] }) {
  return (
    <section id="hero-video" className="site-home-hero">
      <div className="site-home-hero-bg" aria-hidden>
        <SiteHomeHeroBackgroundVideo />
        <div className="site-home-hero-bg-scrim" />
      </div>

      <div className="site-home-hero-inner">
        <div className="site-home-hero-content">
          <div className="site-home-hero-bottom">
            <SiteHomeHeroClips sources={clips} />

            <div className="site-home-hero-copy-panel">
              <div className="site-home-hero-copy">
                <h1 className="site-home-hero-title">
                  一人公司 AI 变身打工仔
                </h1>

                <p className="site-home-hero-subtitle">
                  一人公司、创业老板、自由职业的专属 AI 加油站；一站式找工具、用应用、学课程，打通「找、用、学」闭环。
                </p>

                <div className="site-home-hero-actions">
                  <Link href="/register" className="site-home-btn-primary">
                    开始使用
                  </Link>
                  <Link href="/pricing" className="site-home-btn-secondary">
                    <span>查看报价</span>
                  </Link>
                </div>

                <SiteHomeFrameworks />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
