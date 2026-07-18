import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
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
import {
  isSbv1VideoEngineRefImageNode,
  resolveSbv1UpstreamRefLinks,
} from "./sbv1-upstream-ref-links";
import {
  getSbv1VideoDockModeChips,
  isDashscopeSbv1TextToVideoModel,
  resolveSbv1DockInputMode,
  sbv1VideoModelUsesPortraitLibrary,
} from "./sbv1-video-model-reference";
import type { Sbv1ReferenceMode } from "./sbv1-workspace-types";
import { directPredecessors } from "./topo";
import type { Sbv1VideoEngineNodeData } from "./sbv1-workspace-types";
import { resolvePro2VideoBoardCellDefaultPrompt } from "./pro2-video-board-dock-links";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type ResolveSbv1VideoEngineInputsResult =
  | {
      ok: true;
      imageInputs: string[];
      portraitAssetRefs: PortraitAssetRefPayload[];
      videoInputs: string[];
    }
  | { ok: false; error: string };

function uniqueDirectPredecessors(edges: CanvasFlowEdge[], nodeId: string): string[] {
  return [...new Set(directPredecessors(edges, nodeId))];
}

/** 非图片参考上游（如风格资产）仍可走 HTTPS；图片节点已由 upstreamLinks 处理，跳过避免重复 */
function resolveNonSbv1ImageHttpsInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  engineNodeId: string,
): string[] {
  const out: string[] = [];
  for (const pid of uniqueDirectPredecessors(edges, engineNodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p || isSbv1VideoEngineRefImageNode(p)) continue;
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
  const d = node.data as {
    ossUrl?: string;
    blobUrl?: string;
    modelKey?: string;
    runtime?: { ossUrl?: string; ephemeralUrl?: string };
  };
  const oss = String(d.ossUrl ?? "").trim();
  if (/^https:\/\//.test(oss)) return oss;
  const fromRuntime = pickRuntimeImagePreviewUrl(d.runtime, d.modelKey ?? "");
  if (fromRuntime && /^https:\/\//.test(fromRuntime)) return fromRuntime;
  const blob = String(d.blobUrl ?? "").trim();
  if (/^https:\/\//.test(blob)) return blob;
  return null;
}

type UpstreamMediaSlot =
  | { kind: "asset"; url: string }
  | { kind: "oss"; url: string };

function resolveHttpsOssSlot(
  imgNode: CanvasFlowNode,
  previewUrl?: string,
): string | null {
  return (
    httpsOssFromImageNode(imgNode) ??
    (previewUrl && /^https:\/\//.test(previewUrl) ? previewUrl : null)
  );
}

/**
 * 上游参考图解析：
 * - Seedance（火山）：节点已打入库标记 active → asset://；否则 OSS HTTPS
 * - 其它模型：一律 OSS HTTPS，忽略入库标记
 */
function resolveUpstreamMediaSlot(
  imgNode: CanvasFlowNode,
  previewUrl: string | undefined,
  usePortraitLibrary: boolean,
): UpstreamMediaSlot | "pending" | null {
  if (!usePortraitLibrary) {
    const oss = resolveHttpsOssSlot(imgNode, previewUrl);
    return oss ? { kind: "oss", url: oss } : null;
  }

  const importState = portraitImportUiState(
    imgNode.data as CanvasPortraitNodeFields,
  );
  if (importState === "pending") return "pending";

  const ref = portraitAssetRefFromNodeData(
    imgNode.data as CanvasPortraitNodeFields,
  );
  if (ref) return { kind: "asset", url: ref.url };

  const oss = resolveHttpsOssSlot(imgNode, previewUrl);
  if (oss) return { kind: "oss", url: oss };
  return null;
}

function httpsVideoUrlFromNode(node: CanvasFlowNode): string | null {
  if (node.type !== "sbv1-video-engine") return null;
  const d = node.data as {
    runtime?: { ossUrl?: string; ephemeralUrl?: string };
  };
  const url = String(
    d.runtime?.ossUrl ?? d.runtime?.ephemeralUrl ?? "",
  ).trim();
  return /^https?:\/\//.test(url) ? url : null;
}

/** 动作控制 · 驱动视频（连到 in_motion_video 的上游视频节点 OSS） */
function resolveMotionVideoInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  engineNodeId: string,
): string[] {
  const out: string[] = [];
  for (const e of edges) {
    if (e.target !== engineNodeId) continue;
    if (e.targetHandle !== "in_motion_video") continue;
    const src = nodes.find((n) => n.id === e.source);
    if (!src) continue;
    const url = httpsVideoUrlFromNode(src);
    if (url) out.push(url);
  }
  return [...new Set(out)];
}

/** sbv1 视频引擎 · 合并 prompt / dockInput / Pro2 分镜脚本 */
export function resolveSbv1VideoEngineEffectivePrompt(
  nodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.type !== "sbv1-video-engine") return "";
  const d = node.data as Sbv1VideoEngineNodeData;
  const direct = String(d.prompt ?? "").trim() || String(d.dockInput ?? "").trim();
  if (direct) return direct;
  return resolvePro2VideoBoardCellDefaultPrompt(nodeId, nodes, edges);
}

/**
 * sbv1 视频合成 · 参考图路由：
 * - 仅 Seedance：已入库（portraitStatus=active）→ asset://；未入库 → OSS
 * - 其它模型（百炼 R2V / 可灵 / KIE 等）：一律 OSS HTTPS，不要求入库
 * - 全能参考（omni）：始终提交全部已连接参考图；@ 仅写在 prompt 里
 */
export function resolveSbv1VideoEngineInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  engineNodeId: string,
  opts: {
    prompt?: string;
    referenceMode?: Sbv1ReferenceMode;
    dockInputMode?: import("./sbv1-workspace-types").Sbv1DockInputMode;
    modelKey?: string;
    providerId?: string;
  },
): ResolveSbv1VideoEngineInputsResult {
  const prompt = String(opts.prompt ?? "").trim();
  const referenceMode = opts.referenceMode ?? "omni";
  const modelKey = opts.modelKey?.trim() ?? "";
  const usePortraitLibrary = sbv1VideoModelUsesPortraitLibrary(
    modelKey,
    opts.providerId,
  );
  const dockChips = modelKey
    ? getSbv1VideoDockModeChips(modelKey, { providerId: opts.providerId })
    : [];
  const effectiveDockMode = resolveSbv1DockInputMode(
    referenceMode,
    opts.dockInputMode,
    dockChips,
  );
  const allowTextToVideo =
    effectiveDockMode === "t2v" ||
    isDashscopeSbv1TextToVideoModel(modelKey);
  const isTopazHdVideo =
    opts.modelKey?.trim() === "topaz-labs/video-enhance" ||
    opts.modelKey?.trim() === "topaz/video-upscale";
  const upstreamLinks = resolveSbv1UpstreamRefLinks(engineNodeId, nodes, edges);
  const mentionedIds = parseReferencedIds(prompt);
  // 全能参考：始终提交全部已连接参考图（@ 仅影响 prompt 文案，不裁剪参考图列表）
  // 其它模式：有 @ 时仅提交被引用项；@ id 失效时回退全部（与 dockMentionRefUrlsForPrompt 一致）
  let activeLinks = upstreamLinks;
  if (referenceMode !== "omni" && mentionedIds.length > 0) {
    const mentioned = upstreamLinks.filter((l) => mentionedIds.includes(l.id));
    if (mentioned.length > 0) activeLinks = mentioned;
  }

  const slots: UpstreamMediaSlot[] = [];
  const pendingImport: string[] = [];

  for (const link of activeLinks) {
    const imgNode = nodes.find((n) => n.id === link.sourceNodeId);
    if (!imgNode || !isSbv1VideoEngineRefImageNode(imgNode)) continue;

    const hasOss = Boolean(resolveHttpsOssSlot(imgNode, link.previewUrl));
    const portraitActive = isPortraitNodeActive(
      imgNode.data as CanvasPortraitNodeFields,
    );
    if (!hasOss && !(usePortraitLibrary && portraitActive)) {
      continue;
    }

    const slot = resolveUpstreamMediaSlot(
      imgNode,
      link.previewUrl,
      usePortraitLibrary,
    );
    if (slot === "pending") {
      pendingImport.push(link.label);
      continue;
    }
    if (slot) slots.push(slot);
  }

  if (usePortraitLibrary && pendingImport.length > 0) {
    return {
      ok: false,
      error: `参考图 ${pendingImport.join("、")} 仍在火山侧处理中。请在对应图片节点等待标题栏勾标出现后再生成。`,
    };
  }

  const styleHttps = resolveNonSbv1ImageHttpsInputs(nodes, edges, engineNodeId);
  const videoInputs = resolveMotionVideoInputs(nodes, edges, engineNodeId);

  if (referenceMode === "first_last") {
    if (slots.length < 1 && !allowTextToVideo) {
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
      styleHttps.length === 0 &&
      !allowTextToVideo
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
      videoInputs,
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

  if (
    !prompt &&
    dedupedAssets.length === 0 &&
    dedupedImages.length === 0 &&
    !allowTextToVideo &&
    !(isTopazHdVideo && videoInputs.length > 0)
  ) {
    return {
      ok: false,
      error: isTopazHdVideo
        ? "请连接上游视频节点后再生成高清视频。"
        : "请填写 prompt 或连接至少一张参考图。",
    };
  }

  if (!usePortraitLibrary && dedupedImages.length === 0 && upstreamLinks.length > 0) {
    return {
      ok: false,
      error:
        "请确认上游图片已生成完成并上传 OSS 后再生成视频（非 Seedance 模型直接使用 OSS 参考图，无需入库）。",
    };
  }

  return {
    ok: true,
    imageInputs: dedupedImages,
    portraitAssetRefs: dedupedAssets,
    videoInputs,
  };
}
