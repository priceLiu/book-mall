"use client";

import { ChevronDown, ChevronUp, HelpCircle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { updateMainImageHitReplicaProject } from "@/lib/ecom-main-image-hit-replica-api";
import {
  MAIN_IMAGE_HIT_REPLICA_CATEGORY_OPTIONS,
  type MainImageHitReplicaCategory,
  type MainImageHitReplicaDegree,
  type MainImageHitReplicaProject,
} from "@/lib/main-image-hit-replica-types";
import {
  hitReplicaBuildImageGenSize,
  MAIN_IMAGE_HIT_REPLICA_LANGUAGE_OPTIONS,
  MAIN_IMAGE_HIT_REPLICA_RATIO_OPTIONS,
  MAIN_IMAGE_HIT_REPLICA_RESOLUTION_OPTIONS,
  type MainImageHitReplicaOutputResolution,
} from "@/lib/main-image-hit-replica-settings";
import { cn } from "@/lib/utils";

type Props = {
  project: MainImageHitReplicaProject;
  disabled?: boolean;
  replicating?: boolean;
  onProjectChange: () => void | Promise<void>;
};

export function MainImageHitReplicaConfigSidebar({
  project,
  disabled,
  replicating,
  onProjectChange,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [globalReq, setGlobalReq] = useState(project.settings.globalRequirements ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGlobalReq(project.settings.globalRequirements ?? "");
  }, [project.id, project.settings.globalRequirements]);

  const persistSettings = useCallback(
    async (patch: Partial<MainImageHitReplicaProject["settings"]>) => {
      setSaving(true);
      try {
        const merged = { ...project.settings, ...patch };
        const withGenSize = patch.imageRatio || patch.outputResolution
          ? {
              ...patch,
              imageGenSize: hitReplicaBuildImageGenSize(
                merged.imageRatio,
                merged.outputResolution ?? "2K",
              ),
            }
          : patch;
        await updateMainImageHitReplicaProject(project.id, {
          settings: withGenSize,
        });
        await onProjectChange();
      } finally {
        setSaving(false);
      }
    },
    [onProjectChange, project.id, project.settings],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 py-4">
      <div className="mb-4">
        <p className="mb-2 text-[11px] font-semibold text-[var(--ecom-ink)]">复刻类型</p>
        <div className="grid grid-cols-2 gap-2">
          {MAIN_IMAGE_HIT_REPLICA_CATEGORY_OPTIONS.map((opt) => {
            const selected = project.settings.replicaCategory === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || replicating}
                className={cn(
                  "rounded-lg border px-2 py-2 text-left text-[11px] leading-snug transition-colors",
                  selected
                    ? "border-[var(--ecom-ink)] bg-[#fafafa] text-[var(--ecom-ink)] ring-2 ring-[var(--ecom-ink)]/15"
                    : "border-[var(--ecom-divider)] bg-white text-[#424245] hover:border-[var(--ecom-border-soft)]",
                )}
                onClick={() => void persistSettings({ replicaCategory: opt.id })}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-[11px] font-semibold text-[var(--ecom-ink)]">复刻程度</p>
        <div className="grid gap-2">
          {(
            [
              {
                id: "style_reference" as MainImageHitReplicaDegree,
                title: "参考风格",
                desc: "参考整体风格与结构，色彩与场景可自动调整并重构。",
              },
              {
                id: "high_fidelity" as MainImageHitReplicaDegree,
                title: "高度复刻",
                desc: "参考视觉结构，替换产品与文案；场景细节可略有差异。",
              },
            ] as const
          ).map((opt) => {
            const selected = project.settings.replicaDegree === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || replicating}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors",
                  selected
                    ? "border-[var(--ecom-ink)] bg-[#fafafa] ring-2 ring-[var(--ecom-ink)]/15"
                    : "border-[var(--ecom-divider)] bg-white hover:border-[var(--ecom-border-soft)]",
                )}
                onClick={() => void persistSettings({ replicaDegree: opt.id })}
              >
                <p className="text-[11px] font-semibold text-[var(--ecom-ink)]">{opt.title}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--ecom-subtle)]">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-[11px] font-semibold text-[var(--ecom-ink)]">
          统一复刻要求
          <span className="ml-1 font-normal text-[var(--ecom-subtle)]">（选填）</span>
        </p>
        <textarea
          className="min-h-[5.5rem] w-full resize-y rounded-lg border border-[var(--ecom-divider)] bg-white px-2.5 py-2 text-[11px] text-[var(--ecom-ink)] placeholder:text-[var(--ecom-subtle)] focus:border-[var(--ecom-chrome-accent)] focus:outline-none"
          placeholder="例如：参考图文案保持不变，模特完全不变，场景不变仅替换产品"
          value={globalReq}
          disabled={disabled || replicating}
          onChange={(e) => setGlobalReq(e.target.value)}
          onBlur={() => {
            if (globalReq.trim() === (project.settings.globalRequirements ?? "").trim()) return;
            void persistSettings({ globalRequirements: globalReq.trim() });
          }}
        />
      </div>

      <label className="mb-3 flex cursor-pointer items-center gap-2 text-[11px] text-[var(--ecom-ink)]">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 shrink-0 rounded border-[var(--ecom-border-soft)] text-[var(--ecom-chrome-accent)] focus:ring-[var(--ecom-chrome-accent)]"
          checked={project.settings.keepOutputStyleConsistent !== false}
          disabled={disabled || replicating}
          onChange={(e) =>
            void persistSettings({ keepOutputStyleConsistent: e.target.checked })
          }
        />
        <span className="flex min-w-0 flex-1 items-center gap-1">
          输出风格保持一致
          <HitReplicaHelpTip ariaLabel="输出风格保持一致说明">
            开启后，多张参考图复刻时统一色调、字体气质与光影基调，成片更像同一套店铺主图；关闭则每张仅按各自参考图独立处理。
          </HitReplicaHelpTip>
        </span>
      </label>

      <div className="mb-4 rounded-xl border border-[var(--ecom-divider)] bg-[#fafafa]">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold text-[var(--ecom-ink)]"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          生成设置
          {settingsOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-[var(--ecom-subtle)]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-[var(--ecom-subtle)]" />
          )}
        </button>
        {settingsOpen ? (
          <div className="space-y-3 border-t border-[var(--ecom-divider)] px-3 py-3">
            <div className="grid grid-cols-3 gap-2">
              <HitReplicaInlineSelect
                ariaLabel="语言"
                value={project.settings.language}
                disabled={disabled || replicating}
                options={MAIN_IMAGE_HIT_REPLICA_LANGUAGE_OPTIONS}
                onChange={(v) => void persistSettings({ language: v })}
              />
              <HitReplicaInlineSelect
                ariaLabel="参考图比例"
                value={project.settings.imageRatio}
                disabled={disabled || replicating}
                options={MAIN_IMAGE_HIT_REPLICA_RATIO_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                onChange={(v) =>
                  void persistSettings({
                    imageRatio: v as MainImageHitReplicaProject["settings"]["imageRatio"],
                  })
                }
              />
              <HitReplicaInlineSelect
                ariaLabel="清晰度"
                value={project.settings.outputResolution ?? "2K"}
                disabled={disabled || replicating}
                options={MAIN_IMAGE_HIT_REPLICA_RESOLUTION_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                onChange={(v) =>
                  void persistSettings({
                    outputResolution: v as MainImageHitReplicaOutputResolution,
                  })
                }
              />
            </div>
          </div>
        ) : null}
      </div>

      {saving || replicating ? (
        <p className="mt-auto flex items-center gap-2 text-[10px] text-[var(--ecom-subtle)]">
          <Loader2 className="h-3 w-3 animate-spin" />
          {replicating ? "复刻进行中…" : "保存设置…"}
        </p>
      ) : null}
    </div>
  );
}

function HitReplicaHelpTip({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: string;
}) {
  return (
    <span className="group relative inline-flex shrink-0 align-middle">
      <span className="cursor-help text-[var(--ecom-subtle)] hover:text-[var(--ecom-muted)]" aria-label={ariaLabel}>
        <HelpCircle className="h-3.5 w-3.5" />
      </span>
      <span
        className="pointer-events-none absolute left-0 top-full z-[100] mt-1.5 hidden w-[min(280px,calc(100vw-2rem))] rounded-lg border border-[var(--ecom-border-soft)] bg-[var(--ecom-ink)] p-2.5 text-left text-[10px] leading-relaxed text-white shadow-lg group-hover:block"
        role="tooltip"
      >
        {children}
      </span>
    </span>
  );
}

function HitReplicaInlineSelect({
  ariaLabel,
  value,
  options,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <div className="relative min-w-0">
      <select
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        value={value}
        className={cn(
          "w-full min-w-0 appearance-none truncate rounded-lg border border-[var(--ecom-divider)] bg-white py-2 pl-2.5 pr-7 text-[11px] text-[var(--ecom-ink)]",
          "focus:border-[var(--ecom-chrome-accent)] focus:outline-none",
          disabled && "opacity-50",
        )}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ecom-subtle)]"
        aria-hidden
      />
      {!selected ? (
        <span className="sr-only">{ariaLabel}</span>
      ) : null}
    </div>
  );
}