"use client";

import Link from "next/link";
import { SiteHomeFrameworks } from "@/components/layout/site-home/site-home-frameworks";
import { SiteHomeHeroClips } from "@/components/layout/site-home/site-home-hero-clips";
import type { StoryHeroClip } from "@/lib/story-theater-videos";
import Image from "next/image";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { makeVideoAudible, muteVideo } from "@/lib/site-home/hover-audio";

// 首帧海报（webp，约 72KB，与视频首帧完全一致 → 视频加载前后无跳变）。
const HERO_POSTER = "/home-hero-poster.webp";
// 压缩后的背景视频：优先 webm（VP9），回退 mp4（H.264，已 faststart）。
const HERO_VIDEO_WEBM = "/home-hero-opt.webm";
const HERO_VIDEO_MP4 = "/home-hero-opt.mp4";
const POSTER_DIM = { w: 1920, h: 1080 } as const;

function HeroPosterImage() {
  return (
    <Image
      width={POSTER_DIM.w}
      height={POSTER_DIM.h}
      sizes="100vw"
      priority
      className="site-home-hero-bg-video"
      src={HERO_POSTER}
      alt=""
    />
  );
}

function SiteHomeHeroBackgroundVideo({
  videoRef,
  audible,
  onError,
  onMutedChange,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  audible: boolean;
  onError: () => void;
  onMutedChange: (muted: boolean) => void;
}) {
  return (
    <video
      ref={videoRef}
      className="site-home-hero-bg-video"
      poster={HERO_POSTER}
      playsInline
      preload="auto"
      // muted 由 audible 状态驱动：硬编码 muted 会在每次 re-render 被 React 重新置真，
      // 导致点击取消静音后立刻又被静音（点了没声音）。
      muted={!audible}
      autoPlay
      loop
      aria-hidden
      onVolumeChange={(e) => onMutedChange(e.currentTarget.muted)}
      onLoadedData={(e) => {
        if (
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          e.currentTarget.pause();
          e.currentTarget.removeAttribute("autoplay");
        }
      }}
      onError={onError}
    >
      <source src={HERO_VIDEO_WEBM} type="video/webm" />
      <source src={HERO_VIDEO_MP4} type="video/mp4" />
    </video>
  );
}

/** 首屏：全屏视频背景 + 底部文案浮层 */
export function SiteHomeHeroSection({ clips }: { clips: StoryHeroClip[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [audible, setAudible] = useState(false);

  // 视频仅在挂载后（客户端）渲染：服务端与首个客户端渲染都用首帧海报 <img>，
  // 二者一致 → 无注水比对；浏览器扩展往 <video> 注入 <div> 也不再触发 hydration 报错。
  useEffect(() => {
    setMounted(true);
  }, []);

  const showVideo = mounted && !videoError;

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted) {
      makeVideoAudible(v);
      setAudible(true);
    } else {
      muteVideo(v);
      setAudible(false);
    }
  };

  return (
    <section id="hero-video" className="site-home-hero">
      <div className="site-home-hero-bg" aria-hidden>
        <div className="site-home-hero-bg-media" suppressHydrationWarning>
          {showVideo ? (
            <SiteHomeHeroBackgroundVideo
              videoRef={videoRef}
              audible={audible}
              onError={() => setVideoError(true)}
              onMutedChange={(muted) => setAudible(!muted)}
            />
          ) : (
            <HeroPosterImage />
          )}
        </div>
        <div className="site-home-hero-bg-scrim" />
      </div>

      {showVideo ? (
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={audible}
          aria-label={audible ? "关闭声音" : "播放声音"}
          className="site-home-hero-sound-btn"
        >
          {audible ? (
            <Volume2 className="size-5" aria-hidden />
          ) : (
            <VolumeX className="size-5" aria-hidden />
          )}
        </button>
      ) : null}

      <div className="site-home-hero-inner">
        <div className="site-home-hero-content">
          <div className="site-home-hero-bottom">
            <SiteHomeHeroClips clips={clips} />

            <div className="site-home-hero-copy-panel">
              <div className="site-home-hero-copy">
                <h1 className="site-home-hero-title">
                  全球顶级视频、图像、音乐与 LLM 模型
                </h1>

                <p className="site-home-hero-subtitle">
                  多种接入方式：开箱即用、自带厂商 Key 接入，或通过 API 统一调用。
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
