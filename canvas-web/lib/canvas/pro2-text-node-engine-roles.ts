import type { CanvasEnginePick } from "./types";
import type { GatewayModelRole } from "./gateway-model-role";
import { GATEWAY_MODEL_ROLE_ORDER } from "./gateway-model-role";
import { isPro2SunoModelKey } from "./kie-audio-models";
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

const AUDIO_TARGET_TYPES = new Set(["story-pro2-audio"]);

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
  musicEngine?: CanvasEnginePick;
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
  if (role === "VIDEO") {
    const e = data.videoEngine;
    return {
      providerId: String(e?.providerId ?? ""),
      modelKey: String(e?.modelKey ?? ""),
      params: { ...(e?.params ?? {}) },
    };
  }
  if (role === "MUSIC") {
    const e = data.musicEngine;
    return {
      providerId: String(e?.providerId ?? ""),
      modelKey: String(e?.modelKey ?? ""),
      params: { ...(e?.params ?? {}) },
    };
  }
  return {
    providerId: "",
    modelKey: "",
    params: {},
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
  if (role === "VIDEO") {
    return { videoEngine: pick };
  }
  if (role === "MUSIC") {
    return { musicEngine: pick };
  }
  return {};
}

export function pro2TextNodeLlmNeedsVision(
  data: Pro2TextPurposeNodeData,
  ctx?: {
    nodeId?: string;
    nodes?: CanvasFlowNode[];
    edges?: CanvasFlowEdge[];
  },
): boolean {
  const preset = String(data.pro2PresetKind ?? "").trim();
  if (preset === "image-to-prompt" || preset === "video-to-prompt") {
    return true;
  }
  const nodeId = ctx?.nodeId?.trim();
  const nodes = ctx?.nodes;
  const edges = ctx?.edges;
  if (nodeId && nodes && edges) {
    for (const e of edges) {
      if (e.target !== nodeId) continue;
      const src = nodes.find((n) => n.id === e.source);
      if (src && REVERSE_PROMPT_SOURCE_TYPES.has(String(src.type ?? ""))) {
        return true;
      }
    }
  }
  return false;
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
  /** 文字生音乐 · 与文本模型同一选择层（Suno 出现在 Select text model） */
  if (preset === "text-to-music") return ["LLM"];
  // 反推预设：文本节点只选 LLM；IMAGE/VIDEO 模型在上游媒体节点 Dock 选择
  if (
    preset === "image-to-prompt" ||
    preset === "video-to-prompt" ||
    (data.pro2TextPurpose === "general" && !preset)
  ) {
    return ["LLM"];
  }

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
        // 连音频节点不再单独展示 Music model；Suno 并入 Text model 选择层
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

/** 文本节点所选引擎同步到直连下游媒体节点（含 Text model 中选 Suno → 音频节点） */
export function syncPro2TextNodeEngineToDownstream(
  nodeId: string,
  role: GatewayModelRole,
  pick: CanvasEnginePick,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const engine = {
    providerId: pick.providerId,
    modelKey: pick.modelKey,
    params: pick.params ?? {},
  };
  const syncAudio =
    (role === "MUSIC" || (role === "LLM" && isPro2SunoModelKey(pick.modelKey)));
  if (role !== "IMAGE" && role !== "VIDEO" && !syncAudio) return;
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
    if (
      syncAudio &&
      AUDIO_TARGET_TYPES.has(String(tgt.type ?? ""))
    ) {
      updateNodeData(tgt.id, { engine });
    }
  }
}
