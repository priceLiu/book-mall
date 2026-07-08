"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  EnginePicker,
  ENGINE_PICKER_EMPTY_PARAMS,
} from "@/components/canvas/engine-picker";
import {
  gatewayModelRoleSectionTitle,
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
} from "@/lib/canvas/story-llm-vision-models";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";

type RolePickerConfig = {
  allowedModelKeys?: string[];
  providerIds?: string[];
};

function rolePickerConfig(
  role: GatewayModelRole,
  needsVision: boolean,
  data: Pro2TextNodeEngineData,
  _ctx: { nodeId: string; nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] },
): RolePickerConfig {
  const preset = String(data.pro2PresetKind ?? "").trim();
  if (role === "LLM") {
    if (preset === "text-to-music") {
      return { allowedModelKeys: [...PRO2_SUNO_MODEL_KEYS] };
    }
    const llmKeys = needsVision
      ? [...STORY_LLM_VISION_MODEL_KEYS]
      : [...STORY_LLM_MODEL_KEYS];
    return {
      allowedModelKeys: [
        ...new Set([...llmKeys, ...PRO2_SUNO_MODEL_KEYS]),
      ],
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
    return {
      ...pick,
      params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
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

export type Pro2TextNodeEnginePickersProps = {
  nodeId: string;
  data: Pro2TextNodeEngineData;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  providers: CanvasProviderDto[];
  disabled?: boolean;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  /** 触发按钮字号（flow px · 与 Dock 正文统一） */
  triggerFontPx?: number;
  /** role 分组小标题字号（flow px） */
  sectionFontPx?: number;
};

/** 文本节点 · 按 Gateway role 分类的模型 + 参数选择（Text / Image / Video model） */
export function Pro2TextNodeEnginePickers({
  nodeId,
  data,
  nodes,
  edges,
  providers,
  disabled,
  updateNodeData,
  triggerFontPx,
  sectionFontPx,
}: Pro2TextNodeEnginePickersProps) {
  const { minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();
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

  /** 自动补默认引擎仅执行一次（避免反复写 store · 冲掉撤销栈） */
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
        if (role === "LLM" && isPro2SunoModelKey(cur.modelKey)) {
          seededRolesRef.current.add(seedKey);
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
        const cfg = rolePickerConfig(role, llmNeedsVision, data, {
          nodeId,
          nodes,
          edges,
        });
        const cur = readPro2TextNodeEngine(data, role);
        return (
          <div key={role} className="min-w-0 shrink-0">
            <p
              className={
                sectionFontPx != null
                  ? "mb-0.5 truncate font-medium tracking-wide text-white/45"
                  : "mb-0.5 truncate text-[10px] font-medium tracking-wide text-white/45"
              }
              style={
                sectionFontPx != null
                  ? { fontSize: sectionFontPx }
                  : undefined
              }
            >
              {gatewayModelRoleSectionTitle(role)}
            </p>
            <EnginePicker
              role={role}
              allowedModelKeys={cfg.allowedModelKeys}
              providerIds={cfg.providerIds}
              externalProviders={providers}
              providerId={cur.providerId}
              modelKey={cur.modelKey}
              params={cur.params ?? ENGINE_PICKER_EMPTY_PARAMS}
              triggerVariant="dock"
              triggerFontPx={triggerFontPx}
              triggerMinHeightPx={minHeightPx}
              triggerIconPx={chevronPx}
              onChange={(next) => {
                const pick = {
                  providerId: next.providerId,
                  modelKey: next.modelKey,
                  params: next.params,
                };
                updateNodeData(nodeId, patchPro2TextNodeEngine(role, pick));
                syncPro2TextNodeEngineToDownstream(
                  nodeId,
                  role,
                  pick,
                  nodes,
                  edges,
                  updateNodeData,
                );
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
