"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { makeVideoAudible, muteVideo } from "@/lib/canvas/hover-video-audio";
import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { CanvasBrandLoadingLogo } from "@/components/home/canvas-brand-loading-logo";
import { cn } from "@/lib/utils";

const HIDE_DELAY_MS = 420;

type VideoPreviewOrientation = "landscape" | "portrait" | "unknown";

function readVideoFrame(el: HTMLVideoElement | null | undefined): {
  orientation: VideoPreviewOrientation;
  /** 宽 / 高。用来按视口铺满，而不是停在视频原始像素。 */
  aspect: number | null;
} {
  if (!el?.videoWidth || !el?.videoHeight) {
    return { orientation: "unknown", aspect: null };
  }
  return {
    orientation: el.videoWidth > el.videoHeight ? "landscape" : "portrait",
    aspect: el.videoWidth / el.videoHeight,
  };
}

/** 横屏、竖屏都铺满 92vw × 85vh，宽高比跟视频走。 */
function previewFillStyle(
  orientation: VideoPreviewOrientation,
  aspect: number | null,
):
  | {
      width: string;
      height: string;
      maxWidth: string;
      maxHeight: string;
      aspectRatio: string;
    }
  | undefined {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return undefined;
  const aspectRatio = String(aspect);
  if (orientation === "landscape") {
    return {
      width: `min(92vw, calc(85vh * ${aspect}))`,
      height: "auto",
      maxWidth: "92vw",
      maxHeight: "85vh",
      aspectRatio,
    };
  }
  if (orientation === "portrait") {
    return {
      width: "auto",
      height: `min(85vh, calc(92vw / ${aspect}))`,
      maxWidth: "92vw",
      maxHeight: "85vh",
      aspectRatio,
    };
  }
  return undefined;
}

export type HoverVideoEnlargePayload = {
  url: string;
  posterUrl?: string;
  alt: string;
};

type HoverVideoEnlargeContextValue = {
  /** 点击放大钮：立即打开可关闭的居中预览 */
  openPreview: (
    payload: HoverVideoEnlargePayload,
    sourceVideo?: HTMLVideoElement | null,
  ) => void;
  requestHide: () => void;
  toggleTouchPreview: (payload: HoverVideoEnlargePayload) => void;
};

const HoverVideoEnlargeContext =
  createContext<HoverVideoEnlargeContextValue | null>(null);

export function prefersHoverVideoEnlarge(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function HoverVideoEnlargeProvider({ children }: { children: ReactNode }) {
  const mounted = useClientPortalMounted();
  const [open, setOpen] = useState<HoverVideoEnlargePayload | null>(null);
  const [touchMode, setTouchMode] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [orientation, setOrientation] =
    useState<VideoPreviewOrientation>("unknown");
  const [aspect, setAspect] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const resumeTimeRef = useRef(0);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const closeNow = useCallback(() => {
    clearHideTimer();
    const portal = videoRef.current;
    if (portal) {
      muteVideo(portal);
      portal.pause();
    }
    const source = sourceVideoRef.current;
    if (source) {
      muteVideo(source);
      source.pause();
      source.currentTime = 0;
      sourceVideoRef.current = null;
    }
    resumeTimeRef.current = 0;
    setVideoLoading(false);
    setOrientation("unknown");
    setAspect(null);
    setOpen(null);
    setTouchMode(false);
    setInteractive(false);
  }, [clearHideTimer]);

  const requestHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      closeNow();
    }, HIDE_DELAY_MS);
  }, [clearHideTimer, closeNow]);

  const openPreview = useCallback(
    (payload: HoverVideoEnlargePayload, sourceVideo?: HTMLVideoElement | null) => {
      clearHideTimer();
      if (open?.url === payload.url && interactive) {
        closeNow();
        return;
      }

      sourceVideoRef.current = sourceVideo ?? null;
      resumeTimeRef.current = sourceVideo?.currentTime ?? 0;
      if (sourceVideo) {
        sourceVideo.muted = true;
        sourceVideo.pause();
      }
      setTouchMode(false);
      setInteractive(true);
      setVideoLoading(true);
      const frame = readVideoFrame(sourceVideo);
      setOrientation(frame.orientation);
      setAspect(frame.aspect);
      setOpen(payload);
    },
    [clearHideTimer, closeNow, interactive, open?.url],
  );

  const toggleTouchPreview = useCallback(
    (payload: HoverVideoEnlargePayload) => {
      if (prefersHoverVideoEnlarge()) return;
      clearHideTimer();
      sourceVideoRef.current = null;
      resumeTimeRef.current = 0;
      setOpen((prev) => {
        const next = prev?.url === payload.url ? null : payload;
        setVideoLoading(next !== null);
        setInteractive(next !== null);
        return next;
      });
    },
    [clearHideTimer],
  );

  useEffect(() => {
    setTouchMode(Boolean(open) && !prefersHoverVideoEnlarge());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = videoRef.current;
    if (!el) return;

    const startPlayback = () => {
      const resumeAt = resumeTimeRef.current;
      if (resumeAt > 0.05) {
        try {
          el.currentTime = resumeAt;
        } catch {
          /* ignore */
        }
      }
      makeVideoAudible(el);
    };

    const markReady = () => {
      setVideoLoading(false);
      startPlayback();
    };

    const onMetadata = () => {
      const frame = readVideoFrame(el);
      if (frame.orientation !== "unknown") {
        setOrientation(frame.orientation);
        setAspect(frame.aspect);
      }
      markReady();
    };

    const onLoaded = () => markReady();
    el.addEventListener("loadeddata", onLoaded, { once: true });
    el.addEventListener("canplay", onLoaded, { once: true });
    el.addEventListener("loadedmetadata", onMetadata, { once: true });
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      markReady();
    } else {
      void el.play().catch(() => {
        el.muted = true;
        void el.play().catch(() => undefined);
      });
    }

    return () => {
      el.removeEventListener("loadeddata", onLoaded);
      el.removeEventListener("canplay", onLoaded);
      el.removeEventListener("loadedmetadata", onMetadata);
      muteVideo(el);
      el.pause();
    };
  }, [open]);

  useEffect(() => {
    if ((!touchMode && !interactive) || !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [touchMode, interactive, open, closeNow]);

  useEffect(() => () => closeNow(), [closeNow]);

  const dismissible = touchMode || interactive;

  const portal =
    open && mounted
      ? createPortal(
          <div
            className={cn(
              "fixed inset-0 z-[1100] flex items-center justify-center p-4 transition duration-200",
              dismissible ? "pointer-events-auto" : "pointer-events-none",
              open ? "opacity-100" : "opacity-0",
            )}
            role={dismissible ? "dialog" : undefined}
            aria-modal={dismissible || undefined}
            aria-label={dismissible ? `预览：${open.alt}` : undefined}
            onClick={dismissible ? () => closeNow() : undefined}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.78)_100%)] transition duration-200"
              aria-hidden
            />
            <div
              className={cn(
                "relative inline-block w-max max-w-[92vw] transition duration-200",
                dismissible ? "pointer-events-auto" : "pointer-events-none",
                open ? "scale-100 opacity-100" : "scale-[0.97] opacity-0",
              )}
              onClick={dismissible ? (event) => event.stopPropagation() : undefined}
            >
              <div
                className="pointer-events-none absolute -inset-2 rounded-2xl bg-white/[0.06] backdrop-blur-2xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -inset-1.5 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),0_28px_72px_rgba(0,0,0,0.42),0_48px_120px_rgba(0,0,0,0.28)]"
                aria-hidden
              />
              <div
                className={cn(
                  "relative flex w-max max-h-[85vh] max-w-[92vw] items-center justify-center overflow-hidden rounded-xl bg-black",
                )}
              >
                {open.posterUrl && videoLoading ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={open.posterUrl}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 size-full object-contain opacity-50"
                  />
                ) : null}
                <video
                  ref={videoRef}
                  key={open.url}
                  src={open.url}
                  poster={open.posterUrl || undefined}
                  style={previewFillStyle(orientation, aspect)}
                  className={cn(
                    "relative h-auto max-h-[85vh] w-auto max-w-[92vw] object-contain transition-opacity duration-150",
                    videoLoading ? "opacity-0" : "opacity-100",
                  )}
                  muted
                  playsInline
                  loop
                  preload="auto"
                  aria-label={open.alt}
                  onLoadedData={() => setVideoLoading(false)}
                  onCanPlay={() => setVideoLoading(false)}
                  onError={() => setVideoLoading(false)}
                />
                {videoLoading ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <CanvasBrandLoadingLogo size="lg" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <HoverVideoEnlargeContext.Provider
      value={{ openPreview, requestHide, toggleTouchPreview }}
    >
      {children}
      {portal}
    </HoverVideoEnlargeContext.Provider>
  );
}

export function useHoverVideoEnlarge(): HoverVideoEnlargeContextValue | null {
  return useContext(HoverVideoEnlargeContext);
}
