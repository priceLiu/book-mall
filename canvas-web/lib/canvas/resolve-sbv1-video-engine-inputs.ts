import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";
import {
  dedupePortraitAssetRefs,
  type PortraitAssetRefPayload,
} from "./resolve-portrait-asset-refs";
import {
  isPortraitNodeActive,
  portraitAssetRefFromNodeData,
  portraitImportUiState,
  type CanvasPortraitNodeFields,
} from "./portrait-node-data";
import { resolveSbv1UpstreamRefLinks } from "./sbv1-upstream-ref-links";
import type { Sbv1ReferenceMode } from "./sbv1-workspace-types";
import { directPredecessors } from "./topo";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type ResolveSbv1VideoEngineInputsResult =
  | {
      ok: true;
      imageInputs: string[];
      portraitAssetRefs: PortraitAssetRefPayload[];
    }
  | { ok: false; error: string };

function uniqueDirectPredecessors(edges: CanvasFlowEdge[], nodeId: string): string[] {
  return [...new Set(directPredecessors(edges, nodeId))];
}

/** 非 sbv1-image 上游（如风格资产）仍可走 HTTPS */
function resolveNonSbv1ImageHttpsInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  engineNodeId: string,
): string[] {
  const out: string[] = [];
  for (const pid of uniqueDirectPredecessors(edges, engineNodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p || p.type === "sbv1-image") continue;
    if (p.type === "story-pro2-style-asset") {
      const url = String(
        (p.data as { imageUrl?: string }).imageUrl ?? "",
      ).trim();
      if (/^https:\/\//.test(url)) out.push(url);
    }
  }
  return [...new Set(out)];
}

function portraitRefWithRole(
  url: string,
  role: PortraitAssetRefPayload["role"],
): PortraitAssetRefPayload {
  return { url, role };
}

function httpsOssFromImageNode(node: CanvasFlowNode): string | null {
  const oss = String((node.data as { ossUrl?: string }).ossUrl ?? "").trim();
  if (/^https:\/\//.test(oss)) return oss;
  const blob = String((node.data as { blobUrl?: string }).blobUrl ?? "").trim();
  if (/^https:\/\//.test(blob)) return blob;
  return null;
}

type UpstreamMediaSlot =
  | { kind: "asset"; url: string }
  | { kind: "oss"; url: string };

function resolveUpstreamMediaSlot(
  imgNode: CanvasFlowNode,
  previewUrl?: string,
): UpstreamMediaSlot | "pending" | null {
  const ref = portraitAssetRefFromNodeData(
    imgNode.data as CanvasPortraitNodeFields,
  );
  if (ref) return { kind: "asset", url: ref.url };

  const importState = portraitImportUiState(
    imgNode.data as CanvasPortraitNodeFields,
  );
  if (importState === "pending") return "pending";

  const oss = httpsOssFromImageNode(imgNode);
  if (oss) return { kind: "oss", url: oss };
  if (previewUrl && /^https:\/\//.test(previewUrl)) {
    return { kind: "oss", url: previewUrl };
  }
  return null;
}

/**
 * sbv1 视频合成 · Seedance 2.0 参考图：
 * - 已「私域人像入库」→ asset://（portraitAssetRefs）
 * - 未入库 → 公网 HTTPS OSS（imageInputs，与旧逻辑一致）
 * 真人人像主体须入库；虚拟/场景图可按需选择是否入库。
 */
export function resolveSbv1VideoEngineInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  engineNodeId: string,
  opts: {
    prompt?: string;
    referenceMode?: Sbv1ReferenceMode;
  },
): ResolveSbv1VideoEngineInputsResult {
  const prompt = String(opts.prompt ?? "").trim();
  const referenceMode = opts.referenceMode ?? "omni";
  const upstreamLinks = resolveSbv1UpstreamRefLinks(engineNodeId, nodes, edges);
  const mentionedIds = parseReferencedIds(prompt);
  const activeLinks =
    mentionedIds.length > 0
      ? upstreamLinks.filter((l) => mentionedIds.includes(l.id))
      : upstreamLinks;

  const slots: UpstreamMediaSlot[] = [];
  const pendingImport: string[] = [];

  for (const link of activeLinks) {
    const imgNode = nodes.find((n) => n.id === link.sourceNodeId);
    if (!imgNode || imgNode.type !== "sbv1-image") continue;
    if (
      !link.previewUrl &&
      !isPortraitNodeActive(imgNode.data as CanvasPortraitNodeFields) &&
      !httpsOssFromImageNode(imgNode)
    ) {
      continue;
    }
    const slot = resolveUpstreamMediaSlot(imgNode, link.previewUrl);
    if (slot === "pending") {
      pendingImport.push(link.label);
      continue;
    }
    if (slot) slots.push(slot);
  }

  if (pendingImport.length > 0) {
    return {
      ok: false,
      error: `参考图 ${pendingImport.join("、")} 仍在火山侧处理中。请在对应图片节点等待标题栏勾标出现后再生成。`,
    };
  }

  const styleHttps = resolveNonSbv1ImageHttpsInputs(nodes, edges, engineNodeId);

  if (referenceMode === "first_last") {
    if (slots.length < 1) {
      return {
        ok: false,
        error: "首尾帧模式需要至少一张参考图（已入库 asset:// 或未入库 OSS 均可）。",
      };
    }

    const portraitAssetRefs: PortraitAssetRefPayload[] = [];
    const imageInputs: string[] = [];

    const first = slots[0]!;
    if (first.kind === "asset") {
      portraitAssetRefs.push(portraitRefWithRole(first.url, "first_frame"));
    } else {
      imageInputs.push(first.url);
    }

    const last = slots[1];
    if (last) {
      if (last.kind === "asset") {
        portraitAssetRefs.push(portraitRefWithRole(last.url, "last_frame"));
      } else {
        imageInputs.push(last.url);
      }
    }

    if (
      !prompt &&
      portraitAssetRefs.length === 0 &&
      imageInputs.length === 0 &&
      styleHttps.length === 0
    ) {
      return {
        ok: false,
        error: "请填写 prompt 或连接至少一张参考图。",
      };
    }

    return {
      ok: true,
      imageInputs: [...new Set([...imageInputs, ...styleHttps])],
      portraitAssetRefs: dedupePortraitAssetRefs(portraitAssetRefs),
    };
  }

  const portraitAssetRefs: PortraitAssetRefPayload[] = [];
  const imageInputs: string[] = [];

  for (const slot of slots) {
    if (slot.kind === "asset") {
      portraitAssetRefs.push(portraitRefWithRole(slot.url, "reference_image"));
    } else {
      imageInputs.push(slot.url);
    }
  }

  const dedupedAssets = dedupePortraitAssetRefs(portraitAssetRefs);
  const dedupedImages = [...new Set([...imageInputs, ...styleHttps])];

  if (!prompt && dedupedAssets.length === 0 && dedupedImages.length === 0) {
    return {
      ok: false,
      error: "请填写 prompt 或连接至少一张参考图。",
    };
  }

  return {
    ok: true,
    imageInputs: dedupedImages,
    portraitAssetRefs: dedupedAssets,
  };
}
