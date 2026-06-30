"use client";

import type { MutableRefObject, ReactNode, Ref } from "react";
import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";
import { cn } from "@/lib/utils";

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as MutableRefObject<T | null>).current = node;
    }
  };
}

type LazyShellProps = {
  src?: string;
  className?: string;
  rootMargin?: string;
  /** 节点内已生成媒体 · 跳过 IO 灰底，立即加载封面/首帧 */
  eager?: boolean;
  /** 与外部 ref 合并（如 tooltip 锚点） */
  containerRef?: Ref<HTMLDivElement>;
  children: (active: boolean) => ReactNode;
};

function LazyMediaShell({
  src,
  className,
  rootMargin = "240px",
  eager = false,
  containerRef,
  children,
}: LazyShellProps) {
  const { ref: lazyRef, active } = useLazyMediaActive(rootMargin, eager);

  if (!src) return null;

  return (
    <div ref={mergeRefs(lazyRef, containerRef)} className={className}>
      {active ? (
        children(true)
      ) : (
        <div
          className="absolute inset-0 animate-pulse bg-white/[0.04]"
          aria-hidden
        />
      )}
    </div>
  );
}

export function LazyViewportImage({
  src,
  alt = "",
  className,
  imgClassName,
  rootMargin,
  containerRef,
  eager = false,
}: {
  src?: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  rootMargin?: string;
  containerRef?: Ref<HTMLDivElement>;
  eager?: boolean;
}) {
  return (
    <LazyMediaShell
      src={src}
      className={cn("relative", className)}
      rootMargin={rootMargin}
      eager={eager}
      containerRef={containerRef}
    >
      {() => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn("size-full object-contain", imgClassName)}
          draggable={false}
        />
      )}
    </LazyMediaShell>
  );
}

export function LazyViewportVideo({
  src,
  className,
  videoClassName,
  rootMargin,
  containerRef,
  preload = "metadata",
  eager = false,
  poster,
}: {
  src?: string;
  className?: string;
  videoClassName?: string;
  rootMargin?: string;
  containerRef?: Ref<HTMLDivElement>;
  preload?: "none" | "metadata" | "auto";
  eager?: boolean;
  poster?: string;
}) {
  return (
    <LazyMediaShell
      src={src}
      className={cn("relative", className)}
      rootMargin={rootMargin}
      eager={eager}
      containerRef={containerRef}
    >
      {() => (
        <video
          src={src}
          poster={poster}
          className={cn("size-full object-contain", videoClassName)}
          playsInline
          muted
          preload={preload}
          draggable={false}
        />
      )}
    </LazyMediaShell>
  );
}
