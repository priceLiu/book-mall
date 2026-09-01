"use client";

import { FilmPullAnalyzeSummarySections } from "@/components/film-pull/film-pull-analyze-summary-sections";
import { FilmPullShotTable } from "@/components/film-pull/film-pull-shot-table";
import type { FilmPullAnalyzePatch, FilmPullShot } from "@/lib/film-pull-types";

type Props = {
  structured: FilmPullAnalyzePatch;
  shots?: FilmPullShot[];
  editable?: boolean;
  onShotsChange?: (shots: FilmPullShot[]) => void;
};

export function FilmPullResultPanel({
  structured,
  shots,
  editable,
  onShotsChange,
}: Props) {
  const tableShots = shots ?? structured.shots;

  return (
    <div className="space-y-4">
      <FilmPullShotTable
        shots={tableShots}
        editable={editable}
        embedded
        onChange={onShotsChange}
      />
      <FilmPullAnalyzeSummarySections structured={structured} />
    </div>
  );
}
