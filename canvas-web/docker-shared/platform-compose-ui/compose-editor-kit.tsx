"use client";

import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Maximize2,
  Minus,
  Pause,
  Play,
  Loader2,
  Plus,
  SplitSquareHorizontal,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SyntheticEvent,
} from "react";

import { useComposeDialogs } from "./compose-dialogs";
import { DEFAULT_COMPOSE_PROFILE } from "./default-compose-profile";
import {
  COMPOSE_MIN_CLIP_SEC,
  composeClipSourceEnd,
  composeClipSourceStart,
  moveComposeClip,
  orderedComposeClips,
  removeComposeClip,
  setComposeClipSourceRangeWithRipple,
  splitComposeClipAtSourceSec,
  updateComposeClip,
} from "./editing";
import { useComposeAudioPeaksLoader } from "./compose-audio-peaks";
import { ComposeSegmentAudioWaveform } from "./compose-audio-waveform";
import {
  isAudioOnlyLibraryClip,
  libraryClipVisualUrl,
} from "./compose-library-asset";
import { useFetchVideoFilmstrip } from "./filmstrip-context";
import { cn } from "./cn";
import { ComposeRenderProfilePanel } from "./compose-render-profile-panel";
import type {
  ComposeRenderProfile,
  ComposeTrackChrome,
  ComposeWorkbenchClip,
  ComposeWorkbenchState,
  VideoFilmstripFrame,
} from "./types";

function formatTimeSec(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** 全屏剪辑台 · 左栏第二 Tab（按子应用/项目类型，后续接资产 API） */
function resolveComposeProjectAssetLibraryLabel(module: string): string {
  const m = module.trim().toLowerCase();
  if (m.includes("canvas") || m.startsWith("story")) return "画布资产";
  return "电商资产";
}

const FILMSTRIP_THUMB_PX = 72;
const MIN_TRIM_SEC = 0.25;
/** 成片轨道：每秒占用的像素宽度基准（与刻度尺、块宽一致） */
const BASE_TIMELINE_PX_PER_SEC = 36;
const TIMELINE_ZOOM_MIN = 0.55;
const TIMELINE_ZOOM_MAX = 2.4;
/** 迷你浮窗拖动时忽略这些区域（时间线、按钮等） */
const COMPOSE_PANEL_DRAG_BLOCK =
  "button, input, select, textarea, a, [data-compose-sequence-track], [data-compose-trim-handle]";
/** 迷你时间线浮窗：宽度为视口 2/3，默认底边距视口底部 1/3 高 */
const MINI_COMPOSE_PANEL_WIDTH_CLASS = "w-[66.666vw] max-w-[66.666vw] min-w-0";
/** 全屏剪辑台：即梦式块布局（gap + 圆角 surface，底栏独立 workspace 块） */
const COMPOSE_FS_WORKSPACE_INSET = "px-3 pb-3 pt-3";
const COMPOSE_FS_BLOCK_GAP = "gap-3";
const COMPOSE_FS_SURFACE =
  "overflow-hidden rounded-xl bg-[#161616] text-white";
const COMPOSE_FS_LEFT_W = "w-[360px] shrink-0 max-lg:w-[300px]";
const COMPOSE_FS_RIGHT_W = "w-[360px] shrink-0 max-lg:w-[300px]";
/** 底栏 workspace 固定高度（约 1 轨 + 预留空轨 + 工具条），仅横向滚动 */
const COMPOSE_FS_TIMELINE_WORKSPACE_CLASS =
  "flex h-[220px] max-h-[240px] min-h-[200px] shrink-0 flex-col overflow-hidden";
const COMPOSE_FS_SCROLL_HIDE =
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-y-hidden";

function cloneWorkbenchState(s: ComposeWorkbenchState): ComposeWorkbenchState {
  return structuredClone(s);
}

export function useComposeFilmstripLoader(
  projectId: string,
  clips: ComposeWorkbenchClip[],
  active: boolean,
) {
  const fetchFilmstrip = useFetchVideoFilmstrip();
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const urls = [...new Set(clips.map((c) => c.videoUrl.trim()).filter(Boolean))];
    if (urls.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all(
      urls.map((url) => loadComposeFilmstripCached(fetchFilmstrip, projectId, url).catch(() => undefined)),
    ).finally(() => {
      if (!cancelled) {
        setLoading(false);
        setTick((n) => n + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active, clips, projectId]);

  const { filmstripByUrl, fullDurationByUrl } = useMemo(() => {
    const filmstripByUrl: Record<string, VideoFilmstripFrame[]> = {};
    const fullDurationByUrl: Record<string, number> = {};
    for (const c of clips) {
      const u = c.videoUrl.trim();
      if (!u || filmstripByUrl[u]) continue;
      const hit = composeFilmstripCache.get(filmstripCacheKey(projectId, u));
      if (hit) {
        filmstripByUrl[u] = hit.frames;
        fullDurationByUrl[u] = hit.durationSec;
      }
    }
    return { filmstripByUrl, fullDurationByUrl };
  }, [clips, projectId, tick]);

  return { loading, filmstripByUrl, fullDurationByUrl, stripTick: tick };
}

type FilmstripCacheEntry = { durationSec: number; frames: VideoFilmstripFrame[] };
const composeFilmstripCache = new Map<string, FilmstripCacheEntry>();

function filmstripCacheKey(projectId: string, videoUrl: string): string {
  return `${projectId}::${videoUrl}`;
}

async function loadComposeFilmstripCached(
  fetchFilmstrip: ReturnType<typeof useFetchVideoFilmstrip>,
  projectId: string,
  videoUrl: string,
): Promise<FilmstripCacheEntry> {
  const key = filmstripCacheKey(projectId, videoUrl);
  const hit = composeFilmstripCache.get(key);
  if (hit) return hit;
  const r = await fetchFilmstrip({
    sourceVideoUrl: videoUrl,
    projectId,
    frameCount: 24,
  });
  const entry: FilmstripCacheEntry = {
    durationSec: Math.max(0.5, r.durationSec),
    frames: r.frames,
  };
  composeFilmstripCache.set(key, entry);
  return entry;
}

function secFromPointerOnStrip(
  clientX: number,
  stripRef: React.RefObject<HTMLDivElement | null>,
  stripScrollRef: React.RefObject<HTMLDivElement | null>,
  rangeStart: number,
  rangeEnd: number,
): number {
  const el = stripRef.current;
  const span = rangeEnd - rangeStart;
  if (!el || span <= 0) return rangeStart;
  const scrollLeft = stripScrollRef.current?.scrollLeft ?? 0;
  const rect = el.getBoundingClientRect();
  const xOnTrack = clientX - rect.left + scrollLeft;
  const ratio = Math.min(1, Math.max(0, xOnTrack / el.offsetWidth));
  return rangeStart + ratio * span;
}

function FilmstripPlayheadHandle({
  pct,
  stripRef,
  stripScrollRef,
  rangeStart,
  rangeEnd,
  onSec,
}: {
  pct: number;
  stripRef: React.RefObject<HTMLDivElement | null>;
  stripScrollRef: React.RefObject<HTMLDivElement | null>;
  rangeStart: number;
  rangeEnd: number;
  onSec: (sec: number) => void;
}) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      onSec(secFromPointerOnStrip(ev.clientX, stripRef, stripScrollRef, rangeStart, rangeEnd));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="absolute top-0 z-20 flex h-full w-4 -translate-x-1/2 cursor-ew-resize flex-col items-center"
      style={{ left: `${pct}%` }}
      onPointerDown={onPointerDown}
      title="拖动预览当前帧"
    >
      <div className="mt-0.5 size-2 rotate-45 border border-yellow-200 bg-yellow-300 shadow-sm" />
      <div className="min-h-0 w-0.5 flex-1 bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.85)]" />
    </div>
  );
}

function FilmstripTrimHandle({
  side,
  pct,
  stripRef,
  stripScrollRef,
  rangeStart,
  rangeEnd,
  fullDurationSec,
  other,
  onSec,
  onDragEnd,
}: {
  side: "start" | "end";
  pct: number;
  stripRef: React.RefObject<HTMLDivElement | null>;
  stripScrollRef: React.RefObject<HTMLDivElement | null>;
  rangeStart: number;
  rangeEnd: number;
  fullDurationSec: number;
  other: number;
  onSec: (sec: number) => void;
  onDragEnd?: () => void;
}) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      let sec = secFromPointerOnStrip(ev.clientX, stripRef, stripScrollRef, rangeStart, rangeEnd);
      if (side === "start") {
        sec = Math.min(sec, other - MIN_TRIM_SEC);
        sec = Math.max(0, sec);
      } else {
        sec = Math.max(sec, other + MIN_TRIM_SEC);
        sec = Math.min(fullDurationSec, sec);
      }
      onSec(sec);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onDragEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="absolute top-0 z-10 flex h-full w-6 -translate-x-1/2 cursor-ew-resize flex-col items-center justify-center"
      style={{ left: `${pct}%` }}
      onPointerDown={onPointerDown}
      title={side === "start" ? "拖动调整入点" : "拖动调整出点"}
    >
      <span className="mb-0.5 rounded bg-violet-500 px-1 py-px text-[9px] font-medium leading-none text-white shadow">
        {side === "start" ? "入" : "出"}
      </span>
      <div className="min-h-0 w-1.5 flex-1 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.75)]" />
    </div>
  );
}

function ComposeClipFilmstripTimeline({
  clipLabel,
  frames,
  fullDurationSec,
  loading,
  error,
  trimStart,
  trimEnd,
  playheadSec,
  onTrimStart,
  onTrimEnd,
  onPlayheadSec,
  onTrimDragEnd,
}: {
  clipLabel?: string;
  frames: VideoFilmstripFrame[];
  fullDurationSec: number;
  loading: boolean;
  error: string | null;
  trimStart: number;
  trimEnd: number;
  playheadSec: number;
  onTrimStart: (sec: number) => void;
  onTrimEnd: (sec: number) => void;
  onPlayheadSec: (sec: number) => void;
  onTrimDragEnd?: () => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const stripScrollRef = useRef<HTMLDivElement | null>(null);

  const spanSec = Math.max(MIN_TRIM_SEC, trimEnd - trimStart);
  const visibleFrames = useMemo(() => {
    const inRange = frames.filter(
      (f) => f.atSec >= trimStart - 0.05 && f.atSec <= trimEnd + 0.05,
    );
    return inRange.length >= 2 ? inRange : frames;
  }, [frames, trimStart, trimEnd]);

  const stripTrackWidthPx = Math.max(
    visibleFrames.length * FILMSTRIP_THUMB_PX,
    FILMSTRIP_THUMB_PX * 4,
  );

  const playheadPct =
    spanSec > 0 ? ((playheadSec - trimStart) / spanSec) * 100 : 0;
  const trimStartPct = 0;
  const trimEndPct = 100;

  const tickStep = spanSec <= 8 ? 0.5 : spanSec <= 20 ? 1 : 2;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= spanSec + 0.001; t += tickStep) out.push(t);
    return out;
  }, [spanSec, tickStep]);

  const seekFromClientX = (clientX: number) => {
    onPlayheadSec(
      secFromPointerOnStrip(clientX, stripRef, stripScrollRef, trimStart, trimEnd),
    );
  };

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/40 text-xs text-white/45">
        <Loader2 className="size-4 animate-spin" />
        正在按帧生成时间轴缩略图…
      </div>
    );
  }
  if (error) {
    return (
      <p className="rounded-lg border border-red-400/30 bg-red-950/30 px-3 py-2 text-xs text-red-200/90">
        {error}
      </p>
    );
  }
  if (!frames.length) {
    return (
      <p className="text-[11px] text-white/40">暂无胶片条，请选择有效视频片段。</p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10px] text-white/45">
        <span className="truncate">
          当前段{clipLabel ? ` · ${clipLabel}` : ""} · 拖左右紫边（可向外加长）
        </span>
        <span className="shrink-0 tabular-nums">
          {formatTimeSec(playheadSec)} / 源 {formatTimeSec(trimStart)}–{formatTimeSec(trimEnd)}（
          {formatTimeSec(spanSec)}）
        </span>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/40">
        <div
          ref={stripScrollRef}
          className="overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20"
        >
          <div className="relative h-4 shrink-0 border-b border-white/5" style={{ width: stripTrackWidthPx }}>
            {ticks.map((t) => {
              const leftPct = spanSec > 0 ? (t / spanSec) * 100 : 0;
              return (
                <span
                  key={t}
                  className="absolute top-0.5 -translate-x-1/2 tabular-nums text-[9px] text-white/35"
                  style={{ left: `${leftPct}%` }}
                >
                  {formatTimeSec(trimStart + t)}
                </span>
              );
            })}
          </div>
          <div
            ref={stripRef}
            className="relative h-[4.5rem] shrink-0 cursor-crosshair"
            style={{ width: stripTrackWidthPx }}
            onClick={(e) => seekFromClientX(e.clientX)}
          >
            <div className="flex h-full ring-2 ring-inset ring-violet-400/35">
              {visibleFrames.map((f, i) => (
                <button
                  key={`${f.atSec}-${i}`}
                  type="button"
                  className="h-full shrink-0 overflow-hidden border-r border-white/5 p-0 last:border-r-0 hover:ring-1 hover:ring-inset hover:ring-[#0071e3]/50"
                  style={{ width: FILMSTRIP_THUMB_PX }}
                  title={formatTimeSec(f.atSec)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayheadSec(
                      Math.min(trimEnd, Math.max(trimStart, f.atSec)),
                    );
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
            <FilmstripTrimHandle
              side="start"
              pct={trimStartPct}
              stripRef={stripRef}
              stripScrollRef={stripScrollRef}
              rangeStart={trimStart}
              rangeEnd={trimEnd}
              fullDurationSec={fullDurationSec}
              other={trimEnd}
              onSec={onTrimStart}
              onDragEnd={onTrimDragEnd}
            />
            <FilmstripTrimHandle
              side="end"
              pct={trimEndPct}
              stripRef={stripRef}
              stripScrollRef={stripScrollRef}
              rangeStart={trimStart}
              rangeEnd={trimEnd}
              fullDurationSec={fullDurationSec}
              other={trimStart}
              onSec={onTrimEnd}
              onDragEnd={onTrimDragEnd}
            />
            <FilmstripPlayheadHandle
              pct={playheadPct}
              stripRef={stripRef}
              stripScrollRef={stripScrollRef}
              rangeStart={trimStart}
              rangeEnd={trimEnd}
              onSec={onPlayheadSec}
            />
          </div>
        </div>
      </div>
      <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-white/45">
        <li>
          <span className="text-yellow-200/90">黄线</span>：定位到要分割或预览的时刻（类似剪映播放头）。
        </li>
        <li>
          点 <span className="text-white/70">分割</span>：切成独立两段，在下方轨道各有一块，可分别拖边。
        </li>
        <li>
          <span className="text-violet-300">左右紫边</span>：向内/向外拖，缩小或放大保留范围（中间亮区=保留）。
        </li>
        <li>下方轨道：白框=选中，拖左右白边裁切；工具栏分割/删除；最后点「导出」。</li>
      </ol>
    </div>
  );
}

function displayClipSpanSec(c: ComposeWorkbenchClip): number {
  if (c.durationSec != null && c.durationSec > 0) return c.durationSec;
  if (c.sourceEndSec != null) {
    return Math.max(COMPOSE_MIN_CLIP_SEC, c.sourceEndSec - (c.sourceStartSec ?? 0));
  }
  return 5;
}

function clipTrackWidthPx(c: ComposeWorkbenchClip, pxPerSec: number): number {
  return Math.max(56, displayClipSpanSec(c) * pxPerSec);
}

type ClipTrackLayoutSeg = {
  clip: ComposeWorkbenchClip;
  programStart: number;
  span: number;
  widthPx: number;
  leftPx: number;
};

function buildClipTrackLayout(
  clips: ComposeWorkbenchClip[],
  pxPerSec: number,
): { segments: ClipTrackLayoutSeg[]; totalPx: number; totalSec: number } {
  let accSec = 0;
  let accPx = 0;
  const segments: ClipTrackLayoutSeg[] = clips.map((clip) => {
    const span = displayClipSpanSec(clip);
    const widthPx = clipTrackWidthPx(clip, pxPerSec);
    const seg: ClipTrackLayoutSeg = {
      clip,
      programStart: accSec,
      span,
      widthPx,
      leftPx: accPx,
    };
    accSec += span;
    accPx += widthPx;
    return seg;
  });
  return { segments, totalPx: accPx, totalSec: accSec || 1 };
}

function programSecFromTrackPx(
  xInTrack: number,
  clips: ComposeWorkbenchClip[],
  pxPerSec: number,
): number {
  const { segments, totalPx, totalSec } = buildClipTrackLayout(clips, pxPerSec);
  if (totalPx <= 0 || totalSec <= 0) return 0;
  const x = Math.max(0, Math.min(xInTrack, totalPx));
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;
    if (x <= seg.leftPx + seg.widthPx || isLast) {
      const inner = Math.max(0, Math.min(x - seg.leftPx, seg.widthPx));
      const ratio = seg.widthPx > 0 ? inner / seg.widthPx : 0;
      return seg.programStart + ratio * seg.span;
    }
  }
  return totalSec;
}

function trackPxFromProgramSec(
  programSec: number,
  clips: ComposeWorkbenchClip[],
  pxPerSec: number,
): number {
  const { segments, totalSec, totalPx } = buildClipTrackLayout(clips, pxPerSec);
  if (totalSec <= 0) return 0;
  const sec = Math.max(0, Math.min(programSec, totalSec));
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;
    if (sec <= seg.programStart + seg.span || isLast) {
      const local = Math.max(0, Math.min(sec - seg.programStart, seg.span));
      const ratio = seg.span > 0 ? local / seg.span : 0;
      return seg.leftPx + ratio * seg.widthPx;
    }
  }
  return totalPx;
}

function buildProgramSegments(clips: ComposeWorkbenchClip[]) {
  let t = 0;
  return clips.map((clip) => {
    const span = displayClipSpanSec(clip);
    const seg = { clip, programStart: t, span };
    t += span;
    return seg;
  });
}

function resolveClipAtProgramSec(
  clips: ComposeWorkbenchClip[],
  programSec: number,
): {
  clip: ComposeWorkbenchClip;
  programStart: number;
  span: number;
  localInClip: number;
  sourceSec: number;
} | null {
  const segments = buildProgramSegments(clips);
  if (segments.length === 0) return null;
  const total = segments.reduce((s, x) => s + x.span, 0);
  const clamped = Math.max(0, Math.min(programSec, total));
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;
    if (clamped <= acc + seg.span || isLast) {
      const localInClip = Math.max(0, Math.min(clamped - acc, seg.span));
      const srcStart = composeClipSourceStart(seg.clip);
      return {
        clip: seg.clip,
        programStart: seg.programStart,
        span: seg.span,
        localInClip,
        sourceSec: srcStart + localInClip,
      };
    }
    acc += seg.span;
  }
  return null;
}

function isProgramPlayheadInSelectedClip(
  clips: ComposeWorkbenchClip[],
  selectedId: string | null,
  programPlayheadSec: number,
): boolean {
  if (!selectedId) return false;
  const hit = resolveClipAtProgramSec(clips, programPlayheadSec);
  if (!hit || hit.clip.id !== selectedId) return false;
  return (
    hit.localInClip >= COMPOSE_MIN_CLIP_SEC &&
    hit.localInClip <= hit.span - COMPOSE_MIN_CLIP_SEC
  );
}

function sourceSecAtProgramPlayheadInClip(
  clips: ComposeWorkbenchClip[],
  clipId: string,
  programPlayheadSec: number,
): number | null {
  const hit = resolveClipAtProgramSec(clips, programPlayheadSec);
  if (!hit || hit.clip.id !== clipId) return null;
  if (
    hit.localInClip < COMPOSE_MIN_CLIP_SEC ||
    hit.localInClip > hit.span - COMPOSE_MIN_CLIP_SEC
  ) {
    return null;
  }
  return composeClipSourceStart(hit.clip) + hit.localInClip;
}

function videoElementMatchesUrl(video: HTMLVideoElement, url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return video.currentSrc === u || video.src === u || video.src.includes(u);
}

function audioElementMatchesUrl(audio: HTMLAudioElement, url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  return audio.currentSrc === u || audio.src === u || audio.src.includes(u);
}

/** 迷你窗 / 全屏 · 按 program 时间线跨段连续预览（视频 + 段配音） */
function useComposeProgramVideoPlayback({
  ordered,
  videoRef,
  audioRef,
  playing,
  setPlaying,
  programPlayheadSec,
  setProgramPlayheadSec,
}: {
  ordered: ComposeWorkbenchClip[];
  videoRef: RefObject<HTMLVideoElement | null>;
  audioRef?: RefObject<HTMLAudioElement | null>;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  programPlayheadSec: number;
  setProgramPlayheadSec: React.Dispatch<React.SetStateAction<number>>;
}) {
  const programPlayheadSecRef = useRef(programPlayheadSec);
  programPlayheadSecRef.current = programPlayheadSec;

  const playbackHit = useMemo(
    () => resolveClipAtProgramSec(ordered, programPlayheadSec),
    [ordered, programPlayheadSec],
  );

  const playbackVideoUrl = playbackHit?.clip.videoUrl?.trim() ?? "";
  const playbackAudioUrl = playbackHit?.clip.audioUrl?.trim() ?? "";
  const lastSyncedClipIdRef = useRef<string | null>(null);
  const lastSyncedAudioClipIdRef = useRef<string | null>(null);
  const orderedKey = ordered.map((c) => c.id).join("|");

  useEffect(() => {
    const hit = resolveClipAtProgramSec(ordered, programPlayheadSecRef.current);
    if (hit?.clip.id) {
      lastSyncedClipIdRef.current = null;
    }
  }, [orderedKey, ordered]);

  useEffect(() => {
    if (!playing) {
      lastSyncedClipIdRef.current = null;
      lastSyncedAudioClipIdRef.current = null;
      audioRef?.current?.pause();
      return;
    }
    const v = videoRef.current;
    const hit = resolveClipAtProgramSec(ordered, programPlayheadSecRef.current);
    if (!v || !hit?.clip.videoUrl?.trim()) return;

    const clipId = hit.clip.id;
    const needsSwitch =
      lastSyncedClipIdRef.current !== clipId ||
      !videoElementMatchesUrl(v, hit.clip.videoUrl);

    const seekAndPlay = () => {
      const fresh = resolveClipAtProgramSec(ordered, programPlayheadSecRef.current);
      if (!fresh) return;
      if (Math.abs(v.currentTime - fresh.sourceSec) > 0.12) {
        try {
          v.currentTime = fresh.sourceSec;
        } catch {
          /* ignore seek while switching */
        }
      }
      void v.play().catch(() => undefined);
    };

    if (needsSwitch) {
      lastSyncedClipIdRef.current = clipId;
      v.src = hit.clip.videoUrl;
      const onReady = () => {
        seekAndPlay();
        v.removeEventListener("loadeddata", onReady);
      };
      v.addEventListener("loadeddata", onReady);
      v.load();
      return () => v.removeEventListener("loadeddata", onReady);
    }
    seekAndPlay();
  }, [playing, playbackHit?.clip.id, playbackVideoUrl, ordered, videoRef]);

  useEffect(() => {
    if (!playing || !audioRef) return;
    const a = audioRef.current;
    const hit = resolveClipAtProgramSec(ordered, programPlayheadSecRef.current);
    const audioUrl = hit?.clip.audioUrl?.trim();
    if (!a || !hit || !audioUrl) {
      a?.pause();
      return;
    }

    const clipId = hit.clip.id;
    const needsSwitch =
      lastSyncedAudioClipIdRef.current !== clipId ||
      !audioElementMatchesUrl(a, audioUrl);

    const seekAndPlayAudio = () => {
      const fresh = resolveClipAtProgramSec(ordered, programPlayheadSecRef.current);
      if (!fresh?.clip.audioUrl?.trim()) return;
      const target = Math.max(0, fresh.localInClip);
      if (Math.abs(a.currentTime - target) > 0.12) {
        try {
          a.currentTime = target;
        } catch {
          /* ignore */
        }
      }
      void a.play().catch(() => undefined);
    };

    if (needsSwitch) {
      lastSyncedAudioClipIdRef.current = clipId;
      a.src = audioUrl;
      const onReady = () => {
        seekAndPlayAudio();
        a.removeEventListener("canplay", onReady);
      };
      a.addEventListener("canplay", onReady);
      a.load();
      return () => a.removeEventListener("canplay", onReady);
    }
    seekAndPlayAudio();
  }, [playing, playbackHit?.clip.id, playbackAudioUrl, ordered, audioRef]);

  const onProgramVideoTimeUpdate = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
      if (!playing) return;
      const v = e.currentTarget;
      const hit = resolveClipAtProgramSec(ordered, programPlayheadSecRef.current);
      if (!hit) return;

      const srcStart = composeClipSourceStart(hit.clip);
      const local = v.currentTime - srcStart;
      const endProgram = hit.programStart + hit.span;

      if (local >= hit.span - 0.06) {
        const idx = ordered.findIndex((c) => c.id === hit.clip.id);
        if (idx >= 0 && idx < ordered.length - 1) {
          const nextProgram = hit.programStart + hit.span + 0.001;
          programPlayheadSecRef.current = nextProgram;
          setProgramPlayheadSec(nextProgram);
          lastSyncedClipIdRef.current = null;
          lastSyncedAudioClipIdRef.current = null;
          return;
        }
        programPlayheadSecRef.current = endProgram;
        setProgramPlayheadSec(endProgram);
        setPlaying(false);
        v.pause();
        audioRef?.current?.pause();
        return;
      }

      const a = audioRef?.current;
      if (a && hit.clip.audioUrl?.trim() && !a.paused) {
        const target = Math.max(0, local);
        if (Math.abs(a.currentTime - target) > 0.25) {
          try {
            a.currentTime = target;
          } catch {
            /* ignore */
          }
        }
      }

      const nextProgram = Math.min(hit.programStart + Math.max(0, local), endProgram);
      programPlayheadSecRef.current = nextProgram;
      setProgramPlayheadSec(nextProgram);
    },
    [ordered, playing, setPlaying, setProgramPlayheadSec, audioRef],
  );

  const toggleProgramPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      audioRef?.current?.pause();
      setPlaying(false);
      return;
    }
    setPlaying(true);
  }, [playing, setPlaying, videoRef, audioRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const hit = resolveClipAtProgramSec(ordered, programPlayheadSecRef.current);
    v.muted = Boolean(playing && hit?.clip.audioUrl?.trim());
  }, [playing, playbackHit?.clip.id, playbackAudioUrl, ordered, videoRef]);

  return {
    playbackVideoUrl,
    onProgramVideoTimeUpdate,
    toggleProgramPlay,
  };
}

function clipFilmstripFrames(
  clip: ComposeWorkbenchClip,
  frames: VideoFilmstripFrame[] | undefined,
  fullDur: number,
): VideoFilmstripFrame[] {
  if (!frames?.length) return [];
  const start = composeClipSourceStart(clip);
  const end = composeClipSourceEnd(clip, fullDur);
  const filtered = frames.filter(
    (f) => f.atSec >= start - 0.05 && f.atSec <= end + 0.05,
  );
  const list = filtered.length >= 1 ? filtered : frames;
  const maxTiles = 8;
  if (list.length <= maxTiles) return list;
  const step = list.length / maxTiles;
  const out: VideoFilmstripFrame[] = [];
  for (let i = 0; i < maxTiles; i++) {
    out.push(list[Math.min(list.length - 1, Math.floor(i * step))]!);
  }
  return out;
}

export function ComposeSequenceTrack({
  clips,
  selectedId,
  disabled,
  trimStart,
  trimEnd,
  filmstripByUrl,
  fullDurationByUrl,
  programPlayheadSec,
  totalProgramSec,
  onSelect,
  onReorder,
  onTrimStart,
  onTrimEnd,
  onTrimCommit,
  onSplit,
  onTrimLeft,
  onTrimRight,
  onDelete,
  onUndo,
  onProgramSeek,
  onImportClick,
  splitDisabled,
  trimDisabled,
  deleteDisabled,
  undoDisabled,
  zoomable,
  pxPerSec: pxPerSecBase,
  hideToolbar,
  clipLaneClassName = "h-[4.5rem]",
  filmstripThumbClassName = "w-8",
  portraitFilmstrip = false,
  playheadInsetInClipLane = false,
  /** 轨道下方预留一行空轨（全屏底栏，播放头可贯穿） */
  reserveExtraClipLane = false,
  reserveLaneClassName = "h-14",
  scrollContainerClassName,
  rootClassName,
  trackChrome,
  audioPeaksByUrl,
  onClipAudioAttach,
  onClipAudioClear,
}: {
  clips: ComposeWorkbenchClip[];
  selectedId: string | null;
  disabled?: boolean;
  trimStart: number;
  trimEnd: number;
  filmstripByUrl: Record<string, VideoFilmstripFrame[]>;
  fullDurationByUrl: Record<string, number>;
  programPlayheadSec: number;
  totalProgramSec: number;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onTrimStart: (sec: number) => void;
  onTrimEnd: (sec: number) => void;
  onTrimCommit: (start: number, end: number) => void;
  onSplit: () => void;
  onTrimLeft?: () => void;
  onTrimRight?: () => void;
  onDelete: () => void;
  onUndo?: () => void;
  onProgramSeek: (programSec: number) => void;
  onImportClick?: () => void;
  splitDisabled?: boolean;
  trimDisabled?: boolean;
  deleteDisabled?: boolean;
  undoDisabled?: boolean;
  zoomable?: boolean;
  pxPerSec?: number;
  hideToolbar?: boolean;
  /** 片段缩略图轨道高度（迷你窗可传更高） */
  clipLaneClassName?: string;
  filmstripThumbClassName?: string;
  /** 竖屏比例缩略图（迷你时间线，避免拉扁） */
  portraitFilmstrip?: boolean;
  /** 播放头只在片段轨道内且上下留白 */
  playheadInsetInClipLane?: boolean;
  reserveExtraClipLane?: boolean;
  reserveLaneClassName?: string;
  /** 轨道横向滚动容器（全屏底栏隐藏原生滚动条） */
  scrollContainerClassName?: string;
  rootClassName?: string;
  trackChrome?: ComposeTrackChrome;
  audioPeaksByUrl?: Record<string, number[]>;
  onClipAudioAttach?: (clipId: string) => void;
  onClipAudioClear?: (clipId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const variant = trackChrome?.variant ?? "fullscreen";
  const isMiniTrackChrome =
    variant === "ecom-mini" || variant === "canvas-dock-mini";
  const chromeZoomable = trackChrome?.zoomable ?? zoomable;
  const showVideoImportBtn =
    (trackChrome?.showVideoImport ?? variant === "canvas-dock-mini") && onImportClick;
  const showAudioAttach = trackChrome?.showAudioAttach ?? true;
  const pxPerSec =
    (pxPerSecBase ?? BASE_TIMELINE_PX_PER_SEC) * (chromeZoomable ? zoom : 1);
  const trackLayout = useMemo(
    () => buildClipTrackLayout(clips, pxPerSec),
    [clips, pxPerSec],
  );
  const trackContentPx = trackLayout.totalPx;
  const trackWidthPx = Math.max(280, trackContentPx);
  const playheadLeftPx = trackPxFromProgramSec(programPlayheadSec, clips, pxPerSec);

  const playheadLineRef = useRef<HTMLDivElement>(null);
  const playheadHitRef = useRef<HTMLButtonElement>(null);
  const [reorderInsertBefore, setReorderInsertBefore] = useState<number | null>(null);

  const setPlayheadPx = useCallback(
    (px: number) => {
      const left = `${px}px`;
      if (playheadLineRef.current) playheadLineRef.current.style.left = left;
      if (playheadHitRef.current) {
        playheadHitRef.current.style.left = left;
      }
    },
    [],
  );

  useEffect(() => {
    setPlayheadPx(playheadLeftPx);
  }, [playheadLeftPx, setPlayheadPx]);

  useEffect(() => {
    if (!selectedId) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const seg = trackLayout.segments.find((s) => s.clip.id === selectedId);
    if (!seg) return;
    const pad = 32;
    const clipLeft = seg.leftPx;
    const clipRight = seg.leftPx + seg.widthPx;
    const viewLeft = scrollEl.scrollLeft;
    const viewRight = viewLeft + scrollEl.clientWidth;
    if (clipLeft >= viewLeft + pad && clipRight <= viewRight - pad) return;
    const targetLeft = Math.max(
      0,
      clipLeft - Math.max(0, scrollEl.clientWidth * 0.15),
    );
    scrollEl.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, [selectedId, trackLayout.segments]);

  const startPlayheadScrub = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const handleEl = e.currentTarget as HTMLElement;
    handleEl.setPointerCapture(e.pointerId);
    const seekVisual = (clientX: number) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl || trackContentPx <= 0) return;
      const rect = scrollEl.getBoundingClientRect();
      const xInTrack = scrollEl.scrollLeft + (clientX - rect.left);
      const sec = programSecFromTrackPx(xInTrack, clips, pxPerSec);
      const px = trackPxFromProgramSec(sec, clips, pxPerSec);
      setPlayheadPx(px);
      onProgramSeek(sec);
    };
    seekVisual(e.clientX);
    const onMove = (ev: PointerEvent) => seekVisual(ev.clientX);
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        handleEl.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const insertIndexFromClientX = useCallback(
    (clientX: number) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl || clips.length === 0) return 0;
      const rect = scrollEl.getBoundingClientRect();
      const xInTrack = scrollEl.scrollLeft + (clientX - rect.left);
      for (let i = 0; i < trackLayout.segments.length; i++) {
        const seg = trackLayout.segments[i]!;
        const mid = seg.leftPx + seg.widthPx / 2;
        if (xInTrack < mid) return i;
      }
      return clips.length;
    },
    [clips.length, trackLayout.segments],
  );

  const startClipReorderPointer = (index: number, clipId: string) => (e: React.PointerEvent) => {
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-compose-trim-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    let dragging = false;
    let insertBefore = index;
    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 5) dragging = true;
      if (!dragging) return;
      insertBefore = insertIndexFromClientX(ev.clientX);
      setReorderInsertBefore(insertBefore);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setReorderInsertBefore(null);
      if (dragging) {
        let to = insertBefore;
        if (to > index) to -= 1;
        if (to !== index) onReorder(index, to);
      } else {
        onSelect(clipId);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startEdgeDrag = (side: "left" | "right", blockEl: HTMLDivElement) => {
    const span0 = Math.max(MIN_TRIM_SEC, trimEnd - trimStart);
    const start0 = trimStart;
    const end0 = trimEnd;
    let curStart = start0;
    let curEnd = end0;
    const rect0 = blockEl.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      const ratio = (ev.clientX - rect0.left) / Math.max(rect0.width, 1);
      if (side === "right") {
        curEnd = Math.max(start0 + MIN_TRIM_SEC, start0 + ratio * span0);
      } else {
        curStart = Math.min(end0 - MIN_TRIM_SEC, start0 + ratio * span0);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onTrimStart(curStart);
      onTrimEnd(curEnd);
      onTrimCommit(curStart, curEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const toolBtn =
    "rounded-md p-2 text-white/75 hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none";

  return (
    <div className={cn("mb-3", rootClassName)} data-compose-sequence-track>
      {!hideToolbar ? (
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          {onUndo ? (
            <button
              type="button"
              title="撤销"
              disabled={undoDisabled}
              className={toolBtn}
              onClick={onUndo}
            >
              <Undo2 className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            title="在播放头处分割为两段"
            disabled={splitDisabled}
            className={toolBtn}
            onClick={onSplit}
          >
            <SplitSquareHorizontal className="size-4" />
          </button>
          {onTrimLeft ? (
            <button
              type="button"
              title="切左边（删除播放头左侧）"
              disabled={trimDisabled ?? splitDisabled}
              className={toolBtn}
              onClick={onTrimLeft}
            >
              <ArrowLeftToLine className="size-4" />
            </button>
          ) : null}
          {onTrimRight ? (
            <button
              type="button"
              title="切右边（删除播放头右侧）"
              disabled={trimDisabled ?? splitDisabled}
              className={toolBtn}
              onClick={onTrimRight}
            >
              <ArrowRightToLine className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            title="删除选中段"
            disabled={deleteDisabled}
            className={toolBtn}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        {chromeZoomable ? (
          <div className="flex items-center gap-1.5 text-white/50">
            <button
              type="button"
              className={toolBtn}
              aria-label="缩小时间线"
              onClick={() =>
                setZoom((z) => Math.max(TIMELINE_ZOOM_MIN, Math.round((z - 0.15) * 100) / 100))
              }
            >
              <Minus className="size-3.5" />
            </button>
            <input
              type="range"
              min={TIMELINE_ZOOM_MIN}
              max={TIMELINE_ZOOM_MAX}
              step={0.05}
              value={zoom}
              className="h-1 w-24 accent-white"
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="时间线缩放"
            />
            <button
              type="button"
              className={toolBtn}
              aria-label="放大时间线"
              onClick={() =>
                setZoom((z) => Math.min(TIMELINE_ZOOM_MAX, Math.round((z + 0.15) * 100) / 100))
              }
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      ) : null}
      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 overflow-x-auto bg-[#0f0f0f]",
          isMiniTrackChrome
            ? "rounded-none border-0"
            : "rounded-md border border-white/15",
          scrollContainerClassName,
        )}
      >
        <div className="relative" style={{ width: trackWidthPx }}>
          {!playheadInsetInClipLane ? (
            <div
              ref={playheadLineRef}
              className="pointer-events-none absolute inset-y-0 z-40"
              style={{ left: playheadLeftPx }}
            >
              <div className="absolute -top-0.5 left-1/2 size-2 -translate-x-1/2 rotate-45 border border-white/90 bg-white shadow-sm" />
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            </div>
          ) : null}
          <button
            ref={playheadHitRef}
            type="button"
            aria-label="拖动播放头"
            disabled={disabled}
            className="absolute z-50 w-3 -translate-x-1/2 cursor-ew-resize border-0 bg-transparent p-0"
            style={{ left: playheadLeftPx, top: 0, bottom: 0 }}
            onPointerDown={startPlayheadScrub}
          />

          <div
            className={cn(
              "relative h-5 shrink-0 cursor-pointer bg-[#141414]",
              !isMiniTrackChrome && "border-b border-white/10",
            )}
            onPointerDown={(e) => {
              if (disabled) return;
              startPlayheadScrub(e);
            }}
          >
            {(() => {
              const tickStep =
                totalProgramSec <= 20 ? 2 : totalProgramSec <= 60 ? 5 : 10;
              const ticks: number[] = [];
              for (let t = 0; t <= totalProgramSec + 0.001; t += tickStep) ticks.push(t);
              return ticks.map((t) => (
                <span
                  key={t}
                  className="pointer-events-none absolute top-0.5 -translate-x-1/2 text-[9px] tabular-nums text-white/35"
                  style={{
                    left: trackPxFromProgramSec(t, clips, pxPerSec),
                  }}
                >
                  {formatTimeSec(t)}
                </span>
              ));
            })()}
          </div>

          <div className={cn("relative", clipLaneClassName)}>
            {playheadInsetInClipLane ? (
              <div
                ref={playheadLineRef}
                className="pointer-events-none absolute bottom-2.5 top-2 z-40 w-0"
                style={{ left: playheadLeftPx }}
              >
                <div className="absolute -top-[11px] left-1/2 size-2 -translate-x-1/2 rotate-45 border border-white/90 bg-white shadow-sm" />
                <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)]" />
              </div>
            ) : null}
            {reorderInsertBefore != null ? (
              <div
                className={cn(
                  "pointer-events-none absolute z-[45] w-0.5 bg-[#0071e3] shadow-[0_0_8px_rgba(0,113,227,0.85)]",
                  playheadInsetInClipLane ? "bottom-2.5 top-2" : "inset-y-0",
                )}
                style={{
                  left:
                    trackLayout.segments[reorderInsertBefore]?.leftPx ??
                    trackContentPx,
                }}
              />
            ) : null}
            <div className="flex h-full gap-px">
              {trackLayout.segments.map((seg, index) => {
                const clip = seg.clip;
                const widthPx = seg.widthPx;
                const isSel = clip.id === selectedId;
                const url = clip.videoUrl.trim();
                const fullDur = fullDurationByUrl[url] ?? seg.span;
                const stripFrames = clipFilmstripFrames(
                  clip,
                  filmstripByUrl[url],
                  fullDur,
                );
                return (
                  <div
                    key={clip.id}
                    style={{ width: widthPx, flexShrink: 0 }}
                    className={cn(
                      "relative h-full overflow-hidden rounded-sm bg-[#1a1a1a]",
                      isSel
                        ? "z-10 border-2 border-white"
                        : isMiniTrackChrome
                          ? "border-0"
                          : "border border-white/15",
                      !disabled && "cursor-grab active:cursor-grabbing",
                    )}
                    title={clip.label ?? "片段"}
                    onPointerDown={startClipReorderPointer(index, clip.id)}
                  >
                    <div
                      className={cn(
                        "pointer-events-none flex h-full w-full overflow-hidden",
                        portraitFilmstrip
                          ? "items-center gap-px px-0.5 py-2"
                          : "",
                      )}
                    >
                      {stripFrames.length > 0 ? (
                        stripFrames.map((f, fi) =>
                          portraitFilmstrip ? (
                            <div
                              key={`${f.atSec}-${fi}`}
                              className="h-full aspect-[9/16] shrink-0 overflow-hidden rounded-[1px] bg-black/40"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={f.thumbnailUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                draggable={false}
                              />
                            </div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${f.atSec}-${fi}`}
                              src={f.thumbnailUrl}
                              alt=""
                              className={cn(
                                "h-full shrink-0 object-cover",
                                filmstripThumbClassName,
                              )}
                              draggable={false}
                            />
                          ),
                        )
                      ) : (
                        portraitFilmstrip ? (
                          <div className="mx-auto h-full aspect-[9/16] overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={clip.posterUrl ?? clip.videoUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={clip.posterUrl ?? clip.videoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        )
                      )}
                    </div>
                    {isSel ? (
                      <>
                        <div
                          data-compose-trim-handle
                          className={cn(
                            "absolute left-0 z-20 w-1.5 cursor-ew-resize bg-white shadow-md",
                            portraitFilmstrip
                              ? "bottom-2 top-2"
                              : "top-0 h-full",
                          )}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startEdgeDrag(
                              "left",
                              e.currentTarget.parentElement as HTMLDivElement,
                            );
                          }}
                        />
                        <div
                          data-compose-trim-handle
                          className={cn(
                            "absolute right-0 z-20 w-1.5 cursor-ew-resize bg-white shadow-md",
                            portraitFilmstrip
                              ? "bottom-2 top-2"
                              : "top-0 h-full",
                          )}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startEdgeDrag(
                              "right",
                              e.currentTarget.parentElement as HTMLDivElement,
                            );
                          }}
                        />
                      </>
                    ) : null}
                  </div>
                );
              })}
              {showVideoImportBtn ? (
                <button
                  type="button"
                  title="导入图片或视频"
                  disabled={disabled}
                  onClick={onImportClick}
                  className="flex h-full w-14 shrink-0 items-center justify-center border border-dashed border-white/25 bg-[#141414] text-white/55 hover:bg-white/5 disabled:opacity-40"
                >
                  <Plus className="size-5" />
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              "relative h-11 shrink-0 bg-[#0a0c10]",
              !isMiniTrackChrome && "border-t border-white/10",
            )}
          >
            <div className="flex h-full gap-px">
              {trackLayout.segments.map((seg) => {
                const clip = seg.clip;
                const isSel = clip.id === selectedId;
                const audioUrl = clip.audioUrl?.trim();
                const peaks = audioUrl ? audioPeaksByUrl?.[audioUrl] : undefined;
                return (
                  <div
                    key={`audio-${clip.id}`}
                    style={{ width: seg.widthPx, flexShrink: 0 }}
                    className={cn(
                      "relative flex h-full overflow-hidden rounded-sm",
                      isMiniTrackChrome
                        ? isSel
                          ? "ring-1 ring-white/50"
                          : ""
                        : isSel
                          ? "border border-sky-400/70"
                          : "border border-white/10",
                      !disabled && "cursor-pointer",
                    )}
                    onClick={() => onSelect(clip.id)}
                  >
                    {audioUrl ? (
                      <>
                        <ComposeSegmentAudioWaveform
                          peaks={peaks}
                          widthPx={seg.widthPx}
                          label={clip.label?.trim() || undefined}
                        />
                        {isSel && onClipAudioClear && !disabled ? (
                          <button
                            type="button"
                            title="清除段配音"
                            className="absolute right-0.5 top-0.5 z-10 rounded bg-black/55 px-1 text-[9px] text-white/70 hover:bg-black/75 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClipAudioClear(clip.id);
                            }}
                          >
                            清除
                          </button>
                        ) : null}
                      </>
                    ) : isSel && showAudioAttach && onClipAudioAttach && !disabled ? (
                      <div className="flex h-full w-full items-center justify-center bg-[#161616]/90 px-1">
                      <button
                        type="button"
                        className="text-[10px] text-white/85 hover:text-white hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClipAudioAttach(clip.id);
                        }}
                      >
                        + 配音
                      </button>
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#161616]/60">
                        <span className="text-[10px] text-white/20">—</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {reserveExtraClipLane ? (
            <div
              className={cn(
                "border-t border-dashed border-white/10 bg-[#121212]/80",
                reserveLaneClassName,
              )}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ComposeClipStrip({
  clips,
  disabled,
  variant,
  selectedId,
  onSelect,
  onReorder,
}: {
  clips: ComposeWorkbenchClip[];
  disabled?: boolean;
  variant: "light" | "dark";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const onDragStart = (index: number) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isFinite(from)) onReorder(from, toIndex);
  };

  if (clips.length === 0) {
    return (
      <p className={cn("text-[10px]", variant === "dark" ? "text-white/45" : "text-[#86868b]")}>
        暂无片段，请先生成步骤 ② 视频片段。
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1",
        variant === "dark" && "rounded-lg bg-[#1a1a1a] p-2",
      )}
    >
      {clips.map((clip, index) => (
        <div
          key={clip.id}
          draggable={!disabled}
          onDragStart={onDragStart(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop(index)}
          className={cn(
            "relative w-[72px] shrink-0 cursor-grab active:cursor-grabbing overflow-hidden rounded-md border",
            selectedId === clip.id
              ? "border-[#0071e3] ring-1 ring-[#0071e3]/40"
              : variant === "dark"
                ? "border-white/15"
                : "border-[#e8e8ed]",
          )}
          onClick={() => onSelect?.(clip.id)}
        >
          {clip.posterUrl || clip.videoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clip.posterUrl ?? clip.videoUrl}
              alt=""
              className="aspect-[9/16] w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center bg-[#222] text-[9px] text-white/50">
              片段
            </div>
          )}
          <span
            className={cn(
              "absolute bottom-0 left-0 right-0 truncate px-1 py-0.5 text-[9px]",
              variant === "dark" ? "bg-black/70 text-white/80" : "bg-white/90 text-[#6e6e73]",
            )}
          >
            {clip.label ?? `片段 ${index + 1}`}
          </span>
          {!disabled ? (
            <GripVertical className="absolute left-0.5 top-0.5 size-3 text-white/70 drop-shadow" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ComposeMiniTimelinePanel({
  projectId,
  ordered,
  workbench,
  loading,
  filmstripByUrl,
  fullDurationByUrl,
  exportBusy,
  canEdit,
  onClose,
  onApplyWorkbench,
  onReorder,
  onExport,
  onOpenFullscreen,
  onImportClick,
  trackChrome,
  onClipAudioAttach,
  onClipAudioClear,
}: {
  projectId: string;
  ordered: ComposeWorkbenchClip[];
  workbench: ComposeWorkbenchState;
  loading: boolean;
  filmstripByUrl: Record<string, VideoFilmstripFrame[]>;
  fullDurationByUrl: Record<string, number>;
  exportBusy: boolean;
  canEdit: boolean;
  onClose: () => void;
  onApplyWorkbench: (
    fn: (p: ComposeWorkbenchState) => ComposeWorkbenchState,
    opts?: { persist?: boolean },
  ) => void;
  onReorder: (from: number, to: number) => void;
  onExport: () => void;
  onOpenFullscreen: () => void;
  onImportClick: () => void;
  trackChrome?: ComposeTrackChrome;
  onClipAudioAttach?: (clipId: string) => void;
  onClipAudioClear?: (clipId: string) => void;
}) {
  const { alert } = useComposeDialogs();
  const [selectedId, setSelectedId] = useState<string | null>(ordered[0]?.id ?? null);
  const [playing, setPlaying] = useState(false);
  const [programPlayheadSec, setProgramPlayheadSec] = useState(0);
  const [durationSec, setDurationSec] = useState(6);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(6);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const selected = ordered.find((c) => c.id === selectedId) ?? ordered[0];
  const selectedVideoUrl = selected?.videoUrl?.trim() ?? "";
  const { audioPeaksByUrl } = useComposeAudioPeaksLoader(ordered, true);

  useEffect(() => {
    if (!selectedVideoUrl) return;
    const dur = fullDurationByUrl[selectedVideoUrl];
    if (dur) setDurationSec(dur);
  }, [selectedVideoUrl, fullDurationByUrl]);

  const programSegments = useMemo(() => buildProgramSegments(ordered), [ordered]);
  const totalProgramSec = programSegments.reduce((s, x) => s + x.span, 0) || 1;

  const { playbackVideoUrl, onProgramVideoTimeUpdate, toggleProgramPlay } =
    useComposeProgramVideoPlayback({
      ordered,
      videoRef,
      audioRef,
      playing,
      setPlaying,
      programPlayheadSec,
      setProgramPlayheadSec,
    });

  const playheadForReorderRef = useRef(programPlayheadSec);
  playheadForReorderRef.current = programPlayheadSec;
  const orderedKey = ordered.map((c) => c.id).join("|");
  useEffect(() => {
    const hit = resolveClipAtProgramSec(ordered, playheadForReorderRef.current);
    if (hit?.clip.id) setSelectedId(hit.clip.id);
  }, [orderedKey, ordered]);

  useEffect(() => {
    setProgramPlayheadSec((p) => Math.min(Math.max(0, p), totalProgramSec));
  }, [totalProgramSec]);

  const playheadInSelected = isProgramPlayheadInSelectedClip(
    ordered,
    selectedId,
    programPlayheadSec,
  );

  useEffect(() => {
    if (!selected || durationSec <= 0) return;
    const start = composeClipSourceStart(selected);
    const end = composeClipSourceEnd(selected, durationSec);
    setTrimStart(start);
    setTrimEnd(end);
  }, [selected?.id, selected?.sourceStartSec, selected?.sourceEndSec, durationSec, selected]);

  const previewSourceSec = useMemo(() => {
    const hit = resolveClipAtProgramSec(ordered, programPlayheadSec);
    if (hit && hit.clip.id === selectedId) return hit.sourceSec;
    if (!selected) return 0;
    return composeClipSourceStart(selected);
  }, [ordered, programPlayheadSec, selected, selectedId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || playing) return;
    if (Math.abs(v.currentTime - previewSourceSec) > 0.12) {
      v.currentTime = previewSourceSec;
    }
  }, [previewSourceSec, playing, selected?.videoUrl]);

  useEffect(() => {
    if (playing) return;
    const hit = resolveClipAtProgramSec(ordered, programPlayheadSec);
    const a = audioRef.current;
    const audioUrl = hit?.clip.audioUrl?.trim();
    if (!a || !audioUrl) return;
    if (!audioElementMatchesUrl(a, audioUrl)) {
      a.src = audioUrl;
      a.load();
    }
    const target = hit ? Math.max(0, hit.localInClip) : 0;
    if (Math.abs(a.currentTime - target) > 0.12) {
      try {
        a.currentTime = target;
      } catch {
        /* ignore */
      }
    }
  }, [ordered, programPlayheadSec, playing]);

  const seekProgramTimeline = useCallback(
    (programSec: number) => {
      const total = programSegments.reduce((s, x) => s + x.span, 0) || 1;
      setProgramPlayheadSec(Math.max(0, Math.min(programSec, total)));
    },
    [programSegments],
  );

  const splitAtPlayhead = async () => {
    if (!selectedId || !selected?.videoUrl) return;
    const atSource = sourceSecAtProgramPlayheadInClip(
      ordered,
      selectedId,
      programPlayheadSec,
    );
    if (atSource == null) {
      await alert({
        title: "无法分割",
        message: "请先把播放头移到当前选中片段中间再分割。",
        variant: "error",
      });
      return;
    }
    const orderIdx = workbench.orderedClipIds.indexOf(selectedId);
    const next = splitComposeClipAtSourceSec(workbench, selectedId, atSource, durationSec);
    onApplyWorkbench(() => next, { persist: true });
    const secondId =
      orderIdx >= 0 ? next.orderedClipIds[orderIdx + 1] : next.orderedClipIds[1];
    if (secondId) setSelectedId(secondId);
  };

  const deleteSelected = async () => {
    if (!selectedId) return;
    if (ordered.length <= 1) {
      await alert({ title: "无法删除", message: "至少保留 1 段视频", variant: "error" });
      return;
    }
    onApplyWorkbench((prev) => removeComposeClip(prev, selectedId), { persist: true });
    setSelectedId(ordered.find((c) => c.id !== selectedId)?.id ?? null);
  };

  /** 缩略图失败时仍允许剪辑（仅 loading 期间遮罩） */
  const ready = !loading;

  const panelRef = useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const clampPanelPos = useCallback((x: number, y: number) => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? window.innerWidth * (2 / 3);
    const h = el?.offsetHeight ?? 240;
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
    };
  }, []);

  useEffect(() => {
    if (dragPos == null) return;
    const onResize = () => {
      setDragPos((p) => (p ? clampPanelPos(p.x, p.y) : p));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPanelPos, dragPos]);

  const startPanelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(COMPOSE_PANEL_DRAG_BLOCK)) return;
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const rect0 = panel.getBoundingClientRect();
    const offsetX = e.clientX - rect0.left;
    const offsetY = e.clientY - rect0.top;
    let anchored = dragPos != null;
    panel.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      if (!anchored) {
        const rect = panel.getBoundingClientRect();
        setDragPos({ x: rect.left, y: rect.top });
        anchored = true;
      }
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const rawX = ev.clientX - offsetX;
      const rawY = ev.clientY - offsetY;
      const x = Math.max(8, Math.min(rawX, window.innerWidth - w - 8));
      const y = Math.max(8, Math.min(rawY, window.innerHeight - h - 8));
      setDragPos({ x, y });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        panel.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const panelPositionClass = dragPos
    ? MINI_COMPOSE_PANEL_WIDTH_CLASS
    : cn(
        MINI_COMPOSE_PANEL_WIDTH_CLASS,
        "bottom-[33.333vh] left-1/2 -translate-x-1/2",
      );

  const panelPositionStyle: React.CSSProperties | undefined = dragPos
    ? { left: dragPos.x, top: dragPos.y }
    : undefined;

  return (
    <div
      ref={panelRef}
      className={cn(
        "nopan nodrag nowheel pointer-events-auto fixed z-[3200] flex max-h-[min(560px,72dvh)] flex-col overflow-hidden rounded-xl border border-[#3a3a3c] bg-[#141416]/95 text-white shadow-2xl backdrop-blur-md",
        panelPositionClass,
      )}
      style={panelPositionStyle}
      role="dialog"
      aria-label="简易剪辑时间线"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="关闭"
        title="关闭"
        className="absolute right-2 top-2 z-50 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-md ring-1 ring-black/10 transition hover:bg-[#f5f5f7]"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
      <div
        className="relative z-40 flex shrink-0 cursor-grab select-none items-center px-3 py-2 pr-6 active:cursor-grabbing"
        data-compose-panel-drag-handle
        onPointerDown={startPanelDrag}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <GripVertical className="size-3.5 shrink-0 text-white/35" aria-hidden />
          <span className="truncate text-xs font-medium text-white/85">时间线 1</span>
          <span className="hidden text-[10px] text-white/35 sm:inline">
            拖动标题栏移动
          </span>
          {!ready ? (
            <span className="text-[10px] text-white/45">· 加载中…</span>
          ) : null}
        </div>
      </div>
      <div className="relative flex min-h-[200px] min-w-0 flex-1 flex-col">
        {!ready ? (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-[#141416]/95"
            aria-busy
            aria-live="polite"
          >
            <Loader2 className="size-6 animate-spin text-white/70" />
            <p className="text-xs text-white/55">正在加载时间线…</p>
          </div>
        ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-40"
            disabled={!canEdit || !playheadInSelected}
            title={
              playheadInSelected
                ? "在播放头处分割"
                : "播放头需在选中片段内才可分割"
            }
            onClick={() => void splitAtPlayhead()}
          >
            <SplitSquareHorizontal className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-40"
            disabled={!canEdit || !selectedId || ordered.length <= 1}
            title="删除选中段"
            onClick={() => void deleteSelected()}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full bg-white/12 hover:bg-white/20 disabled:opacity-40"
            disabled={!playbackVideoUrl}
            onClick={toggleProgramPlay}
          >
            {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4 fill-white" />}
          </button>
          <span className="text-[11px] tabular-nums text-white/50">
            {formatTimeSec(programPlayheadSec)} / {formatTimeSec(totalProgramSec)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-40"
            disabled={exportBusy || !canEdit}
            title="导出合成"
            onClick={onExport}
          >
            <Download className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-40"
            disabled={!canEdit}
            title="全屏编辑"
            aria-label="全屏编辑"
            onClick={onOpenFullscreen}
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      </div>
      <video
        ref={videoRef}
        src={playbackVideoUrl || selected?.videoUrl}
        className="sr-only"
        playsInline
        onTimeUpdate={onProgramVideoTimeUpdate}
      />
      <audio ref={audioRef} className="sr-only" preload="auto" playsInline />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-0">
        <ComposeSequenceTrack
          clips={ordered}
          selectedId={selectedId}
          disabled={!canEdit || !ready}
          trimStart={trimStart}
          trimEnd={trimEnd}
          filmstripByUrl={filmstripByUrl}
          fullDurationByUrl={fullDurationByUrl}
          audioPeaksByUrl={audioPeaksByUrl}
          programPlayheadSec={programPlayheadSec}
          totalProgramSec={totalProgramSec}
          onSelect={setSelectedId}
          onReorder={onReorder}
          onTrimStart={setTrimStart}
          onTrimEnd={setTrimEnd}
          onTrimCommit={() => undefined}
          onSplit={() => void splitAtPlayhead()}
          onDelete={() => void deleteSelected()}
          onProgramSeek={seekProgramTimeline}
          onImportClick={onImportClick}
          hideToolbar
          zoomable
          clipLaneClassName="h-24"
          portraitFilmstrip
          splitDisabled={!canEdit || !playheadInSelected}
          deleteDisabled={!canEdit || !selectedId || ordered.length <= 1}
          scrollContainerClassName="bg-transparent"
          trackChrome={trackChrome ?? { variant: "ecom-mini", zoomable: true }}
          onClipAudioAttach={onClipAudioAttach}
          onClipAudioClear={onClipAudioClear}
        />
      </div>
      </div>
    </div>
  );
}

export function ComposeEditorFullscreen({
  projectId,
  projectModule,
  workbench,
  profile,
  ordered,
  exportBusy,
  loading,
  filmstripByUrl,
  fullDurationByUrl,
  onClose,
  onExport,
  onImportClick,
  onApplyWorkbench,
  setProfile,
  bgmPresets,
  trackChrome,
  onClipAudioAttach,
  onClipAudioClear,
  upstreamLibraryClips,
}: {
  projectId: string;
  projectModule: string;
  workbench: ComposeWorkbenchState;
  profile: NonNullable<ComposeWorkbenchState["profile"]>;
  ordered: ComposeWorkbenchClip[];
  exportBusy: boolean;
  loading: boolean;
  filmstripByUrl: Record<string, VideoFilmstripFrame[]>;
  fullDurationByUrl: Record<string, number>;
  onClose: () => void;
  onExport: () => void;
  onImportClick: () => void;
  onApplyWorkbench: (
    fn: (p: ComposeWorkbenchState) => ComposeWorkbenchState,
    opts?: { persist?: boolean },
  ) => void;
  setProfile: (p: ComposeWorkbenchState["profile"]) => void;
  bgmPresets?: import("./compose-render-profile-panel").ComposeBgmPresetOption[];
  trackChrome?: ComposeTrackChrome;
  onClipAudioAttach?: (clipId: string) => void;
  onClipAudioClear?: (clipId: string) => void;
  /** 画布：左侧「连线资产」列表（上游视频/图/音频，非仅 file import） */
  upstreamLibraryClips?: ComposeWorkbenchClip[];
}) {
  const { alert, toast } = useComposeDialogs();
  const [selectedId, setSelectedId] = useState<string | null>(ordered[0]?.id ?? null);
  const projectAssetLibraryLabel = resolveComposeProjectAssetLibraryLabel(projectModule);
  const [assetLibraryTab, setAssetLibraryTab] = useState<"imported" | "project">("imported");
  const [assetMediaFilter, setAssetMediaFilter] = useState<"all" | "image" | "video" | "audio">(
    "all",
  );
  const [playing, setPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(6);
  const [durationSec, setDurationSec] = useState(6);
  const [programPlayheadSec, setProgramPlayheadSec] = useState(0);
  const [undoDepth, setUndoDepth] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const undoStackRef = useRef<ComposeWorkbenchState[]>([]);

  const selected = ordered.find((c) => c.id === selectedId) ?? ordered[0];
  const peaksSourceClips = useMemo(
    () => [...ordered, ...(upstreamLibraryClips ?? [])],
    [ordered, upstreamLibraryClips],
  );
  const { audioPeaksByUrl } = useComposeAudioPeaksLoader(peaksSourceClips, true);
  const importedClips = ordered.filter((c) => c.source === "import");
  const projectLibraryClips = ordered.filter(
    (c) => c.source === "external" || c.source === "look",
  );
  const isCanvasModule = projectModule === "canvas";
  const importedTabClips = isCanvasModule
    ? (upstreamLibraryClips?.length ? upstreamLibraryClips : projectLibraryClips)
    : importedClips;
  const importedTabLabel = isCanvasModule ? "连线资产" : "已导入资产";
  const visibleImportedTabClips = useMemo(() => {
    if (!isCanvasModule || assetMediaFilter === "all") return importedTabClips;
    if (assetMediaFilter === "video") {
      return importedTabClips.filter((c) => Boolean(c.videoUrl?.trim()));
    }
    if (assetMediaFilter === "audio") {
      return importedTabClips.filter((c) => Boolean(c.audioUrl?.trim()));
    }
    if (assetMediaFilter === "image") {
      return importedTabClips.filter(
        (c) =>
          Boolean(c.posterUrl?.trim() || c.videoUrl?.trim()) && !c.audioUrl?.trim(),
      );
    }
    return importedTabClips;
  }, [assetMediaFilter, importedTabClips, isCanvasModule]);
  const [timelinePaneHeightPx, setTimelinePaneHeightPx] = useState(220);

  useEffect(() => {
    if (playing) return;
    const v = videoRef.current;
    if (!v || !selected?.videoUrl) return;
    v.load();
    setPlaying(false);
  }, [selected?.videoUrl, playing]);

  const selectedVideoUrl = selected?.videoUrl?.trim() ?? "";
  const timelineReady = !loading;

  const pushUndoSnapshot = useCallback(() => {
    undoStackRef.current.push(cloneWorkbenchState(workbench));
    if (undoStackRef.current.length > 32) undoStackRef.current.shift();
    setUndoDepth(undoStackRef.current.length);
  }, [workbench]);

  const applyWithUndo = useCallback(
    (
      fn: (prev: ComposeWorkbenchState) => ComposeWorkbenchState,
      opts?: { persist?: boolean },
    ) => {
      pushUndoSnapshot();
      onApplyWorkbench(fn, opts);
    },
    [onApplyWorkbench, pushUndoSnapshot],
  );

  const undoEdit = useCallback(() => {
    const prev = undoStackRef.current.pop();
    setUndoDepth(undoStackRef.current.length);
    if (prev) onApplyWorkbench(() => prev, { persist: true });
  }, [onApplyWorkbench]);

  useEffect(() => {
    if (!selectedVideoUrl) return;
    const dur = fullDurationByUrl[selectedVideoUrl];
    if (dur) setDurationSec(dur);
  }, [selectedVideoUrl, fullDurationByUrl]);

  const programSegments = useMemo(() => buildProgramSegments(ordered), [ordered]);
  const totalProgramSec =
    programSegments.reduce((s, x) => s + x.span, 0) || 1;

  const { playbackVideoUrl, onProgramVideoTimeUpdate, toggleProgramPlay } =
    useComposeProgramVideoPlayback({
      ordered,
      videoRef,
      audioRef,
      playing,
      setPlaying,
      programPlayheadSec,
      setProgramPlayheadSec,
    });

  const fsPlayheadForReorderRef = useRef(programPlayheadSec);
  fsPlayheadForReorderRef.current = programPlayheadSec;
  const fsOrderedKey = ordered.map((c) => c.id).join("|");
  useEffect(() => {
    const hit = resolveClipAtProgramSec(ordered, fsPlayheadForReorderRef.current);
    if (hit?.clip.id) setSelectedId(hit.clip.id);
  }, [fsOrderedKey, ordered]);

  useEffect(() => {
    setProgramPlayheadSec((p) => Math.min(Math.max(0, p), totalProgramSec));
  }, [totalProgramSec]);

  const playheadInSelected = isProgramPlayheadInSelectedClip(
    ordered,
    selectedId,
    programPlayheadSec,
  );

  useEffect(() => {
    if (!selected || durationSec <= 0) return;
    const start = composeClipSourceStart(selected);
    const end = composeClipSourceEnd(selected, durationSec);
    setTrimStart(start);
    setTrimEnd(end);
  }, [selected?.id, selected?.sourceStartSec, selected?.sourceEndSec, durationSec, selected]);

  const previewSourceSec = useMemo(() => {
    const hit = resolveClipAtProgramSec(ordered, programPlayheadSec);
    if (hit && hit.clip.id === selectedId) return hit.sourceSec;
    if (!selected) return 0;
    return composeClipSourceStart(selected);
  }, [ordered, programPlayheadSec, selected, selectedId]);

  const previewVideoUrl =
    playing && playbackVideoUrl ? playbackVideoUrl : selected?.videoUrl;

  const applyRangeToWorkbench = useCallback(
    (start: number, end: number, opts?: { recordUndo?: boolean }) => {
      if (!selectedId || durationSec <= 0) return;
      const apply = opts?.recordUndo ? applyWithUndo : onApplyWorkbench;
      apply(
        (prev) =>
          setComposeClipSourceRangeWithRipple(prev, selectedId, start, end, durationSec),
        { persist: false },
      );
    },
    [applyWithUndo, durationSec, onApplyWorkbench, selectedId],
  );

  const commitClipRangeFromRefs = useCallback(
    (start: number, end: number) => {
      applyRangeToWorkbench(start, end, { recordUndo: true });
    },
    [applyRangeToWorkbench],
  );

  const seekProgramTimeline = useCallback(
    (programSec: number) => {
      const total = programSegments.reduce((s, x) => s + x.span, 0) || 1;
      setProgramPlayheadSec(Math.max(0, Math.min(programSec, total)));
    },
    [programSegments],
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v || playing) return;
    if (Math.abs(v.currentTime - previewSourceSec) > 0.15) {
      v.currentTime = previewSourceSec;
    }
  }, [previewSourceSec, playing, selected?.videoUrl]);

  useEffect(() => {
    if (playing) return;
    const hit = resolveClipAtProgramSec(ordered, programPlayheadSec);
    const a = audioRef.current;
    const audioUrl = hit?.clip.audioUrl?.trim();
    if (!a || !audioUrl) return;
    if (!audioElementMatchesUrl(a, audioUrl)) {
      a.src = audioUrl;
      a.load();
    }
    const target = hit ? Math.max(0, hit.localInClip) : 0;
    if (Math.abs(a.currentTime - target) > 0.12) {
      try {
        a.currentTime = target;
      } catch {
        /* ignore */
      }
    }
  }, [ordered, programPlayheadSec, playing]);

  const focusTimelineClip = useCallback(
    (clipId: string) => {
      if (!ordered.some((c) => c.id === clipId)) return;
      setSelectedId(clipId);
      const seg = programSegments.find((s) => s.clip.id === clipId);
      if (seg) {
        setProgramPlayheadSec(seg.programStart + 0.001);
        setPlaying(false);
      }
    },
    [ordered, programSegments],
  );

  const pickUpstreamLibraryClip = useCallback(
    (libraryClipId: string) => {
      if (!isCanvasModule) {
        setSelectedId(libraryClipId);
        return;
      }
      const lib =
        visibleImportedTabClips.find((c) => c.id === libraryClipId) ??
        upstreamLibraryClips?.find((c) => c.id === libraryClipId);
      if (!lib) {
        setSelectedId(libraryClipId);
        return;
      }
      if (isAudioOnlyLibraryClip(lib)) {
        const pairedId = lib.pairedTimelineClipId?.trim();
        if (pairedId && ordered.some((c) => c.id === pairedId)) {
          focusTimelineClip(pairedId);
          return;
        }
        const audioUrl = lib.audioUrl?.trim();
        if (audioUrl) {
          const byAudio = ordered.find((c) => c.audioUrl?.trim() === audioUrl);
          if (byAudio) {
            focusTimelineClip(byAudio.id);
            return;
          }
        }
        toast?.({
          title: "未找到对应时间线片段",
          variant: "info",
        });
        return;
      }
      const nodeMatch = lib.id.match(/^upstream-(?:video|image)-(.+)$/);
      const nodeId = nodeMatch?.[1];
      if (nodeId) {
        const onTimeline = ordered.find((c) => c.id === nodeId);
        if (onTimeline) {
          focusTimelineClip(onTimeline.id);
          return;
        }
      }
      setSelectedId(libraryClipId);
    },
    [
      focusTimelineClip,
      isCanvasModule,
      ordered,
      toast,
      upstreamLibraryClips,
      visibleImportedTabClips,
    ],
  );

  const splitAtPlayhead = async () => {
    if (!selectedId || !selected?.videoUrl) return;
    const atSource = sourceSecAtProgramPlayheadInClip(
      ordered,
      selectedId,
      programPlayheadSec,
    );
    if (atSource == null) {
      await alert({
        title: "无法分割",
        message: "请先把播放头移到当前选中片段中间（前后至少各留 0.25 秒）再点分割。",
        variant: "error",
      });
      return;
    }
    const orderIdx = workbench.orderedClipIds.indexOf(selectedId);
    const next = splitComposeClipAtSourceSec(
      workbench,
      selectedId,
      atSource,
      durationSec,
    );
    applyWithUndo(() => next, { persist: true });
    const secondId =
      orderIdx >= 0 ? next.orderedClipIds[orderIdx + 1] : next.orderedClipIds[1];
    const pickId = secondId ?? next.orderedClipIds[orderIdx] ?? next.orderedClipIds[0];
    if (pickId) setSelectedId(pickId);
    toast?.({
      title: "已分割为两段，请分别选中并拖白边裁剪",
      variant: "success",
    });
  };

  const trimLeftAtPlayhead = async () => {
    if (!selectedId || !selected) return;
    const atSource = sourceSecAtProgramPlayheadInClip(
      ordered,
      selectedId,
      programPlayheadSec,
    );
    if (atSource == null) {
      await alert({
        title: "无法切左边",
        message: "播放头需落在当前选中片段中间。",
        variant: "error",
      });
      return;
    }
    const end = composeClipSourceEnd(selected, durationSec);
    applyWithUndo(
      (prev) =>
        setComposeClipSourceRangeWithRipple(prev, selectedId, atSource, end, durationSec),
      { persist: true },
    );
  };

  const trimRightAtPlayhead = async () => {
    if (!selectedId || !selected) return;
    const atSource = sourceSecAtProgramPlayheadInClip(
      ordered,
      selectedId,
      programPlayheadSec,
    );
    if (atSource == null) {
      await alert({
        title: "无法切右边",
        message: "播放头需落在当前选中片段中间。",
        variant: "error",
      });
      return;
    }
    const start = composeClipSourceStart(selected);
    applyWithUndo(
      (prev) =>
        setComposeClipSourceRangeWithRipple(prev, selectedId, start, atSource, durationSec),
      { persist: true },
    );
  };

  const deleteSelected = async () => {
    if (!selectedId) return;
    if (ordered.length <= 1) {
      await alert({ title: "无法删除", message: "至少保留 1 段视频", variant: "error" });
      return;
    }
    applyWithUndo((prev) => removeComposeClip(prev, selectedId), { persist: true });
    setSelectedId(null);
  };

  const startTimelineHeightDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = timelinePaneHeightPx;
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(160, Math.min(window.innerHeight * 0.55, startH + (startY - ev.clientY)));
      setTimelinePaneHeightPx(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className="nopan nodrag nowheel pointer-events-auto fixed inset-0 z-[2000] flex h-dvh w-screen flex-col bg-[#0d0d0d] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="卡点成片剪辑"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!timelineReady ? (
        <div className="absolute inset-0 z-[2100] flex flex-col items-center justify-center gap-3 bg-[#0d0d0d]/92">
          <Loader2 className="size-8 animate-spin text-white/75" />
          <p className="text-sm text-white/55">正在加载时间线与缩略图…</p>
        </div>
      ) : null}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white/90">时间线</span>
          <span className="text-[11px] text-white/45">
            {ordered.length} 段 · 云端 FFmpeg 合成
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button"
            disabled={exportBusy || ordered.length < 1}
            onClick={onExport}
          >
            {exportBusy ? "合成中…" : "导出"}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-white/70 hover:bg-white/10"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0d0d0d]",
          COMPOSE_FS_WORKSPACE_INSET,
          COMPOSE_FS_BLOCK_GAP,
        )}
      >
        <div
          className={cn("flex min-h-0 flex-1 overflow-hidden", COMPOSE_FS_BLOCK_GAP)}
        >
          <aside
            className={cn(
              COMPOSE_FS_SURFACE,
              COMPOSE_FS_LEFT_W,
              "flex min-h-0 flex-col",
            )}
          >
            <div className="flex border-b border-white/10 text-[11px]">
              <button
                type="button"
                className={cn(
                  "flex-1 px-2 py-2.5 transition",
                  assetLibraryTab === "imported"
                    ? "font-medium text-white"
                    : "text-white/45 hover:text-white/70",
                )}
                onClick={() => setAssetLibraryTab("imported")}
              >
                {importedTabLabel}
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 px-2 py-2.5 transition",
                  assetLibraryTab === "project"
                    ? "font-medium text-white"
                    : "text-white/45 hover:text-white/70",
                )}
                onClick={() => setAssetLibraryTab("project")}
              >
                {projectAssetLibraryLabel}
              </button>
            </div>
            <div className="flex items-center gap-1 border-b border-white/10 px-2 py-2 text-[10px]">
              <div className="flex min-w-0 flex-1 gap-0.5 text-white/50">
                {(
                  [
                    ["all", "全部"],
                    ["image", "图片"],
                    ["video", "视频"],
                    ["audio", "音频"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={assetLibraryTab === "project"}
                    className={cn(
                      "rounded px-2 py-0.5 transition disabled:opacity-35",
                      assetMediaFilter === key && assetLibraryTab === "imported"
                        ? "bg-white/10 text-white/85"
                        : "hover:text-white/70",
                    )}
                    onClick={() => setAssetMediaFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/20 px-2 py-1 text-[10px] text-white/80 transition hover:bg-white/10"
                onClick={onImportClick}
              >
                <Plus className="size-3" />
                导入
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {assetLibraryTab === "project" ? (
                projectLibraryClips.length > 0 ? (
                  <AssetGrid
                    clips={projectLibraryClips}
                    selectedId={selectedId}
                    onPick={setSelectedId}
                    showDuration
                  />
                ) : (
                  <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-white/12 px-3 text-center">
                    <p className="text-[11px] text-white/55">{projectAssetLibraryLabel}</p>
                    <p className="mt-2 text-[10px] leading-relaxed text-white/35">
                      连线进入自动成片的片段会出现在这里；也可从「已导入资产」上传本地视频。
                    </p>
                  </div>
                )
              ) : !isCanvasModule &&
                assetMediaFilter !== "all" &&
                assetMediaFilter !== "video" ? (
                <div className="flex h-full min-h-[200px] items-center justify-center px-2 text-center text-[10px] text-white/35">
                  当前仅支持导入视频；{assetMediaFilter === "image" ? "图片" : "音频"}筛选即将开放。
                </div>
              ) : visibleImportedTabClips.length > 0 ? (
                <AssetGrid
                  clips={visibleImportedTabClips}
                  selectedId={selectedId}
                  onPick={
                    isCanvasModule ? pickUpstreamLibraryClip : setSelectedId
                  }
                  audioPeaksByUrl={audioPeaksByUrl}
                  showDuration
                />
              ) : (
                <button
                  type="button"
                  className="flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-white/12 px-3 text-center transition hover:border-white/25 hover:bg-white/[0.03]"
                  onClick={onImportClick}
                >
                  <p className="text-[11px] text-white/45">
                    {isCanvasModule
                      ? "暂无连线素材"
                      : "将文件拖至此处添加"}
                  </p>
                  <p className="mt-1 text-[10px] text-white/30">
                    {isCanvasModule
                      ? "请从自动成片节点连入视频/音频，或使用右上角「导入」"
                      : "或点击使用右上角「导入」"}
                  </p>
                </button>
              )}
            </div>
          </aside>

          <div
            className={cn(
              COMPOSE_FS_SURFACE,
              "flex min-h-0 min-w-0 flex-1 flex-col bg-black",
            )}
          >
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
              {previewVideoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={previewVideoUrl}
                    className="max-h-full max-w-full rounded-md shadow-lg"
                    playsInline
                    controls={false}
                    onTimeUpdate={onProgramVideoTimeUpdate}
                  />
                  <audio
                    ref={audioRef}
                    className="sr-only"
                    preload="auto"
                    playsInline
                  />
                </>
              ) : (
                <p className="text-sm text-white/40">没有媒体可供预览</p>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[#141414] py-2.5">
              <button
                type="button"
                className="rounded-full p-2 hover:bg-white/10"
                onClick={() => {
                  const idx = ordered.findIndex((c) => c.id === selectedId);
                  if (idx > 0) setSelectedId(ordered[idx - 1]!.id);
                }}
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-40"
                disabled={!playbackVideoUrl && !selected?.videoUrl}
                onClick={toggleProgramPlay}
              >
                {playing ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="ml-0.5 size-5 fill-white" />
                )}
              </button>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-white/10"
                onClick={() => {
                  const idx = ordered.findIndex((c) => c.id === selectedId);
                  if (idx >= 0 && idx < ordered.length - 1) setSelectedId(ordered[idx + 1]!.id);
                }}
              >
                <ChevronRight className="size-5" />
              </button>
              <span className="text-[11px] tabular-nums text-white/50">
                {formatTimeSec(programPlayheadSec)} / {formatTimeSec(totalProgramSec)}
              </span>
            </div>
          </div>

          <aside
            className={cn(
              COMPOSE_FS_SURFACE,
              COMPOSE_FS_RIGHT_W,
              "flex min-h-0 flex-col overflow-hidden",
            )}
          >
            <ComposeRenderProfilePanel
              className="min-h-0 flex-1"
              layout="tabbed"
              profile={profile}
              disabled={!timelineReady}
              showBgmPresets
              bgmPresets={bgmPresets}
              onChange={(next) => setProfile(next)}
              clipSubtitle={
                ordered.length > 0 && selected
                  ? {
                      clipLabel: selected.label?.trim() || "未命名片段",
                      value: selected.subtitle ?? "",
                      selectedClipId: selected.id,
                      clipOptions: ordered.map((c, i) => ({
                        id: c.id,
                        label: c.label?.trim() || `片段 ${i + 1}`,
                      })),
                      onSelectClip: setSelectedId,
                      onChange: (subtitle) => {
                        onApplyWorkbench(
                          (prev) =>
                            updateComposeClip(prev, selected.id, {
                              subtitle: subtitle || undefined,
                            }),
                          { persist: true },
                        );
                      },
                    }
                  : null
              }
            />
          </aside>
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="拖动调整时间线高度"
          className="mx-3 flex h-3 shrink-0 cursor-ns-resize items-center justify-center touch-none"
          onPointerDown={startTimelineHeightDrag}
        >
          <span className="h-0.5 w-14 rounded-full bg-white/25" />
        </div>

        <section
          aria-label="剪辑时间线"
          className={cn(COMPOSE_FS_SURFACE, "flex min-h-[160px] shrink-0 flex-col overflow-hidden")}
          style={{ height: timelinePaneHeightPx, maxHeight: "55vh" }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2">
            <ComposeSequenceTrack
              clips={ordered}
              selectedId={selectedId}
              disabled={!timelineReady}
              trimStart={trimStart}
              trimEnd={trimEnd}
              filmstripByUrl={filmstripByUrl}
              fullDurationByUrl={fullDurationByUrl}
              audioPeaksByUrl={audioPeaksByUrl}
              programPlayheadSec={programPlayheadSec}
              totalProgramSec={totalProgramSec}
              onSelect={setSelectedId}
              onReorder={(from, to) =>
                applyWithUndo((prev) => moveComposeClip(prev, from, to), { persist: true })
              }
              onTrimStart={setTrimStart}
              onTrimEnd={setTrimEnd}
              onTrimCommit={commitClipRangeFromRefs}
              onSplit={() => void splitAtPlayhead()}
              onTrimLeft={() => void trimLeftAtPlayhead()}
              onTrimRight={() => void trimRightAtPlayhead()}
              onDelete={() => void deleteSelected()}
              onUndo={undoEdit}
              onProgramSeek={seekProgramTimeline}
              onImportClick={onImportClick}
              zoomable={trackChrome?.zoomable ?? true}
              clipLaneClassName="h-[4.5rem]"
              portraitFilmstrip
              trackChrome={trackChrome ?? { variant: "fullscreen", zoomable: true }}
              onClipAudioAttach={onClipAudioAttach}
              onClipAudioClear={onClipAudioClear}
              rootClassName="mb-0 flex h-full min-h-0 flex-col"
              scrollContainerClassName={cn(
                COMPOSE_FS_SCROLL_HIDE,
                "min-h-0 flex-1 rounded-lg border-white/10 bg-[#121212]",
              )}
              splitDisabled={!selected?.videoUrl || !timelineReady || !playheadInSelected}
              trimDisabled={!selected?.videoUrl || !timelineReady || !playheadInSelected}
              deleteDisabled={!selectedId || ordered.length <= 1}
              undoDisabled={undoDepth < 1}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function AssetGrid({
  clips,
  selectedId,
  onPick,
  addedIds,
  showDuration,
  audioPeaksByUrl,
}: {
  clips: ComposeWorkbenchClip[];
  selectedId: string | null;
  onPick: (id: string) => void;
  addedIds?: Set<string>;
  showDuration?: boolean;
  audioPeaksByUrl?: Record<string, number[]>;
}) {
  if (clips.length === 0) {
    return <p className="text-[10px] text-white/35">暂无</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-1">
      {clips.map((c) => {
        const audioOnly = isAudioOnlyLibraryClip(c);
        const visualUrl = libraryClipVisualUrl(c);
        const audioUrl = c.audioUrl?.trim();
        return (
          <button
            key={c.id}
            type="button"
            className={cn(
              "relative overflow-hidden rounded border text-left",
              selectedId === c.id ? "border-[#0071e3]" : "border-white/15",
            )}
            title={c.label?.trim() || undefined}
            onClick={() => onPick(c.id)}
          >
            {audioOnly ? (
              <div className="relative aspect-[9/16] w-full bg-[#0a1628]">
                <ComposeSegmentAudioWaveform
                  peaks={audioUrl ? audioPeaksByUrl?.[audioUrl] : undefined}
                  widthPx={72}
                  label={c.label?.trim() || "配音"}
                />
              </div>
            ) : visualUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={visualUrl}
                alt=""
                className="aspect-[9/16] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[9/16] w-full items-center justify-center bg-[#222] text-[10px] text-white/55">
                素材
              </div>
            )}
            {addedIds?.has(c.id) ? (
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[8px] text-white/80">
                已添加
              </span>
            ) : null}
            {showDuration && !audioOnly ? (
              <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1 text-[9px] tabular-nums text-white/90">
                {formatTimeSec(displayClipSpanSec(c))}
              </span>
            ) : audioOnly ? (
              <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1 text-[9px] text-sky-200/90">
                TTS
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
