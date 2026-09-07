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

const SHOW_DELAY_MS = 250;
const HIDE_DELAY_MS = 420;

export type HoverVideoEnlargePayload = {
  url: string;
  posterUrl?: string;
  alt: string;
};

type HoverVideoEnlargeContextValue = {
  requestShow: (
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
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const resumeTimeRef = useRef(0);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const closeNow = useCallback(() => {
    clearShowTimer();
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
    setOpen(null);
    setTouchMode(false);
  }, [clearHideTimer, clearShowTimer]);

  const requestHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      closeNow();
    }, HIDE_DELAY_MS);
  }, [clearHideTimer, closeNow]);

  const requestShow = useCallback(
    (payload: HoverVideoEnlargePayload, sourceVideo?: HTMLVideoElement | null) => {
      if (!prefersHoverVideoEnlarge()) return;
      clearHideTimer();
      if (open?.url === payload.url) return;

      clearShowTimer();
      sourceVideoRef.current = sourceVideo ?? null;
      resumeTimeRef.current = sourceVideo?.currentTime ?? 0;
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        if (sourceVideo) {
          sourceVideo.muted = true;
          sourceVideo.pause();
        }
        setTouchMode(false);
        setVideoLoading(true);
        setOpen(payload);
      }, SHOW_DELAY_MS);
    },
    [clearHideTimer, clearShowTimer, open?.url],
  );

  const toggleTouchPreview = useCallback(
    (payload: HoverVideoEnlargePayload) => {
      if (prefersHoverVideoEnlarge()) return;
      clearShowTimer();
      clearHideTimer();
      sourceVideoRef.current = null;
      resumeTimeRef.current = 0;
      setOpen((prev) => {
        const next = prev?.url === payload.url ? null : payload;
        setVideoLoading(next !== null);
        return next;
      });
    },
    [clearHideTimer, clearShowTimer],
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

    const onLoaded = () => markReady();
    el.addEventListener("loadeddata", onLoaded, { once: true });
    el.addEventListener("canplay", onLoaded, { once: true });
    el.addEventListener("loadedmetadata", onLoaded, { once: true });
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
      el.removeEventListener("loadedmetadata", onLoaded);
      muteVideo(el);
      el.pause();
    };
  }, [open]);

  useEffect(() => {
    if (!touchMode || !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [touchMode, open, closeNow]);

  useEffect(() => () => closeNow(), [closeNow]);

  const portal =
    open && mounted
      ? createPortal(
          <div
            className={cn(
              "fixed inset-0 z-[1100] flex items-center justify-center p-4 transition duration-200",
              touchMode ? "pointer-events-auto" : "pointer-events-none",
              open ? "opacity-100" : "opacity-0",
            )}
            role={touchMode ? "dialog" : undefined}
            aria-modal={touchMode || undefined}
            aria-label={touchMode ? `预览：${open.alt}` : undefined}
            onClick={touchMode ? () => closeNow() : undefined}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.78)_100%)] transition duration-200"
              aria-hidden
            />
            <div
              className={cn(
                "relative inline-block max-w-[min(90vw,640px)] transition duration-200",
                touchMode ? "pointer-events-auto" : "pointer-events-none",
                open ? "scale-100 opacity-100" : "scale-[0.97] opacity-0",
              )}
              onClick={touchMode ? (event) => event.stopPropagation() : undefined}
            >
              <div
                className="pointer-events-none absolute -inset-5 rounded-2xl bg-white/[0.06] backdrop-blur-2xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -inset-3 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),0_28px_72px_rgba(0,0,0,0.42),0_48px_120px_rgba(0,0,0,0.28)]"
                aria-hidden
              />
              <div className="relative min-h-[min(40vh,320px)] min-w-[min(90vw,640px)] overflow-hidden rounded-xl bg-black">
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
                  className={cn(
                    "relative block h-auto max-h-[80vh] w-auto max-w-[min(90vw,640px)] object-contain transition-opacity duration-150",
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
      value={{ requestShow, requestHide, toggleTouchPreview }}
    >
      {children}
      {portal}
    </HoverVideoEnlargeContext.Provider>
  );
}

export function useHoverVideoEnlarge(): HoverVideoEnlargeContextValue | null {
  return useContext(HoverVideoEnlargeContext);
}
