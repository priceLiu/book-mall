"use client";

import { Loader2, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  showCanvasCreditsToast,
  showCanvasErrorToast,
} from "@/components/canvas/canvas-credits-toast-host";
import {
  fetchLibtvTtsPreviewDataUrl,
  pickLibtvTtsPreviewParams,
  type LibtvTtsPreviewContext,
} from "@/lib/canvas/libtv-tts-preview-client";
import { dispatchPlatformCreditsBalanceRefresh } from "@/lib/canvas/canvas-credits-balance-events";
import {
  playLibtvVoicePreview,
  resolveLibtvRowPreviewText,
  resolveLibtvVoicePreviewUrl,
  stopAllLibtvVoicePreviews,
  subscribeLibtvVoicePreviewStop,
} from "@/lib/canvas/libtv-voice-preview";
import { libtvDockSegmentButtonClass } from "@/components/canvas/libtv-dock-picker-chrome";
import { RF_NO_DRAG } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";

export function LibtvDockLanguageSegment({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const val = value === "English" ? "English" : "Chinese";
  return (
    <div className={cn("border-t border-white/10 px-2 pt-2.5", className)}>
      <p className="mb-1.5 text-[12px] text-white/50">语种</p>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="语种">
        {[
          { id: "Chinese", label: "中文" },
          { id: "English", label: "English" },
        ].map((opt) => {
          const active = val === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              className={libtvDockSegmentButtonClass(active, { compact: true })}
              onClick={() => onChange(opt.id)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function bindAudioPlaybackState(
  el: HTMLAudioElement,
  onChange: (playing: boolean) => void,
): () => void {
  const sync = () => onChange(!el.paused && !el.ended);
  el.addEventListener("play", sync);
  el.addEventListener("pause", sync);
  el.addEventListener("ended", sync);
  return () => {
    el.removeEventListener("play", sync);
    el.removeEventListener("pause", sync);
    el.removeEventListener("ended", sync);
  };
}

export function LibtvVoicePreviewButton({
  previewUrl,
  voiceId,
  voiceLanguage,
  sampleText,
  minimaxOssFallback = false,
  mode = "oss",
  previewContext,
  onSynthPlayed,
}: {
  previewUrl?: string;
  voiceId?: string;
  /** MiniMax 目录 language 字段 · 决定系统音色样音语种 */
  voiceLanguage?: string;
  /** 该行自己的样音文案（克隆 prompt）；有则合成时不用统一试听句 */
  sampleText?: string;
  /** 仅 MiniMax 系统音色目录为 true；Qwen 等须 false */
  minimaxOssFallback?: boolean;
  /** oss=各音色 catalog/OSS 样音；synth=该行 voiceId + 当前参数实时合成 */
  mode?: "oss" | "synth";
  previewContext?: LibtvTtsPreviewContext;
  /** 调参合成成功后回传（写入参数区下的已试听列表） */
  onSynthPlayed?: (info: { voiceId: string; dataUrl: string }) => void;
}) {
  const base = useBookMallBaseUrl();
  const sessionId = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewContextRef = useRef(previewContext);
  previewContextRef.current = previewContext;
  const voiceIdRef = useRef(voiceId);
  voiceIdRef.current = voiceId;
  const sampleTextRef = useRef(sampleText);
  sampleTextRef.current = sampleText;
  const onSynthPlayedRef = useRef(onSynthPlayed);
  onSynthPlayedRef.current = onSynthPlayed;
  const lastPlayedUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const useSynth = mode === "synth";

  const staticUrl = useMemo(
    () =>
      useSynth
        ? undefined
        : resolveLibtvVoicePreviewUrl({
            previewUrl,
            voiceId,
            minimaxOssFallback,
          }),
    [useSynth, previewUrl, voiceId, minimaxOssFallback],
  );

  const canPreview = useSynth
    ? Boolean(base && voiceId?.trim() && previewContext?.modelKey?.trim())
    : Boolean(staticUrl);

  const stopLocal = useCallback(() => {
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.pause();
      fallbackAudioRef.current.currentTime = 0;
      fallbackAudioRef.current = null;
    }
    setPlaying(false);
    setLoading(false);
  }, []);

  useEffect(
    () =>
      subscribeLibtvVoicePreviewStop((exceptSessionId) => {
        if (exceptSessionId && exceptSessionId === sessionId) return;
        stopLocal();
      }),
    [sessionId, stopLocal],
  );

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    return bindAudioPlaybackState(el, setPlaying);
  }, [staticUrl, useSynth]);

  const playUrl = useCallback(
    (url: string) => {
      stopAllLibtvVoicePreviews(sessionId);
      lastPlayedUrlRef.current = url;
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.src = url;
        el.load();
        el.currentTime = 0;
        void el.play().catch(() => {
          fallbackAudioRef.current = playLibtvVoicePreview(url, {
            exceptSessionId: sessionId,
          });
          if (fallbackAudioRef.current) {
            bindAudioPlaybackState(fallbackAudioRef.current, setPlaying);
          }
        });
        return;
      }
      fallbackAudioRef.current = playLibtvVoicePreview(url, {
        exceptSessionId: sessionId,
      });
      if (fallbackAudioRef.current) {
        bindAudioPlaybackState(fallbackAudioRef.current, setPlaying);
      }
    },
    [sessionId],
  );

  const startPreview = useCallback(() => {
    if (!canPreview) return;

    stopAllLibtvVoicePreviews(sessionId);

    if (!useSynth) {
      if (staticUrl) playUrl(staticUrl);
      return;
    }

    const liveContext = previewContextRef.current;
    const rowVoiceId = voiceIdRef.current?.trim() ?? "";
    if (!base || !liveContext?.modelKey?.trim() || !rowVoiceId) return;
    if (rowVoiceId.startsWith("unknown-")) {
      showCanvasErrorToast("该克隆音色缺少 voice_id，无法调参试听");
      return;
    }

    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setLoading(true);

    const previewParams = pickLibtvTtsPreviewParams(liveContext.params ?? {});
    const text = resolveLibtvRowPreviewText({
      sampleText: sampleTextRef.current,
      voiceLanguage,
      modelKey: liveContext.modelKey,
      params: liveContext.params,
    });

    void fetchLibtvTtsPreviewDataUrl({
      base,
      modelKey: liveContext.modelKey,
      voiceId: rowVoiceId,
      params: previewParams,
      projectId: liveContext.projectId,
      text,
      signal: controller.signal,
      skipCache: true,
      billable: true,
    })
      .then(({ dataUrl, creditsCharged }) => {
        if (controller.signal.aborted) return;
        dispatchPlatformCreditsBalanceRefresh();
        if (creditsCharged != null && creditsCharged > 0) {
          showCanvasCreditsToast(`试听消耗 ${creditsCharged} 积分`);
        }
        playUrl(dataUrl);
        onSynthPlayedRef.current?.({ voiceId: rowVoiceId, dataUrl });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "试听失败";
        showCanvasErrorToast(message);
      })
      .finally(() => {
        if (fetchAbortRef.current === controller) {
          fetchAbortRef.current = null;
        }
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, [
    base,
    canPreview,
    playUrl,
    sessionId,
    staticUrl,
    useSynth,
    voiceLanguage,
  ]);

  if (!canPreview && !loading && !playing) {
    return (
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/25"
        title="暂无试听"
      >
        <Volume2 className="size-3.5" aria-hidden />
      </span>
    );
  }

  const showStop = playing || loading;
  const title = showStop
    ? "停止试听"
    : useSynth
      ? "按当前参数试听（扣积分）"
      : "试听";

  return (
    <>
      {staticUrl ? (
        /* eslint-disable-next-line jsx-a11y/media-has-caption */
        <audio ref={audioRef} preload="metadata" src={staticUrl} className="hidden" />
      ) : (
        /* eslint-disable-next-line jsx-a11y/media-has-caption */
        <audio ref={audioRef} preload="metadata" className="hidden" />
      )}
      <button
        type="button"
        data-libtv-voice-preview-session={sessionId}
        className={cn(
          RF_NO_DRAG,
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/55 hover:bg-white/[0.08] hover:text-white",
          showStop && "text-white/85",
        )}
        title={title}
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (showStop) {
            stopLocal();
            stopAllLibtvVoicePreviews();
            return;
          }
          startPreview();
        }}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : playing ? (
          <Square className="size-3 fill-current" aria-hidden />
        ) : (
          <Volume2 className="size-3.5" aria-hidden />
        )}
      </button>
    </>
  );
}
