"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveQrSelectedVoiceDisplay } from "@/lib/qr-audio-voice-selection";
import { useQrAudioCatalog } from "@/lib/qr-audio-catalog-client";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";

const OSC_BAR_COUNT = 88;

function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bch = Math.round(ab + (bb - ab) * u);
  return `rgb(${r}, ${g}, ${bch})`;
}

function oscilloscopeBarColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.42) return mixHex("#22d3ee", "#818cf8", x / 0.42);
  if (x < 0.72) return mixHex("#818cf8", "#c084fc", (x - 0.42) / 0.3);
  return mixHex("#c084fc", "#2dd4bf", (x - 0.72) / 0.28);
}

function buildOscilloscopeHeightsPx(count: number, maxPx: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(1, count - 1);
    const wave =
      Math.abs(Math.sin(t * Math.PI * 7 + 0.15)) * 0.62 +
      Math.abs(Math.sin(t * Math.PI * 15 + 0.9)) * 0.42 +
      Math.abs(Math.sin(t * Math.PI * 28 + 1.6)) * 0.28 +
      Math.abs(Math.sin(i * 0.73 + 2.2)) * 0.18;
    return Math.round(8 + wave * (maxPx - 8));
  });
}

/** 横向对称示波器波形 · 青 → 紫 → 青绿 */
export function HorizontalOscilloscopeWaveform({
  active = false,
  bare = false,
  barCount = OSC_BAR_COUNT,
  maxAmplitudePx = 72,
  barWidthPx = 3,
  gapPx = 2,
  className = "",
}: {
  active?: boolean;
  bare?: boolean;
  barCount?: number;
  maxAmplitudePx?: number;
  barWidthPx?: number;
  gapPx?: number;
  className?: string;
}) {
  const heightsPx = useMemo(
    () => buildOscilloscopeHeightsPx(barCount, maxAmplitudePx),
    [barCount, maxAmplitudePx],
  );

  return (
    <div
      className={`qr-audio-oscilloscope-track relative min-w-0 flex-1 overflow-hidden ${
        bare ? "qr-audio-oscilloscope-bare" : "rounded-lg"
      } ${className}`}
    >
      <div className="qr-audio-oscilloscope-grid pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="relative flex h-full w-full items-center justify-center px-0.5"
        style={{ gap: `${gapPx}px` }}
      >
        {heightsPx.map((hPx, i) => {
          const t = i / Math.max(1, heightsPx.length - 1);
          return (
            <span
              key={i}
              className={`qr-audio-oscilloscope-line shrink-0 ${
                active
                  ? bare
                    ? "qr-audio-oscilloscope-line-generating"
                    : "qr-audio-oscilloscope-line-active"
                  : ""
              }`}
              style={{
                width: `${barWidthPx}px`,
                height: `${hPx}px`,
                backgroundColor: oscilloscopeBarColor(t),
                animationDelay: active ? `${(i % 24) * 0.038}s` : undefined,
                opacity: active ? undefined : 0.42,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** 左侧 logo 实心底 + 右侧长条波形（生成 / 播放共用） */
function AudioWaveStrip({
  leading,
  children,
  borderless = false,
  scanning = false,
}: {
  leading: React.ReactNode;
  children: React.ReactNode;
  borderless?: boolean;
  scanning?: boolean;
}) {
  return (
    <div
      className={`qr-audio-wave-strip relative flex w-full items-stretch overflow-hidden rounded-2xl ${
        borderless ? "" : "border"
      }`}
      style={borderless ? undefined : { borderColor: "var(--qr-border)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f18] via-[#0d1117] to-[#0a1210]" />
      {scanning ? <div className="qr-audio-track-scan pointer-events-none absolute inset-0" /> : null}
      <div className="qr-audio-wave-strip-leading relative z-10 flex shrink-0 items-center px-4 py-3">
        {leading}
      </div>
      <div className="relative z-0 flex min-w-0 flex-1 items-center py-3 pr-4">{children}</div>
    </div>
  );
}

function VoiceAvatar({
  letter,
  pulse = false,
  size = "md",
}: {
  letter: string;
  pulse?: boolean;
  size?: "md" | "sm";
}) {
  const dim = size === "sm" ? "h-11 w-11 text-base" : "h-14 w-14 text-xl";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500 font-semibold text-white shadow-md shadow-violet-500/20 ${dim} ${
        pulse ? "qr-audio-avatar-pulse" : ""
      }`}
    >
      {letter}
    </span>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function AudioTrackPlayer({
  outputUrl,
  voiceLetter,
  voiceLabel,
  voiceSubtitle,
}: {
  outputUrl: string;
  voiceLetter: string;
  voiceLabel: string;
  voiceSubtitle: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setProgress(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, [outputUrl]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="space-y-2">
      <AudioWaveStrip
        borderless
        scanning={playing}
        leading={
          <>
            <button
              type="button"
              onClick={toggle}
              className="qr-audio-wave-control-fill flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition hover:brightness-110"
              aria-label={playing ? "暂停" : "播放"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <VoiceAvatar letter={voiceLetter} size="sm" pulse={playing} />
          </>
        }
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="qr-audio-wave-meta-fill flex items-center justify-between gap-2 rounded-md px-2 py-0.5">
            <p className="truncate text-sm font-medium text-[var(--qr-text-primary)]">
              {voiceLabel}
            </p>
            <span className="shrink-0 text-[10px] tabular-nums text-[var(--qr-text-muted)]">
              {formatTime(progress)} / {formatTime(duration)}
            </span>
          </div>
          <HorizontalOscilloscopeWaveform
            active={playing}
            bare
            barCount={128}
            maxAmplitudePx={44}
            barWidthPx={2}
            gapPx={1}
            className="h-12 w-full"
          />
          <p className="qr-audio-wave-meta-fill truncate rounded-md px-2 py-0.5 text-[11px] text-[var(--qr-text-muted)]">
            {voiceSubtitle}
          </p>
        </div>
        <audio ref={audioRef} src={outputUrl} preload="metadata" className="hidden" />
      </AudioWaveStrip>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-teal-400 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function QrAudioGenerateGenerating({ draft }: { draft: QrWorkspaceDraft }) {
  const { catalog } = useQrAudioCatalog();
  const letter = useMemo(() => {
    if (draft.kind === "create-music") return "♫";
    if (!catalog) return "♪";
    return resolveQrSelectedVoiceDisplay(catalog, draft.voiceId).avatarLetter;
  }, [catalog, draft.voiceId, draft.kind]);

  return (
    <AudioWaveStrip
      borderless
      scanning
      leading={<VoiceAvatar letter={letter} pulse size="md" />}
    >
      <HorizontalOscilloscopeWaveform
        active
        bare
        barCount={148}
        maxAmplitudePx={46}
        barWidthPx={2}
        gapPx={1}
        className="h-12 w-full"
      />
    </AudioWaveStrip>
  );
}

export function QrAudioGenerateSuccess({
  draft,
  outputUrl,
}: {
  draft: QrWorkspaceDraft;
  outputUrl: string;
}) {
  const { catalog } = useQrAudioCatalog();
  const voice = useMemo(() => {
    if (draft.kind === "create-music") {
      return {
        avatarLetter: "♫",
        label: draft.modelKey || "音乐",
        subtitle: "MiniMax Music",
      };
    }
    if (!catalog) {
      return {
        avatarLetter: "♪",
        label: draft.voiceId ?? "音色",
        subtitle: "",
      };
    }
    const v = resolveQrSelectedVoiceDisplay(catalog, draft.voiceId);
    return {
      avatarLetter: v.avatarLetter,
      label: v.label,
      subtitle: v.subtitle,
    };
  }, [catalog, draft.voiceId, draft.kind, draft.modelKey]);

  const promptLabel =
    draft.kind === "voice-changer"
      ? "变声说明"
      : draft.kind === "create-music"
        ? "音乐描述 / 歌词"
        : "Prompt";

  const promptText = draft.prompt.trim();

  return (
    <div className="flex flex-col gap-3">
      <AudioTrackPlayer
        outputUrl={outputUrl}
        voiceLetter={voice.avatarLetter}
        voiceLabel={voice.label}
        voiceSubtitle={voice.subtitle}
      />

      <section
        className="rounded-2xl border px-4 py-3"
        style={{ borderColor: "var(--qr-border)", background: "var(--qr-bg-elevated)" }}
      >
        <h3 className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--qr-text-muted)]">
          {promptLabel}
        </h3>
        {promptText ? (
          <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[var(--qr-text-primary)]">
            {promptText}
          </p>
        ) : draft.kind === "voice-changer" ? (
          <p className="text-sm text-[var(--qr-text-secondary)]">
            已将源音频转换为目标音色「{voice.label}」
          </p>
        ) : (
          <p className="text-sm text-[var(--qr-text-muted)]">（无文本）</p>
        )}
      </section>
    </div>
  );
}
