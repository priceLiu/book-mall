"use client";

import { Children, cloneElement, isValidElement } from "react";

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
 * 首页全宽无限走马灯：内容复制一份，translateX(-50%) 无缝循环。
 * 动画走 Tailwind（globals 打包），不依赖第三方 marquee CSS。
 */
export function SiteHomeInfiniteMarquee({
  className,
  innerClassName,
  duration = "55s",
  pauseOnHover = true,
  fade = true,
  children,
}: Props) {
  const items = Children.toArray(children);
  const loop = [...items, ...items];

  return (
    <div
      className={cn(
        "site-home-infinite-marquee w-full overflow-hidden",
        fade && "site-home-infinite-marquee--fade",
        pauseOnHover && "site-home-infinite-marquee--pause-hover",
        className,
      )}
      style={{ "--duration": duration } as React.CSSProperties}
    >
      <div
        className={cn(
          "site-home-infinite-marquee__track flex w-max shrink-0 animate-site-home-marquee",
          innerClassName,
        )}
      >
        {loop.map((child, index) => {
          if (isValidElement(child)) {
            return cloneElement(child, {
              key: `${String(child.key ?? "item")}-${index}`,
            } as { key: string });
          }
          return (
            <div key={index} className="shrink-0">
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
