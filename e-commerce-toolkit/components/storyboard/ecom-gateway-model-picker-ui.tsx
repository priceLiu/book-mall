"use client";

/**
 * 电商 Gateway 模型选择 · 卡片列表 UI（与 StoryboardModelPickerDialog 图2 对齐，全站共用）
 */

import { Check } from "lucide-react";

import {
  imagePickerUsesAspectRatioOnly,
} from "@/lib/storyboard-image-size-options";
import {
  formatStoryboardModelRefCountLabel,
} from "@/lib/storyboard-model-ref-count";
import {
  storyboardModelFilterTabsForMode,
  storyboardModelMatchesMediaFilter,
  type StoryboardModelMediaFilter,
} from "@/lib/storyboard-model-type-filter";
import {
  isStoryboardBailianR2vModel,
  isStoryboardWan30VideoModel,
  isStoryboardWanR2vModel,
  resolveStoryboardVideoFullSheetDurationRange,
  resolveStoryboardVideoPanelDurationRange,
  videoModelSupportsGenerateAudio,
} from "@/lib/storyboard-video-params";
import { formatStoryboardImageModelTypeLabel } from "@/lib/storyboard-image-model-type";
import { formatStoryboardVideoModelTypeLabel } from "@/lib/storyboard-video-model-type";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

export type EcomGatewayPickerMode = "image" | "video" | "chat";

export function countGatewayModelAdjustableParams(
  mode: EcomGatewayPickerMode,
  modelKey: string,
  videoTarget: "panel" | "fullSheet",
  lockedRatio?: boolean,
): number {
  if (mode === "chat") return 0;
  if (mode === "image") {
    if (lockedRatio) return 1;
    return imagePickerUsesAspectRatioOnly(modelKey) ? 1 : 2;
  }
  let n = 2;
  const isBailianR2v = isStoryboardBailianR2vModel(modelKey);
  if (isStoryboardWan30VideoModel(modelKey)) {
    n += 1;
    return n;
  }
  if (isBailianR2v) {
    n += 2;
    if (isStoryboardWanR2vModel(modelKey)) n += 1;
  } else {
    n += 1;
  }
  if (videoModelSupportsGenerateAudio(modelKey)) n += 1;
  void videoTarget;
  return n;
}

function roleBadgeTone(role: string): string {
  switch (role) {
    case "IMAGE":
      return "bg-[#fff4e5] text-[#b25e09]";
    case "VIDEO":
      return "bg-[#e8f1ff] text-[#0058c7]";
    case "LLM":
      return "bg-[#eef0f2] text-[#1d1d1f]";
    default:
      return "bg-[#eef0f2] text-[#6e6e73]";
  }
}

function modelVideoDurationLabel(
  mode: EcomGatewayPickerMode,
  modelKey: string,
  videoTarget: "panel" | "fullSheet",
): string | null {
  if (mode !== "video") return null;
  const range =
    videoTarget === "panel"
      ? resolveStoryboardVideoPanelDurationRange(modelKey)
      : resolveStoryboardVideoFullSheetDurationRange(modelKey);
  return `时长 ${range.label}`;
}

function modelRefCountLabel(mode: EcomGatewayPickerMode, modelKey: string): string {
  if (mode === "chat") return "文本 / 多模态对话";
  return formatStoryboardModelRefCountLabel(modelKey, mode);
}

function modelTypeLabel(mode: EcomGatewayPickerMode, model: StoryboardGatewayModel): string {
  if (mode === "chat") {
    if (model.role === "LLM") return "文本模型";
    return model.role || "助手";
  }
  if (mode === "video") return formatStoryboardVideoModelTypeLabel(model.modelKey);
  return formatStoryboardImageModelTypeLabel(model.modelKey, model.role);
}

export function EcomGatewayModelCard({
  model,
  selected,
  paramCount,
  durationLabel,
  mode,
  onSelect,
}: {
  model: StoryboardGatewayModel;
  selected: boolean;
  paramCount: number;
  durationLabel?: string | null;
  mode: EcomGatewayPickerMode;
  onSelect: () => void;
}) {
  const disabled = !model.credentialBound && !model.platformOffering;
  const typeLabel = modelTypeLabel(mode, model);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full min-h-[4.75rem] flex-row items-stretch gap-4 rounded-xl border px-4 py-3 text-left transition",
        selected
          ? "border-[var(--ecom-outline-border)] bg-[#f0f6ff] shadow-sm"
          : "border-[#e8e8ed] bg-white hover:border-[#c7c7cc] hover:bg-[#fafafa]",
        disabled && "cursor-not-allowed opacity-50 hover:border-[#e8e8ed] hover:bg-white",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-semibold text-[#1d1d1f]">
            {model.displayName || model.modelKey}
          </p>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              roleBadgeTone(model.role),
            )}
            title={typeLabel}
          >
            {typeLabel}
          </span>
          {model.sourceLabel ? (
            <span className="shrink-0 rounded bg-[#eef0f2] px-1.5 py-0.5 text-[10px] text-[#6e6e73]">
              {model.sourceLabel}
            </span>
          ) : null}
        </div>
        <p className="truncate font-mono text-[11px] text-[#86868b]">{model.modelKey}</p>
        {model.description ? (
          <p className="line-clamp-1 text-[11px] leading-relaxed text-[#6e6e73]">
            {model.description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center gap-1 text-right">
        <span className="text-[10px] text-[#a1a1a6]">
          {modelRefCountLabel(mode, model.modelKey)}
          {durationLabel ? ` · ${durationLabel}` : ""}
          {mode !== "chat"
            ? ` · ${paramCount > 0 ? `${paramCount} 项可调参数` : "无可调参数"}`
            : null}
        </span>
        {disabled ? <span className="text-[10px] text-[#c0392b]">未绑定</span> : null}
      </div>
      {selected ? (
        <span className="absolute right-3 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-full bg-[var(--ecom-primary)] text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </button>
  );
}

export function EcomGatewayModelMediaFilterBar({
  mode,
  models,
  value,
  onChange,
}: {
  mode: Exclude<EcomGatewayPickerMode, "chat">;
  models: StoryboardGatewayModel[];
  value: StoryboardModelMediaFilter;
  onChange: (next: StoryboardModelMediaFilter) => void;
}) {
  const tabs = storyboardModelFilterTabsForMode(mode);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#f0f0f2] pb-3">
      <span className="text-[11px] font-medium text-[#86868b]">类型</span>
      {tabs.map((tab) => {
        const count = models.filter((m) =>
          storyboardModelMatchesMediaFilter(m, mode, tab.id),
        ).length;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.id !== "all" && count === 0}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] font-medium transition",
              active
                ? "border-[var(--ecom-outline-border)] bg-[#f0f6ff] text-[var(--ecom-primary)]"
                : "border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[#c7c7cc] hover:bg-[#fafafa]",
              tab.id !== "all" && count === 0 && "cursor-not-allowed opacity-40 hover:bg-white",
            )}
          >
            {tab.label}
            {tab.id !== "all" && count > 0 ? (
              <span className="ml-1 tabular-nums text-[11px] opacity-80">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function buildEcomGatewayModelGroups(
  models: StoryboardGatewayModel[],
  visibleModels: StoryboardGatewayModel[],
): { kind: string; models: StoryboardGatewayModel[] }[] {
  const platformFlat = models.some((m) => m.platformOffering);
  const groups: { kind: string; models: StoryboardGatewayModel[] }[] = [];
  if (platformFlat) {
    groups.push({ kind: "platform", models: visibleModels });
  } else {
    for (const m of visibleModels) {
      const kind = m.sourceLabel?.trim() || m.providerKind || "UNKNOWN";
      let g = groups.find((x) => x.kind === kind);
      if (!g) {
        g = { kind, models: [] };
        groups.push(g);
      }
      g.models.push(m);
    }
  }
  return groups;
}

export type EcomGatewayModelGroupedListProps = {
  mode: EcomGatewayPickerMode;
  models: StoryboardGatewayModel[];
  visibleModels: StoryboardGatewayModel[];
  selectedKey: string;
  onSelect: (modelKey: string) => void;
  hideTypeFilter?: boolean;
  mediaFilter: StoryboardModelMediaFilter;
  onMediaFilterChange: (next: StoryboardModelMediaFilter) => void;
  videoTarget?: "panel" | "fullSheet";
  lockedImageSizeLabel?: string;
  filterEmpty: boolean;
};

/** 图2 左侧模型卡片列表（弹层内嵌 / 设置面板共用） */
export function EcomGatewayModelGroupedList({
  mode,
  models,
  visibleModels,
  selectedKey,
  onSelect,
  hideTypeFilter,
  mediaFilter,
  onMediaFilterChange,
  videoTarget = "fullSheet",
  lockedImageSizeLabel,
  filterEmpty,
}: EcomGatewayModelGroupedListProps) {
  const groups = buildEcomGatewayModelGroups(models, visibleModels);
  return (
    <div className="space-y-4">
      {!hideTypeFilter && mode !== "chat" ? (
        <EcomGatewayModelMediaFilterBar
          mode={mode}
          models={models}
          value={mediaFilter}
          onChange={onMediaFilterChange}
        />
      ) : null}
      {filterEmpty ? (
        <p className="rounded-xl border border-dashed border-[#e8e8ed] px-4 py-10 text-center text-sm text-[#86868b]">
          当前筛选下暂无模型，请切换类型或选择「全部」。
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.kind}>
            {!models.some((m) => m.platformOffering) ? (
              <header className="mb-2 flex items-center gap-2">
                <h3 className="text-[12px] font-semibold text-[#1d1d1f]">{g.kind}</h3>
              </header>
            ) : null}
            <div className="flex flex-col gap-2">
              {g.models.map((m) => (
                <EcomGatewayModelCard
                  key={m.modelKey}
                  model={m}
                  mode={mode}
                  selected={m.modelKey === selectedKey}
                  paramCount={countGatewayModelAdjustableParams(
                    mode,
                    m.modelKey,
                    videoTarget,
                    Boolean(lockedImageSizeLabel),
                  )}
                  durationLabel={modelVideoDurationLabel(mode, m.modelKey, videoTarget)}
                  onSelect={() => onSelect(m.modelKey)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}