"use client";

import { useMemo } from "react";

import type {
  DetailPageSuiteExportTarget,
  DetailPageSuiteSettings,
} from "@/lib/detail-page-suite-types";
import {
  DETAIL_PAGE_EXPORT_PRESETS,
  ensureExportTargets,
  heightPxForTarget,
  mergePresetIntoTargets,
  resolveActiveExportTargetIds,
} from "@/lib/detail-page-suite-export-targets";

type Props = {
  settings: DetailPageSuiteSettings;
  briefPlatformCode?: string | null;
  disabled?: boolean;
  onChange: (patch: {
    exportTargets: DetailPageSuiteExportTarget[];
    activeExportTargetIds: string[];
  }) => void;
};

export function DetailPageSuiteExportTargetsBar({
  settings,
  briefPlatformCode,
  disabled,
  onChange,
}: Props) {
  const targets = useMemo(
    () => ensureExportTargets(settings, briefPlatformCode),
    [settings, briefPlatformCode],
  );
  const activeIds = useMemo(
    () => new Set(resolveActiveExportTargetIds(settings, briefPlatformCode)),
    [settings, briefPlatformCode],
  );

  const toggleActive = (id: string) => {
    const next = new Set(activeIds);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange({
      exportTargets: targets,
      activeExportTargetIds: [...next],
    });
  };

  const addPreset = (platformCode: string) => {
    const merged = mergePresetIntoTargets(targets, platformCode);
    const added = merged.find((t) => !targets.some((x) => x.id === t.id));
    onChange({
      exportTargets: merged,
      activeExportTargetIds: added ? [...activeIds, added.id] : [...activeIds],
    });
  };

  const addCustom = () => {
    const id = `custom-${Date.now()}`;
    const custom: DetailPageSuiteExportTarget = {
      id,
      platformCode: "custom",
      label: "自定义",
      ratio: "3:4",
      widthPx: 750,
      customHeightPx: 1000,
    };
    onChange({
      exportTargets: [...targets, custom],
      activeExportTargetIds: [...activeIds, id],
    });
  };

  const updateTarget = (id: string, patch: Partial<DetailPageSuiteExportTarget>) => {
    onChange({
      exportTargets: targets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      activeExportTargetIds: [...activeIds],
    });
  };

  const presetCodes = new Set(targets.map((t) => t.platformCode));

  return (
    <div className="mb-3 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2">
      <p className="mb-2 text-[11px] font-medium text-[#424245]">
        出图平台规格（可多选，将对每个勾选点位按平台各出一版）
      </p>
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => {
          const checked = activeIds.has(t.id);
          const h = heightPxForTarget(t);
          return (
            <div
              key={t.id}
              className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${
                checked ? "border-[#0071e3] bg-[#f0f6ff]" : "border-[#d2d2d7] bg-white"
              }`}
            >
              <label className="flex cursor-pointer items-center gap-1 font-medium text-[#1d1d1f]">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleActive(t.id)}
                />
                {t.label}
              </label>
              <span className="text-[#86868b]">{t.ratio}</span>
              <label className="flex items-center gap-0.5 text-[#6e6e73]">
                宽
                <input
                  type="number"
                  min={320}
                  max={4096}
                  disabled={disabled}
                  className="w-14 rounded border border-[#d2d2d7] px-1 py-0"
                  value={t.widthPx}
                  onChange={(e) =>
                    updateTarget(t.id, { widthPx: Number(e.target.value) || t.widthPx })
                  }
                />
              </label>
              <label className="flex items-center gap-0.5 text-[#6e6e73]">
                高
                <input
                  type="number"
                  min={320}
                  max={8192}
                  disabled={disabled}
                  className="w-14 rounded border border-[#d2d2d7] px-1 py-0"
                  value={t.customHeightPx ?? h}
                  onChange={(e) =>
                    updateTarget(t.id, {
                      customHeightPx: Number(e.target.value) || h,
                    })
                  }
                />
              </label>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {DETAIL_PAGE_EXPORT_PRESETS.filter((p) => !presetCodes.has(p.platformCode)).map((p) => (
          <button
            key={p.platformCode}
            type="button"
            disabled={disabled}
            className="rounded border border-dashed border-[#d2d2d7] px-2 py-0.5 text-[10px] text-[#6e6e73] hover:border-[#0071e3] hover:text-[#0071e3]"
            onClick={() => addPreset(p.platformCode)}
          >
            + {p.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          className="rounded border border-dashed border-[#d2d2d7] px-2 py-0.5 text-[10px] text-[#6e6e73] hover:border-[#0071e3] hover:text-[#0071e3]"
          onClick={addCustom}
        >
          + 自定义
        </button>
      </div>
    </div>
  );
}
