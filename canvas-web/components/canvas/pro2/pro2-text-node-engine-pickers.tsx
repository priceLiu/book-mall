"use client";

import { useEffect, useMemo, useRef } from "react";
import { EnginePicker } from "@/components/canvas/engine-picker";
import {
  gatewayModelRoleSectionTitle,
  type GatewayModelRole,
} from "@/lib/canvas/gateway-model-role";
import {
  patchPro2TextNodeEngine,
  readPro2TextNodeEngine,
  resolvePro2TextNodeEngineRoles,
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
} from "@/lib/canvas/system-providers";
import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";

type RolePickerConfig = {
  allowedModelKeys?: string[];
  providerIds?: string[];
};

function rolePickerConfig(role: GatewayModelRole): RolePickerConfig {
  if (role === "LLM") {
    return { allowedModelKeys: [...STORY_LLM_MODEL_KEYS] };
  }
  if (role === "IMAGE") {
    return { allowedModelKeys: [...SBV1_IMAGE_MODEL_KEYS] };
  }
  return {
    providerIds: [GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID],
    allowedModelKeys: [...SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS],
  };
}

function defaultPickForRole(
  role: GatewayModelRole,
  providers: CanvasProviderDto[],
): CanvasEnginePick | null {
  if (role === "LLM") {
    const pick = pickDefaultStoryLlmEngine(providers);
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
      if (cur.providerId.trim() && cur.modelKey.trim()) {
        seededRolesRef.current.add(seedKey);
        continue;
      }
      const pick = defaultPickForRole(role, providers);
      if (!pick) continue;
      seededRolesRef.current.add(seedKey);
      updateNodeData(nodeId, patchPro2TextNodeEngine(role, pick));
    }
  }, [disabled, roles, data, nodeId, providers, updateNodeData]);

  if (roles.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
      {roles.map((role) => {
        const cfg = rolePickerConfig(role);
        const cur = readPro2TextNodeEngine(data, role);
        return (
          <div key={role} className="min-w-0 shrink-0">
            <p className="mb-0.5 truncate text-[10px] font-medium tracking-wide text-white/45">
              {gatewayModelRoleSectionTitle(role)}
            </p>
            <EnginePicker
              role={role}
              allowedModelKeys={cfg.allowedModelKeys}
              providerIds={cfg.providerIds}
              providerId={cur.providerId}
              modelKey={cur.modelKey}
              params={cur.params ?? {}}
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
