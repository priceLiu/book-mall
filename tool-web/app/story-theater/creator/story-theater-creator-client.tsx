"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Maximize2 } from "lucide-react";
import { getStoryWebOrigin } from "@/lib/story-web-origin";
import {
  appendStoryTheaterLibrary,
  listStoryTheaterLibrary,
} from "@/lib/story-theater-library";

const DEMO_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

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
  } else if (typeof anyV.webkitRequestFullscreen === "function") {
    anyV.webkitRequestFullscreen();
  }
}

export function StoryTheaterCreatorClient() {
  const storyOrigin = getStoryWebOrigin();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onFullscreen = useCallback(() => {
    const v = videoRef.current;
    if (v) requestVideoFullscreen(v);
  }, []);

  const onSaveToLibrary = useCallback(() => {
    const exists = listStoryTheaterLibrary().some((x) => x.spaceUrl === storyOrigin);
    if (exists) {
      setSavedHint("已在「我的剧场」中");
      return;
    }
    appendStoryTheaterLibrary({
      title: "演示漫剧空间",
      note: "从创作幻想家保存的 story-web 入口",
      spaceUrl: storyOrigin,
    });
    setSavedHint("已保存到我的剧场");
  }, [storyOrigin]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8">
        <Link href="/story-theater" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← 漫剧剧场首页
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">创作幻想家</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          观看概念片，然后进入 story-web 个人空间开始搭建首页与后续创作流程。
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-black shadow-lg">
        {mounted && !videoReady ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900">
            <Loader2 className="size-10 animate-spin text-white/80" aria-label="视频加载中" />
          </div>
        ) : null}
        {mounted ? (
          <>
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              controls
              playsInline
              preload="auto"
              muted
              autoPlay
              loop
              onLoadedData={() => setVideoReady(true)}
              onCanPlay={() => setVideoReady(true)}
              onError={() => setVideoReady(true)}
            >
              <source src={DEMO_VIDEO} type="video/mp4" />
            </video>
            <button
              type="button"
              className="absolute bottom-4 right-4 rounded-lg bg-black/60 p-2 text-white hover:bg-black/80"
              onClick={onFullscreen}
              aria-label="全屏播放"
            >
              <Maximize2 className="size-4" />
            </button>
          </>
        ) : (
          <div className="aspect-video bg-neutral-900" />
        )}
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <a
          href={storyOrigin}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          进入 story-web 创作空间
          <ExternalLink className="size-4" />
        </a>
        <button
          type="button"
          onClick={onSaveToLibrary}
          className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          保存到我的剧场
        </button>
        <Link
          href="/story-theater/library"
          className="text-center text-sm text-neutral-500 hover:text-neutral-800 sm:ml-auto"
        >
          查看我的剧场 →
        </Link>
      </div>
      {savedHint ? <p className="mt-3 text-sm text-emerald-700">{savedHint}</p> : null}
    </div>
  );
}
