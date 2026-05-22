"use client";

type StoryProductFeaturedVideoProps = {
  videoUrl: string;
  posterUrl?: string | null;
  title: string;
};

/** book-mall 产品详情：story-web 发布的空间代表作播放 */
export function StoryProductFeaturedVideo({
  videoUrl,
  posterUrl,
  title,
}: StoryProductFeaturedVideoProps) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border bg-muted/30">
      <div className="aspect-video bg-black">
        <video
          className="h-full w-full object-cover"
          controls
          playsInline
          preload="metadata"
          poster={posterUrl ?? undefined}
        >
          <source src={videoUrl} type="video/mp4" />
          您的浏览器不支持视频播放。
        </video>
      </div>
      <p className="border-t px-4 py-3 text-sm text-muted-foreground">
        漫剧空间代表作 · {title}
      </p>
    </div>
  );
}
