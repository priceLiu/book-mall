"use client";

import type { Pro2ShotAnalysis } from "@/lib/canvas/data/pro2-production-script-schema";

export function formatPro2ShotTimingLabel(
  analysis?: Pro2ShotAnalysis | null,
): string {
  const t = analysis?.timing;
  if (!t) return "";
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${fmt(t.startTimeSec)}–${fmt(t.endTimeSec)}s`;
}

export function shotHasPro2Analysis(
  analysis?: Pro2ShotAnalysis | null,
): boolean {
  if (!analysis) return false;
  return Boolean(
    analysis.timing ||
      analysis.cut ||
      analysis.cinematography ||
      analysis.blocking ||
      analysis.look ||
      analysis.narrative ||
      analysis.audioInfo ||
      analysis.analysisDraftPrompt?.trim(),
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  const t = value?.trim();
  if (!t) return null;
  return (
    <p className="text-[11px] leading-relaxed text-neutral-600">
      <span className="font-medium text-neutral-700">{label}：</span>
      {t}
    </p>
  );
}

/** 导演表下折叠的拉片 analysis（只读） */
export function Pro2ShotAnalysisFold({
  analysis,
}: {
  analysis?: Pro2ShotAnalysis | null;
}) {
  if (!shotHasPro2Analysis(analysis)) return null;
  const a = analysis!;
  const timing = formatPro2ShotTimingLabel(a);
  return (
    <details className="mt-1 rounded-md border border-neutral-200 bg-neutral-50/80 px-2.5 py-1.5">
      <summary className="cursor-pointer select-none text-[11px] font-medium text-neutral-600">
        拉片详情
        {timing ? <span className="ml-1.5 font-normal text-neutral-400">{timing}</span> : null}
      </summary>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <Row label="切点" value={[a.cut?.transition, a.cut?.detail].filter(Boolean).join(" · ")} />
        <Row label="机位" value={a.cinematography?.cameraAngle} />
        <Row label="焦段" value={a.cinematography?.focalLength} />
        <Row label="构图" value={a.cinematography?.composition} />
        <Row label="调度" value={a.blocking?.subjectBlocking} />
        <Row label="视线" value={a.blocking?.sightDirection} />
        <Row label="层次" value={a.blocking?.foreMidBackLayer} />
        <Row label="场景环境" value={a.blocking?.sceneEnvironment} />
        <Row label="动态道具" value={a.blocking?.dynamicProps} />
        <Row label="布光" value={a.look?.lightingSetup} />
        <Row label="影调" value={a.look?.toneContrast} />
        <Row label="叙事功能" value={a.narrative?.function} />
        <Row label="节奏权重" value={a.narrative?.rhythmWeight} />
        <Row label="视觉隐喻" value={a.narrative?.visualMetaphor} />
        <Row label="字幕/台词" value={a.audioInfo?.scriptSubtitle} />
        <Row label="声线情绪" value={a.audioInfo?.vocalEmotion} />
        <Row label="环境声" value={a.audioInfo?.ambientSound} />
        <Row label="音效/BGM" value={a.audioInfo?.fxAndBgm} />
        <Row label="分析草稿" value={a.analysisDraftPrompt} />
      </div>
    </details>
  );
}
