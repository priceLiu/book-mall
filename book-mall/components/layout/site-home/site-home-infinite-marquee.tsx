"use client";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  innerClassName?: string;
  /** 动画时长，如 `55s` */
  duration?: string;
  pauseOnHover?: boolean;
  fade?: boolean;
  children: React.ReactNode;
};

/**
 * 首页全宽无限走马灯：双份内容 + translateX(-50%)，不依赖 @devnomic/marquee 的独立 CSS。
 */
export function SiteHomeInfiniteMarquee({
  className,
  innerClassName,
  duration = "55s",
  pauseOnHover = true,
  fade = true,
  children,
}: Props) {
  return (
    <div
      className={cn(
        "site-home-infinite-marquee",
        fade && "site-home-infinite-marquee--fade",
        pauseOnHover && "site-home-infinite-marquee--pause-hover",
        className,
      )}
      style={{ ["--duration" as string]: duration }}
    >
      <div className="site-home-infinite-marquee__track">
        <div className={cn("site-home-infinite-marquee__group", innerClassName)}>
          {children}
        </div>
        <div className={cn("site-home-infinite-marquee__group", innerClassName)} aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
