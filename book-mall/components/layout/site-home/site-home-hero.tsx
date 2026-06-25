"use client";

import Link from "next/link";
import { SiteHomeFrameworks } from "@/components/layout/site-home/site-home-frameworks";
import { SiteHomeHeroClips } from "@/components/layout/site-home/site-home-hero-clips";
import Image from "next/image";
import { type RefObject, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { makeVideoAudible, muteVideo } from "@/lib/site-home/hover-audio";

// 首帧海报（webp，约 72KB，与视频首帧完全一致 → 视频加载前后无跳变）。
const HERO_POSTER = "/home-hero-poster.webp";
// 压缩后的背景视频：优先 webm（VP9），回退 mp4（H.264，已 faststart）。
const HERO_VIDEO_WEBM = "/home-hero-opt.webm";
const HERO_VIDEO_MP4 = "/home-hero-opt.mp4";
const POSTER_DIM = { w: 1920, h: 1080 } as const;

function SiteHomeHeroBackgroundVideo({
  videoRef,
  onError,
  onMutedChange,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  onError: () => void;
  onMutedChange: (muted: boolean) => void;
}) {
  return (
    <div className="site-home-hero-bg-media" suppressHydrationWarning>
      <video
        ref={videoRef}
        className="site-home-hero-bg-video"
        // 某些浏览器扩展（视频控制/下载助手等）会在 <video> 内注入 <div>，
        // 早于 React 注水 → "Did not expect server HTML to contain a <div> in <video>"。
        // 该子树由外部改写，注水时容忍差异即可。
        suppressHydrationWarning
        poster={HERO_POSTER}
        playsInline
        preload="auto"
        muted
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
    </div>
  );
}

/** 首屏：全屏视频背景 + 底部文案浮层 */
export function SiteHomeHeroSection({ clips }: { clips: string[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [audible, setAudible] = useState(false);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted) {
      makeVideoAudible(v);
    } else {
      muteVideo(v);
    }
  };

  return (
    <section id="hero-video" className="site-home-hero">
      <div className="site-home-hero-bg" aria-hidden>
        {videoError ? (
          <div className="site-home-hero-bg-media">
            <Image
              width={POSTER_DIM.w}
              height={POSTER_DIM.h}
              sizes="100vw"
              priority
              className="site-home-hero-bg-video"
              src={HERO_POSTER}
              alt=""
            />
          </div>
        ) : (
          <SiteHomeHeroBackgroundVideo
            videoRef={videoRef}
            onError={() => setVideoError(true)}
            onMutedChange={(muted) => setAudible(!muted)}
          />
        )}
        <div className="site-home-hero-bg-scrim" />
      </div>

      {!videoError ? (
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
            <SiteHomeHeroClips sources={clips} />

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
