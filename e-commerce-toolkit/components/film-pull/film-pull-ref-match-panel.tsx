"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  autoFilmPullRefMatch,
  patchFilmPullRefMatchShot,
} from "@/lib/ecom-film-pull-api";
import { isFilmPullMockDevUiEnabled } from "@/lib/film-pull-mock-dev";
import {
  filmPullAnalyzeShots,
  isFilmPullProductionScriptConfirmed,
  type FilmPullBottomDockMode,
} from "@/lib/film-pull-production-workflow";
import {
  listFilmPullModelRefs,
  listFilmPullProductRefs,
} from "@/lib/film-pull-refs";
import type { FilmPullProject, FilmPullRefMatchShot } from "@/lib/film-pull-types";

type Props = {
  project: FilmPullProject;
  busy?: boolean;
  onProjectUpdated: (project: FilmPullProject) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

function RefThumb({ url, label }: { url: string; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label ?? ""} className="h-10 w-10 rounded object-cover ring-1 ring-[#e8e8ed]" />
      {label ? <span className="max-w-[3rem] truncate text-[9px] text-[#6e6e73]">{label}</span> : null}
    </div>
  );
}

function RefToggleGroup({
  refs,
  selectedIds,
  disabled,
  onChange,
}: {
  refs: Array<{ id: string; ossUrl: string; label?: string }>;
  selectedIds: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {refs.map((ref) => {
        const active = selectedIds.includes(ref.id);
        return (
          <button
            key={ref.id}
            type="button"
            disabled={disabled}
            className={`rounded-lg p-0.5 ring-2 transition ${active ? "ring-[#0071e3]" : "ring-transparent opacity-60 hover:opacity-100"}`}
            onClick={() => {
              const next = active
                ? selectedIds.filter((id) => id !== ref.id)
                : [...selectedIds, ref.id];
              onChange(next);
            }}
          >
            <RefThumb url={ref.ossUrl} label={ref.label} />
          </button>
        );
      })}
    </div>
  );
}

export function FilmPullRefMatchPanel({ project, busy, onProjectUpdated, onAlert }: Props) {
  const [actionBusy, setActionBusy] = useState(false);
  const refMatch = project.refMatch;
  const modelRefs = listFilmPullModelRefs(project.characterRefs);
  const productRefs = listFilmPullProductRefs(project.characterRefs);
  const analyzeShots = filmPullAnalyzeShots(project);
  const scriptConfirmed = isFilmPullProductionScriptConfirmed(project);
  const locked = busy || actionBusy || scriptConfirmed;

  const patchShot = useCallback(
    async (shotNo: number, patch: Partial<FilmPullRefMatchShot>) => {
      setActionBusy(true);
      try {
        onProjectUpdated(
          await patchFilmPullRefMatchShot(project.id, shotNo, {
            modelRefIds: patch.modelRefIds,
            productRefIds: patch.productRefIds,
          }),
        );
      } catch (e) {
        await onAlert({
          title: "更新失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setActionBusy(false);
      }
    },
    [onAlert, onProjectUpdated, project.id],
  );

  async function handleAutoMatch(mock = false) {
    setActionBusy(true);
    try {
      onProjectUpdated(await autoFilmPullRefMatch(project.id, mock));
    } catch (e) {
      await onAlert({
        title: "自动匹配失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActionBusy(false);
    }
  }

  if (!refMatch?.shots.length) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">参考图匹配</h2>
          <p className="text-[11px] text-[#6e6e73]">
            系统已按分镜自动分配模特/产品 ref，可直接改选；与下方制作脚本一并确认即可。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!scriptConfirmed ? (
            <>
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={locked || modelRefs.length === 0}
                onClick={() => void handleAutoMatch(false)}
              >
                {actionBusy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                )}
                重新自动匹配
              </EcomButtonSecondary>
              {isFilmPullMockDevUiEnabled() ? (
                <EcomButtonSecondary size="sm" type="button" disabled={locked} onClick={() => void handleAutoMatch(true)}>
                  Mock 匹配
                </EcomButtonSecondary>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-[#6e6e73]">脚本已确认，参考图已锁定</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#e8e8ed] text-left text-[#6e6e73]">
              <th className="px-2 py-2 font-medium">镜号</th>
              <th className="px-2 py-2 font-medium">时间</th>
              <th className="px-2 py-2 font-medium">模特 ref</th>
              <th className="px-2 py-2 font-medium">产品 ref</th>
            </tr>
          </thead>
          <tbody>
            {analyzeShots.map((analyzeShot) => {
              const match = refMatch.shots.find((s) => s.shotNo === analyzeShot.shotNo);
              if (!match) return null;
              return (
                <tr key={analyzeShot.shotNo} className="border-b border-[#f0f0f2] align-top">
                  <td className="px-2 py-2 font-medium text-[#1d1d1f]">{analyzeShot.shotNo}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-[#6e6e73]">
                    {analyzeShot.startTimeSec.toFixed(1)}–{analyzeShot.endTimeSec.toFixed(1)}s
                  </td>
                  <td className="px-2 py-2">
                    <RefToggleGroup
                      refs={modelRefs}
                      selectedIds={match.modelRefIds}
                      disabled={locked}
                      onChange={(ids) => void patchShot(analyzeShot.shotNo, { modelRefIds: ids })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <RefToggleGroup
                      refs={productRefs}
                      selectedIds={match.productRefIds}
                      disabled={locked}
                      onChange={(ids) => void patchShot(analyzeShot.shotNo, { productRefIds: ids })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { FilmPullBottomDockMode };
