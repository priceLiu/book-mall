"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
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
import {
  modelHasStoryCapabilities,
  storyCapabilityHint,
  type StoryModelCapability,
} from "@/lib/canvas/story-model-capabilities";
import {
  gatewayModelRoleMeta,
  type GatewayModelRole,
} from "@/lib/canvas/gateway-model-role";

export type EnginePickerProps = {
  /** 过滤模型 role：LLM / IMAGE / VIDEO */
  role: "LLM" | "IMAGE" | "VIDEO";
  /** 仅展示这些 modelKey（三视图引擎白名单等） */
  allowedModelKeys?: string[];
  /** 须具备的能力（如 image_multi_ref / video_i2v） */
  requiredCapabilities?: StoryModelCapability[];
  /** 当前模型不兼容时的提示文案 */
  capabilityHint?: string;
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
  /** 内联展示模型卡片与参数区（不渲染触发按钮 / 独立弹层） */
  /** 嵌入设置弹层时只展示模型列表，参数由外层表单统一编排 */
  modelsOnly?: boolean;
  embedded?: boolean;
  /** 仅展示这些 Provider（如 gateway:volcengine） */
  providerIds?: string[];
};

/* 须高于 story-engine-actions-modal (1090) 等嵌套宿主 */
const ENGINE_PICKER_MODAL_Z = 1200;

/** 稳定的空参数引用：避免默认 `params = {}` 每次 render 产生新对象，触发弹层 effect 反复 setDraft */
const EMPTY_PARAMS: Record<string, unknown> = Object.freeze({});

/**
 * - 触发按钮显示当前选中
 * - 弹层：模型卡片 → 下方动态参数（分段按钮 / 滑条 / 复选框）
 * - 确认后写回节点
 */
export function EnginePicker({
  role,
  allowedModelKeys,
  requiredCapabilities,
  capabilityHint,
  providerId,
  modelKey,
  params = EMPTY_PARAMS,
  onChange,
  embedded = false,
  modelsOnly = false,
  providerIds,
}: EnginePickerProps) {
  const { providers, loading } = useUserProviders();
  const [open, setOpen] = useState(false);

  // 调用方常以「内联数组字面量」传入这些 props（每次 render 新引用），
  // 若直接进 useMemo 依赖会导致 filtered/groups 每帧变更，进而让弹层 effect 反复 setDraft → 闪烁。
  // 改用「序列化 key」做依赖，按内容稳定。
  const SEP = "\u0001";
  const allowedKey = (allowedModelKeys ?? []).join(SEP);
  const providerIdsKey = (providerIds ?? []).join(SEP);
  const reqCapsKey = (requiredCapabilities ?? []).join(SEP);

  const allowedSet = useMemo(
    () => (allowedKey ? new Set(allowedKey.split(SEP)) : null),
    [allowedKey],
  );

  const providerIdSet = useMemo(
    () => (providerIdsKey ? new Set(providerIdsKey.split(SEP)) : null),
    [providerIdsKey],
  );

  const stableReqCaps = useMemo(
    () =>
      reqCapsKey
        ? (reqCapsKey.split(SEP) as StoryModelCapability[])
        : undefined,
    [reqCapsKey],
  );

  const filtered = useMemo(
    () =>
      providers
        .filter(
          (p) =>
            p.active && (!providerIdSet || providerIdSet.has(p.id)),
        )
        .map((p) => ({
          provider: p,
          models: p.models.filter(
            (m) =>
              m.role === role &&
              m.enabled &&
              (!allowedSet || allowedSet.has(m.modelKey)) &&
              (!stableReqCaps?.length ||
                modelHasStoryCapabilities(m.modelKey, stableReqCaps)),
          ),
        }))
        .filter((g) => g.models.length > 0),
    [providers, role, allowedSet, providerIdSet, stableReqCaps],
  );

  const capabilityMismatch = useMemo(() => {
    if (!stableReqCaps?.length || !modelKey.trim()) return null;
    if (modelHasStoryCapabilities(modelKey, stableReqCaps)) return null;
    return (
      capabilityHint ??
      `当前模型可能不支持 ${storyCapabilityHint(stableReqCaps)}，建议重新选择`
    );
  }, [stableReqCaps, modelKey, capabilityHint]);

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

  if (embedded) {
    return (
      <EnginePickerInlinePanel
        role={role}
        groups={filtered}
        loading={loading}
        providerId={providerId}
        modelKey={modelKey}
        params={params}
        capabilityMismatch={capabilityMismatch}
        modelsOnly={modelsOnly}
        onChange={onChange}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="nodrag flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-left text-[12px] text-white hover:border-white/30"
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
              {gatewayModelRoleMeta(role as GatewayModelRole).pickerPlaceholder}
            </span>
          )}
        </span>
        <ChevronDown className="size-3 shrink-0 text-white/50" />
      </button>
      {capabilityMismatch ? (
        <p className="nodrag mt-1 rounded border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-100/90">
          {capabilityMismatch}
        </p>
      ) : null}

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

function EnginePickerInlinePanel({
  role,
  groups,
  loading,
  providerId,
  modelKey,
  params,
  capabilityMismatch,
  modelsOnly = false,
  onChange,
}: {
  role: "LLM" | "IMAGE" | "VIDEO";
  groups: Group[];
  loading: boolean;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  capabilityMismatch: string | null;
  modelsOnly?: boolean;
  onChange: EnginePickerProps["onChange"];
}) {
  const [draft, setDraft] = useState<DraftSelection | null>(() =>
    resolveInitialDraft(groups, providerId, modelKey, params),
  );
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const groupsKey = useMemo(
    () =>
      groups
        .map(
          (g) =>
            `${g.provider.id}:${g.models.map((m) => m.modelKey).join(",")}`,
        )
        .join("|"),
    [groups],
  );

  useEffect(() => {
    setDraft(resolveInitialDraft(groups, providerId, modelKey, params));
  }, [groupsKey, groups, providerId, modelKey, paramsKey]);

  const hasParams =
    !!draft?.model.paramsSchema && draft.model.paramsSchema.length > 0;

  const emitDraft = (next: DraftSelection) => {
    setDraft(next);
    onChange({
      providerId: next.provider.id,
      modelKey: next.model.modelKey,
      params: next.params,
      model: next.model,
      provider: next.provider,
    });
  };

  if (loading) {
    return (
      <p className="text-[12px] text-[var(--canvas-muted)]">加载 Providers…</p>
    );
  }

  return (
    <div className="space-y-5">
      {capabilityMismatch ? (
        <p className="rounded border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-100/90">
          {capabilityMismatch}
        </p>
      ) : null}
      {groups.length === 0 ? (
        <EmptyState role={role} />
      ) : (
        <>
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
                emitDraft({
                  provider,
                  model: m,
                  params: same
                    ? (draft?.params ?? buildModelParams(m))
                    : buildModelParams(m),
                });
              }}
            />
          ))}
          {draft && hasParams && !modelsOnly ? (
            <DynamicParamForm
              variant="panel"
              schema={draft.model.paramsSchema}
              value={draft.params}
              onChange={(next) => {
                if (!draft) return;
                emitDraft({ ...draft, params: next });
              }}
            />
          ) : null}
        </>
      )}
    </div>
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
  const mounted = useClientPortalMounted();
  const [draft, setDraft] = useState<DraftSelection | null>(() =>
    resolveInitialDraft(groups, providerId, modelKey, params),
  );
  const userPickedRef = useRef(false);
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const groupsKey = useMemo(
    () =>
      groups
        .map(
          (g) =>
            `${g.provider.id}:${g.models.map((m) => m.modelKey).join(",")}`,
        )
        .join("|"),
    [groups],
  );

  useModalBodyScrollLock();
  useModalEscapeClose(onClose, { capture: true });

  /** Provider 异步加载完成时补全初始 draft；用户已在弹层内点选后不再覆盖 */
  useEffect(() => {
    if (userPickedRef.current) return;
    setDraft(resolveInitialDraft(groups, providerId, modelKey, params));
  }, [groupsKey, groups, providerId, modelKey, paramsKey]);

  if (!mounted) return null;

  const title = gatewayModelRoleMeta(role as GatewayModelRole).modalTitle;

  const hasParams =
    !!draft?.model.paramsSchema && draft.model.paramsSchema.length > 0;

  const node = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      style={{
        zIndex: ENGINE_PICKER_MODAL_Z,
        // 把毛玻璃背板隔离到独立合成层：弹层内 hover 重绘不再触发 backdrop 重栅格化 → 消除闪烁
        isolation: "isolate",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
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
          <p className="flex items-center gap-2 text-[15px] font-medium text-white">
            <Sparkles className="size-4 text-[var(--canvas-accent)]" />
            {title}
          </p>
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
                    userPickedRef.current = true;
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
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/5 bg-black/20 px-5 py-3">
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
            className="rounded-md bg-[var(--canvas-accent)] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:opacity-50"
          >
            确认
          </button>
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
  const isPlatformOffering = provider.id === "platform:offering";
  return (
    <section>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {models.map((m) => {
          const selected =
            draft?.provider.id === provider.id &&
            draft?.model.modelKey === m.modelKey;
          return (
            <ModelCard
              key={m.id}
              model={m}
              providerKind={isPlatformOffering ? "" : provider.kind}
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
  providerKind: _providerKind,
  selected,
  onClick,
}: {
  model: CanvasProviderModelDto;
  providerKind: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        "relative rounded-xl border px-4 py-3 text-left transition",
        selected
          ? "border-white bg-white/[.06] text-white"
          : "border-white/15 text-white/75 hover:border-white/30 hover:text-white",
      ].join(" ")}
    >
      <p className="line-clamp-2 text-[13px] font-medium">
        {model.displayName || model.modelKey}
      </p>
      {selected ? (
        <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-white text-[9px] font-bold text-black">
          ✓
        </span>
      ) : null}
    </button>
  );
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
        className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-[var(--canvas-accent)] hover:bg-white/10"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Cog className="size-3" />
        去 Provider 配置 <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
