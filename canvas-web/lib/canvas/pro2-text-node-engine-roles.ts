import type { CanvasEnginePick } from "./types";
import type { GatewayModelRole } from "./gateway-model-role";
import { GATEWAY_MODEL_ROLE_ORDER } from "./gateway-model-role";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  resolvePro2TextPurpose,
  type Pro2TextPurposeNodeData,
} from "./pro2-text-purpose";

const IMAGE_TARGET_TYPES = new Set([
  "story-pro2-image",
  "sbv1-image",
  "story-pro2-three-view",
]);

const VIDEO_TARGET_TYPES = new Set(["sbv1-video-engine"]);

const REVERSE_PROMPT_SOURCE_TYPES = new Set([
  "story-pro2-image",
  "sbv1-image",
  "story-pro2-three-view",
  "sbv1-video-engine",
]);

/** 文本节点 data · 按 Gateway role 分槽存储引擎选择 */
export type Pro2TextNodeEngineData = Pro2TextPurposeNodeData & {
  providerId?: string;
  modelKey?: string;
  params?: Record<string, unknown>;
  imageEngine?: CanvasEnginePick;
  videoEngine?: CanvasEnginePick;
};

export function readPro2TextNodeEngine(
  data: Pro2TextNodeEngineData,
  role: GatewayModelRole,
): CanvasEnginePick {
  if (role === "LLM") {
    return {
      providerId: String(data.providerId ?? ""),
      modelKey: String(data.modelKey ?? ""),
      params: { ...(data.params ?? {}) },
    };
  }
  if (role === "IMAGE") {
    const e = data.imageEngine;
    return {
      providerId: String(e?.providerId ?? ""),
      modelKey: String(e?.modelKey ?? ""),
      params: { ...(e?.params ?? {}) },
    };
  }
  const e = data.videoEngine;
  return {
    providerId: String(e?.providerId ?? ""),
    modelKey: String(e?.modelKey ?? ""),
    params: { ...(e?.params ?? {}) },
  };
}

export function patchPro2TextNodeEngine(
  role: GatewayModelRole,
  pick: CanvasEnginePick,
): Record<string, unknown> {
  if (role === "LLM") {
    return {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
      params: pick.params ?? {},
    };
  }
  if (role === "IMAGE") {
    return { imageEngine: pick };
  }
  return { videoEngine: pick };
}

/** 文本节点 Dock 须展示哪些 Gateway role（类型匹配模型，供用户自选） */
export function resolvePro2TextNodeEngineRoles(
  data: Pro2TextPurposeNodeData,
  ctx?: {
    nodeId?: string;
    nodes?: CanvasFlowNode[];
    edges?: CanvasFlowEdge[];
  },
): GatewayModelRole[] {
  const purpose = resolvePro2TextPurpose(data, ctx);
  if (purpose === "story-outline") return ["LLM"];

  const preset = String(data.pro2PresetKind ?? "").trim();
  if (preset === "text-to-video") return ["VIDEO"];
  if (preset === "image-to-prompt") return ["LLM", "IMAGE"];
  if (preset === "video-to-prompt") return ["LLM", "VIDEO"];

  const roles = new Set<GatewayModelRole>();
  const nodeId = ctx?.nodeId?.trim();
  const nodes = ctx?.nodes;
  const edges = ctx?.edges;

  if (nodeId && nodes && edges) {
    for (const e of edges) {
      if (e.source === nodeId) {
        const tgt = nodes.find((n) => n.id === e.target);
        if (tgt && IMAGE_TARGET_TYPES.has(String(tgt.type ?? ""))) {
          roles.add("IMAGE");
        }
        if (tgt && VIDEO_TARGET_TYPES.has(String(tgt.type ?? ""))) {
          roles.add("VIDEO");
        }
      }
      if (e.target === nodeId) {
        const src = nodes.find((n) => n.id === e.source);
        if (src && REVERSE_PROMPT_SOURCE_TYPES.has(String(src.type ?? ""))) {
          roles.add("LLM");
        }
      }
    }
  }

  if (roles.size === 0) {
    return ["LLM"];
  }

  return GATEWAY_MODEL_ROLE_ORDER.filter((r) => roles.has(r));
}

/** 文本节点所选 IMAGE/VIDEO 引擎同步到直连下游媒体节点 */
export function syncPro2TextNodeEngineToDownstream(
  nodeId: string,
  role: GatewayModelRole,
  pick: CanvasEnginePick,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  if (role !== "IMAGE" && role !== "VIDEO") return;
  const engine = {
    providerId: pick.providerId,
    modelKey: pick.modelKey,
    params: pick.params ?? {},
  };
  for (const e of edges) {
    if (e.source !== nodeId) continue;
    const tgt = nodes.find((n) => n.id === e.target);
    if (!tgt) continue;
    if (
      role === "IMAGE" &&
      IMAGE_TARGET_TYPES.has(String(tgt.type ?? ""))
    ) {
      updateNodeData(tgt.id, { engine });
    }
    if (
      role === "VIDEO" &&
      VIDEO_TARGET_TYPES.has(String(tgt.type ?? ""))
    ) {
      updateNodeData(tgt.id, { engine });
    }
  }
}
