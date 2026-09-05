"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  innerClassName?: string;
  /** 滚动速度 px/s */
  speed?: number;
  pauseOnHover?: boolean;
  fade?: boolean;
  children: React.ReactNode;
};

/** 单段至少 N 张卡片，避免宽屏下右侧长期空白 */
const MIN_ITEMS_PER_SEGMENT = 10;

function buildMarqueeLoop(items: React.ReactNode[]): React.ReactNode[] {
  if (items.length === 0) return [];
  let segment = [...items];
  while (segment.length < MIN_ITEMS_PER_SEGMENT) {
    segment = [...segment, ...items];
  }
  return [...segment, ...segment];
}

/**
 * 首页全宽无限走马灯（rAF 驱动，避免 CSS 动画被 overflow-x:clip 等拦截）。
 */
export function SiteHomeInfiniteMarquee({
  className,
  innerClassName,
  speed = 48,
  pauseOnHover = true,
  fade = true,
  children,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const [ready, setReady] = useState(false);

  const items = useMemo(() => Children.toArray(children), [children]);
  const loop = useMemo(() => buildMarqueeLoop(items), [items]);

  const tick = useCallback(
    (now: number, last: number) => {
      const track = trackRef.current;
      if (!track || pausedRef.current) return last;

      const dt = Math.min((now - last) / 1000, 0.05);
      const loopWidth = track.scrollWidth / 2;
      if (loopWidth <= 0) return now;

      offsetRef.current -= speed * dt;
      if (-offsetRef.current >= loopWidth) {
        offsetRef.current += loopWidth;
      }
      track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      return now;
    },
    [speed],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      track.style.transform = "";
      setReady(true);
      return;
    }

    let last = performance.now();
    const frame = (now: number) => {
      last = tick(now, last);
      rafRef.current = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(rafRef.current);
      offsetRef.current = 0;
      last = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(() => {
      setReady(true);
      start();
    });

    ro.observe(track);
    setReady(true);
    start();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [tick, loop]);

  return (
    <div
      className={cn(
        "site-home-infinite-marquee w-full overflow-hidden",
        fade && "site-home-infinite-marquee--fade",
        className,
      )}
      onMouseEnter={pauseOnHover ? () => { pausedRef.current = true; } : undefined}
      onMouseLeave={
        pauseOnHover
          ? () => {
              pausedRef.current = false;
            }
          : undefined
      }
    >
      <div
        ref={trackRef}
        className={cn(
          "site-home-infinite-marquee__track flex w-max shrink-0",
          innerClassName,
          !ready && "opacity-0",
          ready && "opacity-100 transition-opacity duration-300",
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
