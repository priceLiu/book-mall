"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Cog, ExternalLink, Sparkles, X } from "lucide-react";

import { useUserProviders } from "@/lib/canvas/use-user-providers";
import type {
  CanvasProviderDto,
  CanvasProviderModelDto,
} from "@/lib/canvas-providers-api";
import {
  DynamicParamForm,
  buildModelParams,
} from "./dynamic-param-form";

export type EnginePickerProps = {
  /** 过滤模型 role：LLM / IMAGE / VIDEO */
  role: "LLM" | "IMAGE" | "VIDEO";
  /** 仅展示这些 modelKey（三视图引擎白名单等） */
  allowedModelKeys?: string[];
  /** 当前选中 */
  providerId: string;
  modelKey: string;
  /** 当前参数 */
  params?: Record<string, unknown>;
  /** 选择回调（含 params） */
  onChange: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
    model: CanvasProviderModelDto | null;
    provider: CanvasProviderDto | null;
  }) => void;
};

/* 须高于 story-engine-actions-modal (1090) 等嵌套宿主 */
const ENGINE_PICKER_MODAL_Z = 1200;

/**
 * - 触发按钮显示当前选中
 * - 弹层：模型卡片 → 下方动态参数（分段按钮 / 滑条 / 复选框）
 * - 确认后写回节点
 */
export function EnginePicker({
  role,
  allowedModelKeys,
  providerId,
  modelKey,
  params = {},
  onChange,
}: EnginePickerProps) {
  const { providers, loading } = useUserProviders();
  const [open, setOpen] = useState(false);

  const allowedSet = useMemo(
    () => (allowedModelKeys?.length ? new Set(allowedModelKeys) : null),
    [allowedModelKeys],
  );

  const filtered = useMemo(
    () =>
      providers
        .filter((p) => p.active)
        .map((p) => ({
          provider: p,
          models: p.models.filter(
            (m) =>
              m.role === role &&
              m.enabled &&
              (!allowedSet || allowedSet.has(m.modelKey)),
          ),
        }))
        .filter((g) => g.models.length > 0),
    [providers, role, allowedSet],
  );

  const current = useMemo(() => {
    for (const g of filtered) {
      for (const m of g.models) {
        if (g.provider.id === providerId && m.modelKey === modelKey) {
          return { provider: g.provider, model: m };
        }
      }
    }
    return null;
  }, [filtered, providerId, modelKey]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="nodrag nowheel flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-left text-[12px] text-white hover:border-white/30"
      >
        <span className="truncate">
          {loading ? (
            <span className="text-[var(--canvas-muted)]">加载 Providers…</span>
          ) : current ? (
            <>
              <span className="text-white/70">{current.provider.alias}</span>
              <span className="mx-1 text-white/30">·</span>
              <span className="font-mono">{current.model.modelKey}</span>
            </>
          ) : (
            <span className="text-[var(--canvas-muted)]">
              选择 {role === "LLM" ? "AI 引擎模型" : role === "VIDEO" ? "视频模型" : "生图模型"}
            </span>
          )}
        </span>
        <ChevronDown className="size-3 shrink-0 text-white/50" />
      </button>

      {open ? (
        <EngineModelModal
          role={role}
          groups={filtered}
          providerId={providerId}
          modelKey={modelKey}
          params={params}
          onClose={() => setOpen(false)}
          onConfirm={(picked) => {
            onChange(picked);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/* ───────────── 模态弹层 ───────────── */

type Group = {
  provider: CanvasProviderDto;
  models: CanvasProviderModelDto[];
};

type DraftSelection = {
  provider: CanvasProviderDto;
  model: CanvasProviderModelDto;
  params: Record<string, unknown>;
};

function EngineModelModal({
  role,
  groups,
  providerId,
  modelKey,
  params,
  onClose,
  onConfirm,
}: {
  role: "LLM" | "IMAGE" | "VIDEO";
  groups: Group[];
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  onClose: () => void;
  onConfirm: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
    model: CanvasProviderModelDto;
    provider: CanvasProviderDto;
  }) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<DraftSelection | null>(() =>
    resolveInitialDraft(groups, providerId, modelKey, params),
  );

  useEffect(() => {
    setMounted(true);
    setDraft(resolveInitialDraft(groups, providerId, modelKey, params));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, [providerId, modelKey, params, groups, onClose]);

  if (!mounted) return null;

  const title =
    role === "LLM"
      ? "选择 AI 引擎模型"
      : role === "VIDEO"
        ? "选择视频模型"
        : "选择生图模型";
  const subtitle =
    role === "LLM"
      ? "选模型并调整推理参数，用于生成设计方案。"
      : role === "VIDEO"
        ? "图生视频模型，需 KIE 系统 Provider。"
        : "选模型并调整比例 / 分辨率等，用于最终出图。";

  const hasParams =
    !!draft?.model.paramsSchema && draft.model.paramsSchema.length > 0;

  const node = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      style={{ zIndex: ENGINE_PICKER_MODAL_Z }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="nodrag nowheel flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface,#161427)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-medium text-white">
              <Sparkles className="size-4 text-[var(--canvas-accent,#a78bfa)]" />
              {title}
            </p>
            <p className="mt-0.5 text-[12px] text-white/60">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {groups.length === 0 ? (
            <EmptyState role={role} />
          ) : (
            <div className="space-y-5">
              {groups.map(({ provider, models }) => (
                <ProviderGroup
                  key={provider.id}
                  provider={provider}
                  models={models}
                  draft={draft}
                  onSelectModel={(m) => {
                    const same =
                      draft?.provider.id === provider.id &&
                      draft?.model.modelKey === m.modelKey;
                    setDraft({
                      provider,
                      model: m,
                      params: same
                        ? (draft?.params ?? buildModelParams(m))
                        : buildModelParams(m),
                    });
                  }}
                />
              ))}

              {draft && hasParams ? (
                <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="mb-3 text-[12px] font-medium text-white">
                    模型参数
                    <span className="ml-2 font-normal text-white/50">
                      {draft.model.displayName || draft.model.modelKey}
                    </span>
                  </p>
                  <DynamicParamForm
                    variant="panel"
                    schema={draft.model.paramsSchema}
                    value={draft.params}
                    onChange={(next) =>
                      setDraft((cur) =>
                        cur ? { ...cur, params: next } : cur,
                      )
                    }
                  />
                </section>
              ) : draft && !hasParams ? (
                <p className="text-[12px] text-white/45">
                  当前模型无可调参数，选好后直接确认即可。
                </p>
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-black/20 px-5 py-3">
          <span className="text-[11px] text-white/50">
            没看到要的模型？
            <a
              href="/settings/providers"
              className="ml-1 text-[var(--canvas-accent,#a78bfa)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Provider 配置
            </a>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30 hover:text-white"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!draft}
              onClick={() => {
                if (!draft) return;
                onConfirm({
                  providerId: draft.provider.id,
                  modelKey: draft.model.modelKey,
                  params: draft.params,
                  model: draft.model,
                  provider: draft.provider,
                });
              }}
              className="rounded-md bg-[var(--canvas-accent,#a78bfa)] px-4 py-1.5 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft,#c4b5fd)] disabled:opacity-50"
            >
              确认
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function resolveInitialDraft(
  groups: Group[],
  providerId: string,
  modelKey: string,
  params: Record<string, unknown>,
): DraftSelection | null {
  if (!providerId || !modelKey) return null;
  for (const g of groups) {
    if (g.provider.id !== providerId) continue;
    const m = g.models.find((x) => x.modelKey === modelKey);
    if (m) {
      return {
        provider: g.provider,
        model: m,
        params: buildModelParams(m, params),
      };
    }
  }
  return null;
}

function ProviderGroup({
  provider,
  models,
  draft,
  onSelectModel,
}: {
  provider: CanvasProviderDto;
  models: CanvasProviderModelDto[];
  draft: DraftSelection | null;
  onSelectModel: (m: CanvasProviderModelDto) => void;
}) {
  const isSystem = provider.id.startsWith("system:");
  return (
    <section>
      <header className="mb-2 flex items-center gap-2">
        {isSystem ? (
          <span className="rounded bg-[var(--canvas-accent,#a78bfa)]/30 px-1.5 py-0.5 text-[10px] text-white">
            系统
          </span>
        ) : null}
        <h3 className="text-[12px] font-medium text-white">{provider.alias}</h3>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
          {provider.kind}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((m) => {
          const selected =
            draft?.provider.id === provider.id &&
            draft?.model.modelKey === m.modelKey;
          return (
            <ModelCard
              key={m.id}
              model={m}
              providerKind={provider.kind}
              selected={selected}
              onClick={() => onSelectModel(m)}
            />
          );
        })}
      </div>
    </section>
  );
}

function ModelCard({
  model,
  providerKind,
  selected,
  onClick,
}: {
  model: CanvasProviderModelDto;
  providerKind: string;
  selected: boolean;
  onClick: () => void;
}) {
  const paramCount = model.paramsSchema?.length ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative flex h-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition",
        selected
          ? "border-white bg-white/[.06]"
          : "border-white/15 hover:border-white/40 hover:bg-white/[.03]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-1 text-[13px] font-medium text-white">
          {model.displayName || model.modelKey}
        </p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${roleTone(model.role)}`}>
          {model.role}
        </span>
      </div>
      <p className="font-mono text-[11px] text-white/55 line-clamp-1">
        {model.modelKey}
      </p>
      {model.description ? (
        <p className="text-[11px] leading-relaxed text-white/55 line-clamp-2">
          {model.description}
        </p>
      ) : (
        <p className="text-[11px] text-white/35">{providerKind}</p>
      )}
      {paramCount > 0 ? (
        <p className="text-[10px] text-white/40">{paramCount} 项可调参数</p>
      ) : null}
      {selected ? (
        <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-white text-[9px] font-bold text-black">
          ✓
        </span>
      ) : null}
    </button>
  );
}

function roleTone(role: string): string {
  switch (role) {
    case "IMAGE":
      return "bg-amber-500/20 text-amber-200";
    case "LLM":
      return "bg-emerald-500/20 text-emerald-200";
    case "VIDEO":
      return "bg-sky-500/20 text-sky-200";
    default:
      return "bg-white/10 text-white/70";
  }
}

function EmptyState({ role }: { role: "LLM" | "IMAGE" | "VIDEO" }) {
  return (
    <div className="grid place-items-center gap-3 px-4 py-10 text-center text-[13px] text-white/70">
      <p>
        还没有可用的
        <span className="font-medium text-white">
          {" "}
          {role === "LLM" ? "LLM" : role === "VIDEO" ? "VIDEO" : "IMAGE"}{" "}
        </span>
        模型。
      </p>
      <a
        href="/settings/providers"
        className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-[var(--canvas-accent,#a78bfa)] hover:bg-white/10"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Cog className="size-3" />
        去 Provider 配置 <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
