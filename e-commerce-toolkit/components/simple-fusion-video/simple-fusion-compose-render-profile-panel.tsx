"use client";

import { useState, type ReactNode } from "react";

import { SubtitleBurnInFields } from "@private/media-render-subtitle-style/subtitle-burn-in-fields";
import {
  DEFAULT_SUBTITLE_STYLE,
  type SubtitleBurnInStyle,
} from "@private/media-render-subtitle-style/subtitle-style-options";

import type { EcomMediaRenderProfileInput } from "@/lib/ecom-storyboard-api";
import { DEFAULT_COMPOSE_PROFILE } from "@/lib/simple-fusion-compose-workbench";
import { SIMPLE_FUSION_BGM_PRESETS } from "@/lib/simple-fusion-default-prompts";

function FieldRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] text-white/45">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const selectClass =
  "h-8 w-full rounded-md border border-white/20 bg-black/35 px-2 text-[12px] text-white disabled:opacity-40";

type ComposeRenderProfileTab = "video" | "audio" | "subtitle";

const TABBED_NAV: { id: ComposeRenderProfileTab; label: string }[] = [
  { id: "video", label: "画面" },
  { id: "audio", label: "音频" },
  { id: "subtitle", label: "字幕" },
];

export type ComposeClipSubtitleEditor = {
  clipLabel: string;
  value: string;
  onChange: (subtitle: string) => void;
};

type Props = {
  profile: EcomMediaRenderProfileInput;
  onChange: (next: EcomMediaRenderProfileInput) => void;
  showBgmPresets?: boolean;
  disabled?: boolean;
  className?: string;
  layout?: "flat" | "tabbed";
  clipSubtitle?: ComposeClipSubtitleEditor | null;
};

export function SimpleFusionComposeRenderProfilePanel({
  profile,
  onChange,
  showBgmPresets = true,
  disabled = false,
  className = "",
  layout = "flat",
  clipSubtitle = null,
}: Props) {
  const [tab, setTab] = useState<ComposeRenderProfileTab>("video");

  const p = { ...DEFAULT_COMPOSE_PROFILE, ...profile };
  const subtitleMode =
    p.subtitle?.mode === "asr"
      ? "asr"
      : p.subtitle?.mode === "none"
        ? "none"
        : "script";
  const burnIn = p.subtitle?.burnIn ?? false;
  const style: SubtitleBurnInStyle = p.subtitle?.style ?? DEFAULT_SUBTITLE_STYLE;
  const vocalVolume = p.audio?.dialogueVolume ?? 0.95;
  const bgmFitTimeline = p.audio?.bgmFitTimeline !== false;

  const patch = (partial: EcomMediaRenderProfileInput) => {
    onChange({
      ...p,
      ...partial,
      subtitle: partial.subtitle
        ? { ...p.subtitle, ...partial.subtitle }
        : p.subtitle,
      audio: partial.audio ? { ...p.audio, ...partial.audio } : p.audio,
      video: partial.video ? { ...p.video, ...partial.video } : p.video,
      transition: partial.transition ?? p.transition,
    });
  };

  const scaleMode = p.video?.scaleMode ?? "fit1080p";
  const resolutionValue =
    scaleMode === "fit720p" ? "720p" : scaleMode === "source" ? "source" : "1080p";

  const scaleField = (
    <FieldRow label="比例">
      <select
        className={selectClass}
        disabled={disabled}
        value={scaleMode}
        onChange={(e) =>
          patch({
            video: {
              scaleMode: e.target.value as "fit1080p" | "fit720p" | "source",
            },
          })
        }
      >
        <option value="source">原视频比例</option>
        <option value="fit1080p">适配 1080P 长边</option>
        <option value="fit720p">适配 720P 长边</option>
      </select>
    </FieldRow>
  );

  const vocalField = (
    <FieldRow label="人声">
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="min-w-0 flex-1 accent-[#0a84ff]"
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          value={vocalVolume}
          onChange={(e) =>
            patch({
              audio: {
                ...p.audio,
                dialogueVolume: Number(e.target.value),
                mixTts: p.audio?.mixTts ?? true,
              },
            })
          }
        />
        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/55">
          {(vocalVolume * 100).toFixed(1)}
        </span>
      </div>
    </FieldRow>
  );

  const resolutionField = (
    <FieldRow label="分辨率">
      <select
        className={selectClass}
        disabled={disabled}
        value={resolutionValue}
        onChange={(e) => {
          const v = e.target.value;
          patch({
            video: {
              scaleMode:
                v === "720p" ? "fit720p" : v === "source" ? "source" : "fit1080p",
            },
          });
        }}
      >
        <option value="1080p">1080P</option>
        <option value="720p">720P</option>
        <option value="source">原片（不缩放）</option>
      </select>
    </FieldRow>
  );

  const transitionField = (
    <FieldRow label="转场">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${selectClass} max-w-[8.5rem]`}
          disabled={disabled}
          value={p.transition?.type === "none" ? "none" : "xfade"}
          onChange={(e) =>
            patch({
              transition:
                e.target.value === "none"
                  ? { type: "none" }
                  : {
                      type: "xfade",
                      durationSec:
                        p.transition?.type === "xfade"
                          ? p.transition.durationSec
                          : 0.6,
                    },
            })
          }
        >
          <option value="xfade">交叉淡化</option>
          <option value="none">无</option>
        </select>
        {p.transition?.type === "xfade" ? (
          <span className="text-[11px] tabular-nums text-white/45">
            {p.transition.durationSec}s
            <input
              type="range"
              className="ml-2 inline-block w-20 align-middle accent-[#0a84ff]"
              min={0.2}
              max={2}
              step={0.1}
              disabled={disabled}
              value={p.transition.durationSec}
              onChange={(e) =>
                patch({
                  transition: { type: "xfade", durationSec: Number(e.target.value) },
                })
              }
            />
          </span>
        ) : null}
      </div>
    </FieldRow>
  );

  const bgmBlock =
    showBgmPresets ? (
      <>
        <FieldRow label="背景音乐">
          <select
            className={selectClass}
            disabled={disabled}
            value={p.audio?.bgmPresetId ?? ""}
            onChange={(e) => {
              const bgmPresetId = e.target.value || undefined;
              patch({
                audio: {
                  ...p.audio,
                  bgmPresetId,
                  bgmUrl: undefined,
                  mixTts: p.audio?.mixTts ?? true,
                  bgmVolume: p.audio?.bgmVolume ?? 0.35,
                  dialogueVolume: p.audio?.dialogueVolume ?? 0.95,
                },
              });
            }}
          >
            <option value="">无 BGM</option>
            {SIMPLE_FUSION_BGM_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="BGM 音量">
          <input
            type="range"
            className="w-full accent-[#0a84ff]"
            min={0}
            max={1}
            step={0.05}
            disabled={disabled || !p.audio?.bgmPresetId}
            value={p.audio?.bgmVolume ?? 0.35}
            onChange={(e) =>
              patch({
                audio: {
                  ...p.audio,
                  bgmVolume: Number(e.target.value),
                },
              })
            }
          />
        </FieldRow>

        <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-white/55">
          <input
            type="checkbox"
            className="mt-0.5 size-3.5 shrink-0 rounded border-white/30"
            disabled={disabled || !p.audio?.bgmPresetId}
            checked={bgmFitTimeline}
            onChange={(e) =>
              patch({
                audio: { ...p.audio, bgmFitTimeline: e.target.checked },
              })
            }
          />
          自适应调整背景音乐长度（智能截取）
        </label>
      </>
    ) : null;

  const subtitleBurnIn = (
    <SubtitleBurnInFields
      variant="canvas-dark"
      density="compact"
      showPreview
      previewSampleText="卡点成片"
      disabled={disabled}
      burnIn={burnIn}
      onBurnInChange={(value) =>
        patch({
          subtitle: {
            ...p.subtitle,
            burnIn: value,
            mode: value && subtitleMode === "none" ? "script" : p.subtitle?.mode,
          },
        })
      }
      subtitleMode={subtitleMode === "asr" ? "asr" : "script"}
      showSubtitleMode
      onSubtitleModeChange={(mode) =>
        patch({
          subtitle: {
            ...p.subtitle,
            mode,
            burnIn: mode === "none" ? false : burnIn,
          },
        })
      }
      style={style}
      onStyleChange={(nextStyle) =>
        patch({
          subtitle: { ...p.subtitle, style: nextStyle },
        })
      }
      burnInLabel="烧录字幕到成片"
    />
  );

  const clipSubtitleBlock =
    layout === "tabbed" ? (
      clipSubtitle ? (
        <div className="space-y-1.5 border-t border-white/10 pt-4">
          <p className="text-[11px] font-medium text-white/55">当前片段台词</p>
          <p className="text-[10px] text-white/35">
            {clipSubtitle.clipLabel.trim() || "未命名片段"} · script 烧录
          </p>
          <textarea
            className="h-20 w-full resize-none rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-[11px] text-white placeholder:text-white/30"
            placeholder="该段台词（可选）"
            value={clipSubtitle.value}
            disabled={disabled}
            onChange={(e) => clipSubtitle.onChange(e.target.value)}
          />
        </div>
      ) : (
        <p className="border-t border-white/10 pt-4 text-[11px] text-white/40">
          在时间线选中片段后，可在此编辑该段台词。
        </p>
      )
    ) : null;

  if (layout === "flat") {
    return (
      <div className={`space-y-4 ${className}`}>
        <p className="text-xs font-medium text-white/80">合成参数</p>
        {scaleField}
        {vocalField}
        {resolutionField}
        {transitionField}
        {bgmBlock}
        <div className="border-t border-white/10 pt-3">{subtitleBurnIn}</div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex shrink-0 border-b border-white/10 text-[11px]">
        {TABBED_NAV.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`flex-1 px-2 py-2.5 transition ${
              tab === id ? "font-medium text-white" : "text-white/45 hover:text-white/70"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="shrink-0 border-b border-white/10 px-3 py-1.5 text-[10px] text-white/40">
        修改后点顶部「导出」生效
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {tab === "video" ? (
          <div className="space-y-4">
            {scaleField}
            {resolutionField}
            {transitionField}
          </div>
        ) : null}
        {tab === "audio" ? (
          <div className="space-y-4">
            {vocalField}
            {bgmBlock}
          </div>
        ) : null}
        {tab === "subtitle" ? (
          <div className="space-y-4">
            {subtitleBurnIn}
            {clipSubtitleBlock}
          </div>
        ) : null}
      </div>
    </div>
  );
}
