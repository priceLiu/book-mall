"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Maximize2 } from "lucide-react";
import { getStoryWebOrigin } from "@/lib/story-web-origin";
import { mainSiteStoryOpenHref } from "@/lib/main-site-app-open-links";
import {
  appendStoryTheaterLibrary,
  listStoryTheaterLibrary,
} from "@/lib/story-theater-library";

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

type StoryTheaterCreatorClientProps = {
  videos: string[];
};

export function StoryTheaterCreatorClient({ videos }: StoryTheaterCreatorClientProps) {
  const storyOrigin = getStoryWebOrigin();
  const storyOpenHref = mainSiteStoryOpenHref("/");
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onFullscreen = useCallback((video: HTMLVideoElement) => {
    requestVideoFullscreen(video);
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8">
        <Link href="/story-theater" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← 漫剧剧场首页
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">创作幻想家</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          观看社区漫剧片段，然后进入 story-web 个人空间开始搭建首页与后续创作流程。每次刷新会随机展示不同作品。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {videos.map((src, index) => (
          <div
            key={src}
            className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-black shadow-lg"
          >
            {mounted ? (
              <video
                className="aspect-video w-full object-cover"
                controls
                playsInline
                preload="metadata"
                muted
                autoPlay={index === 0}
                loop
                src={src}
              />
            ) : (
              <div className="aspect-video w-full bg-neutral-900" aria-hidden />
            )}
            {mounted ? (
              <button
                type="button"
                className="absolute bottom-3 right-3 rounded-lg bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                onClick={(e) => {
                  const video = (e.currentTarget.parentElement?.querySelector("video") ??
                    null) as HTMLVideoElement | null;
                  if (video) onFullscreen(video);
                }}
                aria-label="全屏播放"
              >
                <Maximize2 className="size-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <a
          href={storyOpenHref}
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
