"use client";

import { FilmPullAnalyzeSummarySections } from "@/components/film-pull/film-pull-analyze-summary-sections";
import { FilmPullMetaSummary } from "@/components/film-pull/film-pull-meta-summary";
import { FilmPullShotTable } from "@/components/film-pull/film-pull-shot-table";
import type { FilmPullAnalyzePatch } from "@/lib/film-pull-types";

type Props = {
  structured: FilmPullAnalyzePatch;
};

/** 拉片结果 · 只读展示完整 film-pull 结构（与拆解结果区同级） */
export function FilmPullResultPanel({ structured }: Props) {
  return (
    <div className="space-y-4">
      <FilmPullMetaSummary meta={structured.meta} />
      <FilmPullShotTable shots={structured.shots} embedded />
      <FilmPullAnalyzeSummarySections structured={structured} />
    </div>
  );
}
