"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { resolveQrSelectedVoiceDisplay } from "@/lib/qr-audio-voice-selection";
import { useQrAudioCatalog } from "@/lib/qr-audio-catalog-client";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";

const TRACK_BAR_HEIGHTS = [
  35, 55, 42, 68, 48, 72, 38, 64, 52, 78, 44, 70, 36, 60, 50, 74, 40, 66, 46, 58, 34, 62, 48,
  56, 42, 68, 38, 52, 44, 60,
];

function buildWavePath(width: number, height: number, amplitude: number, cycles: number, phase = 0): string {
  const mid = height / 2;
  const steps = 64;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = mid + amplitude * Math.sin((i / steps) * Math.PI * 2 * cycles + phase);
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ");
}

function WaveBandTile({ gradId, tileW, tileH }: { gradId: string; tileW: number; tileH: number }) {
  const primary = buildWavePath(tileW, tileH, 14, 3, 0);
  const secondary = buildWavePath(tileW, tileH, 9, 5, Math.PI / 3);
  const tertiary = buildWavePath(tileW, tileH, 6, 7, Math.PI / 2);

  return (
    <svg
      className="h-full shrink-0"
      style={{ width: tileW }}
      viewBox={`0 0 ${tileW} ${tileH}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--qr-brand)" stopOpacity="0.15" />
          <stop offset="35%" stopColor="#c084fc" stopOpacity="0.85" />
          <stop offset="65%" stopColor="var(--qr-brand)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path
        d={tertiary}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        strokeOpacity="0.35"
        className="qr-audio-wave-band-path-alt"
      />
      <path
        d={secondary}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        strokeOpacity="0.55"
        className="qr-audio-wave-band-path"
      />
      <path
        d={primary}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2.5"
        className="qr-audio-wave-band-path"
      />
    </svg>
  );
}

function GeneratingWaveBand() {
  const uid = useId();
  const tileW = 480;
  const tileH = 56;

  return (
    <div className="relative h-14 min-w-0 flex-1 overflow-hidden rounded-lg">
      <div className="qr-audio-wave-band-scroll absolute inset-y-0 left-0">
        <WaveBandTile gradId={`${uid}-a`} tileW={tileW} tileH={tileH} />
        <WaveBandTile gradId={`${uid}-b`} tileW={tileW} tileH={tileH} />
      </div>
    </div>
  );
}

function TrackWaveform({ active, barCount = 30 }: { active: boolean; barCount?: number }) {
  const heights = TRACK_BAR_HEIGHTS.slice(0, barCount);
  return (
    <div className="flex h-12 min-w-0 flex-1 items-end gap-[3px] px-1">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] shrink-0 rounded-full bg-gradient-to-t from-[var(--qr-brand)] to-violet-400 ${
            active ? "qr-audio-wave-bar" : "opacity-35"
          }`}
          style={{
            height: `${h}%`,
            animationDelay: active ? `${(i % 12) * 0.06}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function AudioTrackShell({
  children,
  scanning = false,
  borderless = false,
}: {
  children: React.ReactNode;
  scanning?: boolean;
  borderless?: boolean;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ${borderless ? "" : "border"}`}
      style={
        borderless
          ? undefined
          : { borderColor: "var(--qr-border)", background: "var(--qr-bg-elevated)" }
      }
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#1a1030]/80 via-[#121826] to-[#0d1117]" />
      {scanning ? <div className="qr-audio-track-scan pointer-events-none absolute inset-0" /> : null}
      <div className="relative flex min-h-[96px] items-center gap-4 px-5 py-3">{children}</div>
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
      <AudioTrackShell scanning={playing}>
        <button
          type="button"
          onClick={toggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white transition hover:bg-black/55"
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <VoiceAvatar letter={voiceLetter} size="sm" pulse={playing} />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-[var(--qr-text-primary)]">
              {voiceLabel}
            </p>
            <span className="shrink-0 text-[10px] tabular-nums text-[var(--qr-text-muted)]">
              {formatTime(progress)} / {formatTime(duration)}
            </span>
          </div>
          <TrackWaveform active={playing} barCount={28} />
          <p className="truncate text-[11px] text-[var(--qr-text-muted)]">{voiceSubtitle}</p>
        </div>
        <audio ref={audioRef} src={outputUrl} preload="metadata" className="hidden" />
      </AudioTrackShell>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--qr-brand)] to-violet-400 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function QrAudioGenerateGenerating({ draft }: { draft: QrWorkspaceDraft }) {
  const { catalog } = useQrAudioCatalog();
  const voice = useMemo(() => {
    if (!catalog) {
      return { avatarLetter: "♪", label: "音色生成", subtitle: "MiniMax" };
    }
    const v = resolveQrSelectedVoiceDisplay(catalog, draft.voiceId);
    return {
      avatarLetter: v.avatarLetter,
      label: v.label,
      subtitle: v.subtitle,
    };
  }, [catalog, draft.voiceId]);

  const hint =
    draft.kind === "voice-changer"
      ? "变声中 · 10～30 秒"
      : draft.kind === "create-music"
        ? "作曲中 · 30～90 秒"
        : "旁白合成 · 10～30 秒";

  return (
    <AudioTrackShell scanning borderless>
      <VoiceAvatar letter={voice.avatarLetter} pulse />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--qr-text-primary)]">音色生成中…</p>
          <span className="shrink-0 text-[10px] text-[var(--qr-brand)]">{hint}</span>
        </div>
        <GeneratingWaveBand />
        <p className="truncate text-xs text-[var(--qr-text-secondary)]">
          {voice.label}
          {voice.subtitle ? ` · ${voice.subtitle}` : ""}
        </p>
      </div>
    </AudioTrackShell>
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
  }, [catalog, draft.voiceId]);

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
