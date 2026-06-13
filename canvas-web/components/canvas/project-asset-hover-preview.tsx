"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { isProjectAssetVideoUrl } from "@/lib/canvas/project-asset-preview";

type HoverState = {
  url: string;
  title: string;
  anchorRect: DOMRect;
  isVideo: boolean;
};

function computePreviewPosition(
  rect: DOMRect,
  previewW: number,
  previewH: number,
): { left: number; top: number } {
  const gap = 14;
  const margin = 10;
  let left = rect.left - previewW - gap;
  let top = rect.top + rect.height / 2 - previewH / 2;

  if (left < margin) {
    left = rect.right + gap;
  }
  if (left + previewW > window.innerWidth - margin) {
    left = Math.max(
      margin,
      Math.min(
        window.innerWidth - previewW - margin,
        rect.left + rect.width / 2 - previewW / 2,
      ),
    );
    top = rect.top - previewH - gap;
  }

  top = Math.max(
    margin,
    Math.min(window.innerHeight - previewH - margin, top),
  );
  return { left, top };
}

export function ProjectAssetHoverPreviewLayer({
  state,
}: {
  state: HoverState | null;
}) {
  if (!state || typeof document === "undefined") return null;

  const previewW = 300;
  const previewH = Math.min(420, Math.max(240, state.anchorRect.height * 2.2));
  const { left, top } = computePreviewPosition(
    state.anchorRect,
    previewW,
    previewH,
  );

  return createPortal(
    <div
      className="pointer-events-none fixed z-[1500]"
      style={{ left, top, width: previewW, height: previewH }}
      aria-hidden
    >
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0c0c12] shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-cyan-400/20">
        <div className="relative min-h-0 flex-1 bg-black/50">
          {state.isVideo ? (
            <video
              src={state.url}
              className="size-full object-contain"
              muted
              playsInline
              autoPlay
              loop
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.url}
              alt=""
              className="size-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
        <p className="shrink-0 truncate border-t border-white/10 px-2.5 py-1.5 text-[11px] text-white/75">
          {state.title}
        </p>
      </div>
    </div>,
    document.body,
  );
}

/** 卡片媒体区悬停 → 左侧/上方放大预览 */
export function useProjectAssetHoverPreview(enabled: boolean) {
  const [state, setState] = useState<HoverState | null>(null);

  const show = useCallback(
    (args: {
      url: string;
      title: string;
      anchor: HTMLElement;
      mimeType?: string | null;
    }) => {
      if (!enabled || !args.url.trim()) return;
      setState({
        url: args.url,
        title: args.title,
        anchorRect: args.anchor.getBoundingClientRect(),
        isVideo: isProjectAssetVideoUrl(args.url, args.mimeType),
      });
    },
    [enabled],
  );

  const hide = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const onScroll = () => setState(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [state]);

  return { hoverPreview: state, showHoverPreview: show, hideHoverPreview: hide };
}

export function ProjectAssetRefSnapshotStrip({
  snapshots,
  heroUrl,
  compact,
  onPreview,
  onHoverSnapshot,
  onLeaveSnapshot,
}: {
  snapshots: Array<{ id: string; url: string; label: string; mimeType: string | null }>;
  heroUrl?: string;
  compact?: boolean;
  onPreview?: (url: string, title: string) => void;
  onHoverSnapshot?: (
    url: string,
    title: string,
    el: HTMLElement,
    mimeType: string | null,
  ) => void;
  onLeaveSnapshot?: () => void;
}) {
  const items = snapshots.filter((s) => s.url !== heroUrl);
  if (items.length === 0) return null;

  const cols = compact ? Math.min(items.length, 4) : Math.min(items.length, 4);

  return (
    <div
      className={cn(
        "mt-2 grid gap-1",
        cols <= 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4",
      )}
    >
      {items.slice(0, 4).map((snap) => (
        <button
          key={snap.id}
          type="button"
          className="nodrag relative aspect-[4/3] overflow-hidden rounded-md border border-white/10 bg-black/40 transition hover:ring-1 hover:ring-cyan-400/40"
          title={snap.label}
          onMouseEnter={(e) =>
            onHoverSnapshot?.(snap.url, snap.label, e.currentTarget, snap.mimeType)
          }
          onMouseLeave={() => onLeaveSnapshot?.()}
          onClick={() => onPreview?.(snap.url, snap.label)}
        >
          {isProjectAssetVideoUrl(snap.url, snap.mimeType) ? (
            <video
              src={snap.url}
              className="size-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={snap.url}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-0.5 py-0.5 text-center text-[7px] text-white/85">
            {snap.label}
          </span>
        </button>
      ))}
    </div>
  );
}
