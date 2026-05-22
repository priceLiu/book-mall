"use client";

type FeaturedWork = {
  title: string;
  description: string;
  videoSrc: string;
  poster?: string;
};

export function FeaturedWorkPlayer({
  work,
  dark = false,
}: {
  work: FeaturedWork;
  dark?: boolean;
}) {
  return (
    <article
      className={
        dark
          ? "overflow-hidden rounded-lg border border-white/10 bg-[var(--story-surface)]"
          : "story-card overflow-hidden"
      }
    >
      <div className="aspect-video bg-black">
        <video
          className="h-full w-full object-cover"
          controls
          playsInline
          preload="metadata"
          poster={work.poster}
        >
          <source src={work.videoSrc} type="video/mp4" />
          您的浏览器不支持视频播放。
        </video>
      </div>
      <div className={`border-t p-5 sm:p-6 ${dark ? "border-white/10" : "border-[var(--story-border)]"}`}>
        <h3 className={`text-lg font-semibold ${dark ? "text-white" : ""}`}>{work.title}</h3>
        <p className={`mt-1 text-sm ${dark ? "text-[var(--story-muted)]" : "text-[var(--story-muted)]"}`}>
          {work.description}
        </p>
      </div>
    </article>
  );
}
