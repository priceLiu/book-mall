"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ENGINE_PICKER_EMPTY_PARAMS } from "@/components/canvas/engine-picker";
import { buildModelParams } from "@/components/canvas/dynamic-param-form";
import {
  buildStoryLlmDockParams,
  sanitizeStoryLlmParamsForModel,
  storyLlmParamsNeedSanitize,
} from "@/lib/canvas/story-llm-dock-params";
import { resolveLibtvDockEngineModel } from "@/lib/canvas/libtv-dock-engine-models";
import {
  type GatewayModelRole,
} from "@/lib/canvas/gateway-model-role";
import {
  pickDefaultPro2SunoEngine,
  pickDefaultPro2TtsEngine,
  PRO2_SUNO_MODEL_KEYS,
  PRO2_TTS_MODEL_KEYS,
  isPro2SunoModelKey,
} from "@/lib/canvas/kie-audio-models";
import {
  patchPro2TextNodeEngine,
  readPro2TextNodeEngine,
  resolvePro2TextNodeEngineRoles,
  pro2TextNodeLlmNeedsVision,
  syncPro2TextNodeEngineToDownstream,
  type Pro2TextNodeEngineData,
} from "@/lib/canvas/pro2-text-node-engine-roles";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import {
  SBV1_IMAGE_MODEL_KEYS,
  pickDefaultSbv1ImageEngine,
} from "@/lib/canvas/sbv1-image-models";
import {
  pickDefaultSbv1VideoEngine,
  SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS,
} from "@/lib/canvas/sbv1-video-models";
import {
  GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
  pickDefaultStoryLlmEngine,
  pickDefaultStoryVisionLlmEngine,
} from "@/lib/canvas/system-providers";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import {
  isStoryLlmVisionModel,
  STORY_LLM_VISION_MODEL_KEYS,
  STORY_LLM_VIDEO_UNDERSTANDING_MODEL_KEYS,
} from "@/lib/canvas/story-llm-vision-models";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { LibtvDockEngineModelPicker } from "../libtv-dock-engine-model-picker";
import {
  LibtvDockGatewayParamsPicker,
  libtvLlmParamsSummaryLabel,
} from "../libtv-dock-gateway-params-picker";

type RolePickerConfig = {
  allowedModelKeys?: string[];
  providerIds?: string[];
};

function rolePickerConfig(
  role: GatewayModelRole,
  needsVision: boolean,
  data: Pro2TextNodeEngineData,
): RolePickerConfig {
  const preset = String(data.pro2PresetKind ?? "").trim();
  if (role === "LLM") {
    if (preset === "text-to-music") {
      return { allowedModelKeys: [...PRO2_SUNO_MODEL_KEYS] };
    }
    const llmKeys =
      needsVision && preset === "video-to-prompt"
        ? [...STORY_LLM_VIDEO_UNDERSTANDING_MODEL_KEYS]
        : needsVision
          ? [...STORY_LLM_VISION_MODEL_KEYS]
          : [...STORY_LLM_MODEL_KEYS];
    return {
      allowedModelKeys: [...llmKeys],
    };
  }
  if (role === "IMAGE") {
    return { allowedModelKeys: [...SBV1_IMAGE_MODEL_KEYS] };
  }
  if (role === "MUSIC") {
    return { allowedModelKeys: [...PRO2_SUNO_MODEL_KEYS] };
  }
  if (role === "TTS") {
    return { allowedModelKeys: [...PRO2_TTS_MODEL_KEYS] };
  }
  return {
    providerIds: [GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID],
    allowedModelKeys: [...SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS],
  };
}

function defaultPickForRole(
  role: GatewayModelRole,
  providers: CanvasProviderDto[],
  needsVision: boolean,
  data?: Pro2TextNodeEngineData,
): CanvasEnginePick | null {
  if (role === "LLM") {
    const preset = String(data?.pro2PresetKind ?? "").trim();
    if (preset === "text-to-music") {
      const pick = pickDefaultPro2SunoEngine(providers);
      if (!pick) return null;
      return { ...pick, params: pick.params ?? {} };
    }
    const pick = needsVision
      ? pickDefaultStoryVisionLlmEngine(providers)
      : pickDefaultStoryLlmEngine(providers);
    if (!pick) return null;
    const model = resolveLibtvDockEngineModel(
      providers,
      pick.providerId,
      pick.modelKey,
    );
    return {
      ...pick,
      params: model
        ? buildStoryLlmDockParams(model, {})
        : { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    };
  }
  if (role === "IMAGE") {
    const pick = pickDefaultSbv1ImageEngine(providers);
    if (!pick) return null;
    return { ...pick, params: pick.params ?? {} };
  }
  if (role === "MUSIC") {
    const pick = pickDefaultPro2SunoEngine(providers);
    if (!pick) return null;
    return { ...pick, params: pick.params ?? {} };
  }
  if (role === "TTS") {
    const pick = pickDefaultPro2TtsEngine(providers);
    if (!pick) return null;
    return { ...pick, params: pick.params ?? {} };
  }
  const pick = pickDefaultSbv1VideoEngine(providers);
  if (!pick) return null;
  return { ...pick, params: pick.params ?? {} };
}

function buildLlmDockParams(
  model: Parameters<typeof buildStoryLlmDockParams>[0],
  curParams: Record<string, unknown>,
): Record<string, unknown> {
  return buildStoryLlmDockParams(model, curParams);
}

function paramsSummaryForRole(
  role: GatewayModelRole,
  modelKey: string,
  params: Record<string, unknown>,
): string {
  if (role === "LLM" && isPro2SunoModelKey(modelKey)) {
    const parts: string[] = [];
    if (params.instrumental === true) parts.push("纯音乐");
    const ver = String(params.model ?? "").trim();
    if (ver) parts.push(ver);
    return parts.length > 0 ? parts.join(" · ") : "参数";
  }
  if (role === "LLM" || role === "MUSIC") {
    return libtvLlmParamsSummaryLabel(params);
  }
  const keys = Object.keys(params).filter(
    (k) => params[k] != null && String(params[k]).trim() !== "",
  );
  if (keys.length === 0) return "参数";
  return keys.slice(0, 3).join(" · ");
}

export type Pro2TextNodeEnginePickersProps = {
  nodeId: string;
  data: Pro2TextNodeEngineData;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  providers: CanvasProviderDto[];
  disabled?: boolean;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  triggerFontPx?: number;
  sectionFontPx?: number;
};

/** 文本节点 · 按 Gateway role 分类的模型 + 参数（Dock 双钮 · 与视频节点一致） */
export function Pro2TextNodeEnginePickers({
  nodeId,
  data,
  nodes,
  edges,
  providers,
  disabled,
  updateNodeData,
}: Pro2TextNodeEnginePickersProps) {
  const roles = useMemo(
    () =>
      resolvePro2TextNodeEngineRoles(data, {
        nodeId,
        nodes,
        edges,
      }),
    [data, nodeId, nodes, edges],
  );
  const llmNeedsVision = useMemo(
    () => pro2TextNodeLlmNeedsVision(data, { nodeId, nodes, edges }),
    [data, nodeId, nodes, edges],
  );

  const [dockMenu, setDockMenu] = useState<{
    role: GatewayModelRole;
    kind: "model" | "params";
  } | null>(null);

  const seededRolesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seededRolesRef.current = new Set();
  }, [nodeId]);

  useEffect(() => {
    if (disabled) return;
    for (const role of roles) {
      const seedKey = `${nodeId}:${role}`;
      if (seededRolesRef.current.has(seedKey)) continue;

      const cur = readPro2TextNodeEngine(data, role);
      const allowedLlm =
        role === "LLM" && llmNeedsVision
          ? STORY_LLM_VISION_MODEL_KEYS
          : role === "LLM" &&
              String(data.pro2PresetKind ?? "").trim() === "text-to-music"
            ? PRO2_SUNO_MODEL_KEYS
            : null;
      if (
        role === "LLM" &&
        llmNeedsVision &&
        cur.modelKey.trim() &&
        !isStoryLlmVisionModel(cur.modelKey)
      ) {
        const pick = defaultPickForRole(role, providers, true, data);
        if (pick) {
          seededRolesRef.current.add(seedKey);
          updateNodeData(nodeId, patchPro2TextNodeEngine(role, pick));
          continue;
        }
      }
      if (cur.providerId.trim() && cur.modelKey.trim()) {
        if (
          role === "LLM" &&
          !isPro2SunoModelKey(cur.modelKey) &&
          cur.params?.model != null &&
          String(cur.params.model).trim() !== ""
        ) {
          const cleaned = { ...(cur.params ?? {}) };
          delete cleaned.model;
          seededRolesRef.current.add(seedKey);
          updateNodeData(
            nodeId,
            patchPro2TextNodeEngine(role, { ...cur, params: cleaned }),
          );
          continue;
        }
        if (role === "LLM" && isPro2SunoModelKey(cur.modelKey)) {
          const preset = String(data.pro2PresetKind ?? "").trim();
          if (preset === "text-to-music") {
            seededRolesRef.current.add(seedKey);
            continue;
          }
          const pick = defaultPickForRole(role, providers, llmNeedsVision, data);
          if (pick) {
            seededRolesRef.current.add(seedKey);
            updateNodeData(nodeId, patchPro2TextNodeEngine(role, pick));
          }
          continue;
        }
        if (
          role === "LLM" &&
          storyLlmParamsNeedSanitize(cur.modelKey, cur.params ?? {})
        ) {
          const model = resolveLibtvDockEngineModel(
            providers,
            cur.providerId,
            cur.modelKey,
          );
          seededRolesRef.current.add(seedKey);
          updateNodeData(
            nodeId,
            patchPro2TextNodeEngine(role, {
              ...cur,
              params: sanitizeStoryLlmParamsForModel(
                cur.modelKey,
                cur.params ?? {},
                model,
              ),
            }),
          );
          continue;
        }
        if (
          !allowedLlm ||
          allowedLlm.some((k) => k === cur.modelKey.trim())
        ) {
          seededRolesRef.current.add(seedKey);
          continue;
        }
      }
      const pick = defaultPickForRole(role, providers, llmNeedsVision, data);
      if (!pick) continue;
      seededRolesRef.current.add(seedKey);
      updateNodeData(nodeId, patchPro2TextNodeEngine(role, pick));
    }
  }, [disabled, roles, llmNeedsVision, data, nodeId, providers, updateNodeData]);

  if (roles.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
      {roles.map((role) => {
        const cfg = rolePickerConfig(role, llmNeedsVision, data);
        const cur = readPro2TextNodeEngine(data, role);
        const rawParams = cur.params ?? ENGINE_PICKER_EMPTY_PARAMS;
        const resolvedModel =
          role === "LLM"
            ? resolveLibtvDockEngineModel(
                providers,
                cur.providerId,
                cur.modelKey,
              )
            : null;
        const params =
          role === "LLM" && cur.modelKey.trim()
            ? sanitizeStoryLlmParamsForModel(
                cur.modelKey,
                rawParams,
                resolvedModel,
              )
            : rawParams;

        const applyPick = (pick: CanvasEnginePick) => {
          const patch = patchPro2TextNodeEngine(role, pick);
          if (role === "LLM" && !isPro2SunoModelKey(pick.modelKey)) {
            const params = {
              ...((patch.params as Record<string, unknown> | undefined) ?? {}),
            };
            delete params.model;
            patch.params = params;
          }
          if (data.themeOutlineRuntime?.status === "error") {
            patch.themeOutlineRuntime = {
              ...data.themeOutlineRuntime,
              status: "idle",
              failCode: undefined,
              failMessage: undefined,
            };
          }
          updateNodeData(nodeId, patch);
          syncPro2TextNodeEngineToDownstream(
            nodeId,
            role,
            pick,
            nodes,
            edges,
            updateNodeData,
          );
        };

        return (
          <div key={role} className="min-w-0 shrink-0">
            <div className="flex min-w-0 flex-wrap items-center gap-0.5">
              <LibtvDockEngineModelPicker
                role={role}
                providerId={cur.providerId}
                modelKey={cur.modelKey}
                allowedModelKeys={cfg.allowedModelKeys}
                providerIds={cfg.providerIds}
                externalProviders={providers}
                disabled={disabled}
                open={
                  dockMenu?.role === role && dockMenu.kind === "model"
                }
                onOpenChange={(next) =>
                  setDockMenu(
                    next ? { role, kind: "model" } : null,
                  )
                }
                onSelect={({ providerId, modelKey, model }) => {
                  const isSuno = isPro2SunoModelKey(modelKey);
                  const nextParams = isSuno
                    ? buildModelParams(model)
                    : role === "LLM"
                      ? buildLlmDockParams(model, cur.params ?? {})
                      : buildModelParams(model, cur.params);
                  applyPick({
                    providerId,
                    modelKey,
                    params: nextParams,
                  });
                }}
              />
              <LibtvDockGatewayParamsPicker
                providerId={cur.providerId}
                modelKey={cur.modelKey}
                params={params}
                externalProviders={providers}
                disabled={disabled}
                open={
                  dockMenu?.role === role && dockMenu.kind === "params"
                }
                onOpenChange={(next) =>
                  setDockMenu(
                    next ? { role, kind: "params" } : null,
                  )
                }
                summaryLabel={paramsSummaryForRole(role, cur.modelKey, params)}
                onChange={(nextParams) => {
                  applyPick({
                    providerId: cur.providerId,
                    modelKey: cur.modelKey,
                    params: nextParams,
                  });
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
