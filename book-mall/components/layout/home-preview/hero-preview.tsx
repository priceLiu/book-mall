"use client";

import Link from "next/link";
import { HeroPreviewFrameworks } from "@/components/layout/home-preview/hero-preview-frameworks";
import { Github, Loader2, Maximize2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const HERO_VIDEO_SRC = "/home-hero.mp4";
const HERO_POSTER = "/main-hero.jpg";
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

function HeroPreviewVideo() {
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

  const showLoadingOverlay = mounted && !videoReady && !videoError;

  return (
    <div className="home-preview-hero-visual-media">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300",
          showLoadingOverlay ? "opacity-100" : "opacity-0",
        )}
        aria-hidden={!showLoadingOverlay}
      >
        <Loader2 className="size-10 animate-spin text-primary" aria-label="视频加载中" />
      </div>

      {videoError ? (
        <div className="home-preview-hero-video-fallback">
          <p>视频暂时无法播放，请刷新页面或检查网络。</p>
        </div>
      ) : !mounted ? (
        <Image
          width={POSTER_DIM.w}
          height={POSTER_DIM.h}
          sizes="55vw"
          priority
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
          className="home-preview-hero-video-el"
          src={HERO_POSTER}
          alt="智选 AI Mall 主视觉"
        />
      ) : (
        <>
          <video
            ref={videoRef}
            className="home-preview-hero-video-el"
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
          <button
            type="button"
            className="home-preview-hero-fullscreen"
            onClick={onFullscreen}
            aria-label="全屏播放视频"
          >
            <Maximize2 className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

/** Semi frame4565：左 45% 文案 + 右 55% 视频贴右缘 */
export function HeroPreviewSection() {
  return (
    <section id="hero-video" className="home-preview-hero">
      <div className="home-preview-hero-glow" aria-hidden />
      <div className="home-preview-hero-glow-right" aria-hidden />

      <div className="home-preview-hero-inner">
        <div className="home-preview-hero-content">
          <h1 className="home-preview-hero-title">
            一人公司，
            <br />
            AI 变身打工仔
          </h1>

          <p className="home-preview-hero-subtitle">
            一人公司、创业老板、自由职业的专属 AI 加油站；一站式找工具、用应用、学课程，打通「找、用、学」闭环。
          </p>

          <div className="home-preview-hero-actions">
            <Link href="/register" className="home-preview-btn-primary">
              开始使用
            </Link>
            <Link href="#pricing" className="home-preview-btn-secondary">
              <Github className="size-5 shrink-0" aria-hidden />
              <span>GitHub</span>
              <span className="home-preview-btn-badge">8k</span>
            </Link>
          </div>

          <HeroPreviewFrameworks />
        </div>

        <div className="home-preview-hero-visual-wrap">
          <div className="home-preview-hero-visual-bg" aria-hidden />
          <HeroPreviewVideo />
        </div>
      </div>
    </section>
  );
}
