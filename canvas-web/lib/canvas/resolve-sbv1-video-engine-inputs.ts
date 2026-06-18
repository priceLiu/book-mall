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

/**
 * sbv1 视频合成 · 参考图只走私域人像库 asset://，禁止直连 OSS HTTPS。
 * 上游 sbv1-image 须先「私域人像入库」为 active。
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

  const portraitAssetRefs: PortraitAssetRefPayload[] = [];
  const pendingImport: string[] = [];
  const missingImport: string[] = [];

  for (const link of activeLinks) {
    const imgNode = nodes.find((n) => n.id === link.sourceNodeId);
    if (!imgNode || imgNode.type !== "sbv1-image") continue;
    if (!link.previewUrl && !isPortraitNodeActive(imgNode.data as CanvasPortraitNodeFields)) {
      continue;
    }
    const ref = portraitAssetRefFromNodeData(
      imgNode.data as CanvasPortraitNodeFields,
    );
    if (ref) {
      portraitAssetRefs.push(ref);
      continue;
    }
    const importState = portraitImportUiState(
      imgNode.data as CanvasPortraitNodeFields,
    );
    if (importState === "pending") {
      pendingImport.push(link.label);
    } else {
      missingImport.push(link.label);
    }
  }

  if (pendingImport.length > 0) {
    return {
      ok: false,
      error: `参考图 ${pendingImport.join("、")} 仍在火山侧处理中。请在对应图片节点工具栏等待「已入库」后再生成。`,
    };
  }

  if (missingImport.length > 0) {
    return {
      ok: false,
      error: `参考图 ${missingImport.join("、")} 须在被连线的图片节点上完成「私域人像入库」（工具栏显示「已入库」才算就绪）。Gateway 入库成功须写回该节点；若工具栏仍显示「私域人像入库」，请对连线上的图片再点一次入库。生视频时火山只接受 asset:// 引用。`,
    };
  }

  const deduped = dedupePortraitAssetRefs(portraitAssetRefs);
  let refsWithRoles: PortraitAssetRefPayload[] = deduped;

  if (referenceMode === "first_last") {
    if (deduped.length < 1) {
      return {
        ok: false,
        error: "首尾帧模式需要至少一张已入库的参考图。",
      };
    }
    refsWithRoles = [
      portraitRefWithRole(deduped[0]!.url, "first_frame"),
      ...(deduped[1]
        ? [portraitRefWithRole(deduped[1].url, "last_frame")]
        : []),
    ];
  }

  const imageInputs = resolveNonSbv1ImageHttpsInputs(nodes, edges, engineNodeId);

  if (!prompt && refsWithRoles.length === 0 && imageInputs.length === 0) {
    return {
      ok: false,
      error: "请填写 prompt 或连接至少一张已入库的参考图。",
    };
  }

  return {
    ok: true,
    imageInputs,
    portraitAssetRefs: refsWithRoles,
  };
}
