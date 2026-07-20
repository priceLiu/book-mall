"use client";

import Link from "next/link";
import { SiteHomeFrameworks } from "@/components/layout/site-home/site-home-frameworks";
import { SiteHomeHeroClips } from "@/components/layout/site-home/site-home-hero-clips";
import type {
  StoryHeroBackground,
  StoryHeroClip,
} from "@/lib/story-theater-videos";
import Image from "next/image";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { makeVideoAudible, muteVideo } from "@/lib/site-home/hover-audio";

const LOCAL_HERO_POSTER = "/home-hero-poster.webp";
const LOCAL_HERO_VIDEO_WEBM = "/home-hero-opt.webm";
const LOCAL_HERO_VIDEO_MP4 = "/home-hero-opt.mp4";
const POSTER_DIM = { w: 1920, h: 1080 } as const;

function isLocalHeroVideo(url: string): boolean {
  return url.startsWith("/home-hero");
}

function HeroPosterImage({ poster }: { poster: string }) {
  if (poster === LOCAL_HERO_POSTER) {
    return (
      <Image
        width={POSTER_DIM.w}
        height={POSTER_DIM.h}
        sizes="100vw"
        priority
        className="site-home-hero-bg-video"
        src={poster}
        alt=""
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={poster}
      alt=""
      aria-hidden
      className="site-home-hero-bg-video"
      fetchPriority="high"
      decoding="async"
    />
  );
}

function SiteHomeHeroBackgroundVideo({
  videoRef,
  background,
  audible,
  onError,
  onMutedChange,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  background: StoryHeroBackground;
  audible: boolean;
  onError: () => void;
  onMutedChange: (muted: boolean) => void;
}) {
  const useLocalSources = isLocalHeroVideo(background.url);

  return (
    <video
      ref={videoRef}
      className="site-home-hero-bg-video"
      poster={background.poster}
      playsInline
      preload="auto"
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
      {useLocalSources ? (
        <>
          <source src={LOCAL_HERO_VIDEO_WEBM} type="video/webm" />
          <source src={LOCAL_HERO_VIDEO_MP4} type="video/mp4" />
        </>
      ) : (
        <source src={background.url} type="video/mp4" />
      )}
    </video>
  );
}

/** 首屏：全屏视频背景 + 底部文案浮层 */
export function SiteHomeHeroSection({
  clips,
  background: initialBackground,
}: {
  clips: StoryHeroClip[];
  background: StoryHeroBackground;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [audible, setAudible] = useState(false);
  const [background, setBackground] = useState(initialBackground);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setBackground(initialBackground);
    setVideoError(false);
  }, [initialBackground]);

  const showVideo = mounted && !videoError;

  const handleVideoError = () => {
    if (!isLocalHeroVideo(background.url)) {
      setBackground({
        url: LOCAL_HERO_VIDEO_MP4,
        poster: LOCAL_HERO_POSTER,
      });
      setVideoError(false);
      return;
    }
    setVideoError(true);
  };

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
              key={background.url}
              videoRef={videoRef}
              background={background}
              audible={audible}
              onError={handleVideoError}
              onMutedChange={(muted) => setAudible(!muted)}
            />
          ) : (
            <HeroPosterImage poster={background.poster} />
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
