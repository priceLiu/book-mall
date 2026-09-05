"use client";

import type { FilmPullAnalyzePatch } from "@/lib/film-pull-types";

type Props = {
  meta: FilmPullAnalyzePatch["meta"];
};

function displayMetaText(value: string | undefined | null): string {
  if (typeof value !== "string") return "--";
  const trimmed = value.trim();
  return trimmed || "--";
}

/** 拉片 meta · 只读键值（专业拉片 richer schema） */
export function FilmPullMetaSummary({ meta }: Props) {
  const totalDurationSec =
    typeof meta.totalDurationSec === "number" && Number.isFinite(meta.totalDurationSec)
      ? meta.totalDurationSec
      : null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "总时长", value: totalDurationSec != null ? `${totalDurationSec}s` : "--" },
    { label: "叙事主线", value: displayMetaText(meta.narrativeMainLine) },
    { label: "剪辑节奏曲线", value: displayMetaText(meta.editRhythmCurve) },
    { label: "美术风格", value: displayMetaText(meta.artStyle) },
    { label: "声音设计逻辑", value: displayMetaText(meta.audioDesignLogic) },
    { label: "镜头序列逻辑", value: displayMetaText(meta.shotSequenceLogic) },
    { label: "镜头语言总结", value: displayMetaText(meta.cameraLanguageSummary) },
  ];

  return (
    <section className="space-y-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">分镜总览</h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[11px] font-medium text-[#86868b]">{row.label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[#1d1d1f]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
