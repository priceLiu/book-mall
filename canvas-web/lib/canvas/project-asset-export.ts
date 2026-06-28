/**
 * 从画布节点导出统一项目资产 payload
 */
import type { ProjectAssetKind } from "./project-asset-types";
import { defaultKindForNodeType } from "./project-asset-kind-map";
import {
  mediaUrlFromNodeData,
  firstHttpMediaUrl,
} from "./project-asset-media-url";
import {
  pickAssetPromptFromNodeData,
  sanitizeNodeDataForAssetExport,
} from "./project-asset-node-snapshot";

export type ExportNodeContext = {
  projectId: string;
  edition: "pro" | "pro2" | "sbv1" | "standard";
  nodeId: string;
  nodeType: string;
  data: Record<string, unknown>;
  /** 组保存：子节点快照 */
  groupChildren?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  groupEdges?: Array<{
    id: string;
    source: string;
    target: string;
  }>;
};

export type ExportProjectAssetDraft = {
  kind: ProjectAssetKind;
  displayName: string;
  description: string;
  thumbnailUrl: string;
  sourceProjectId: string | null;
  sourceNodeId: string;
  sourceEdition: string;
  payload: Record<string, unknown>;
  refs: Array<{
    slotKey: string;
    label?: string;
    mediaUrl: string;
    mimeType?: string | null;
  }>;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function exportNodeToProjectAssetDraft(
  ctx: ExportNodeContext,
  kindOverride?: ProjectAssetKind,
): ExportProjectAssetDraft {
  const kind = kindOverride ?? defaultKindForNodeType(ctx.nodeType);
  const d = ctx.data;
  const title =
    str(d.title) ||
    str(d.label) ||
    str(d.displayName) ||
    str(d.characterKey) ||
    "未命名资产";

  const mediaUrl = mediaUrlFromNodeData(d);
  let thumbnailUrl =
    mediaUrl ||
    firstHttpMediaUrl(d.imageUrl, d.videoUrl, d.previewUrl, d.thumbnailUrl);
  const refs: ExportProjectAssetDraft["refs"] = [];
  const payload: Record<string, unknown> = {};
  const prompt = pickAssetPromptFromNodeData(d);

  switch (kind) {
    case "OUTLINE":
      payload.markdown =
        str(d.generatedOutlineMd) ||
        str(d.themeOutline) ||
        str(d.uploadedScriptMd) ||
        str(d.outlineMd);
      break;
    case "STORYBOARD_SCRIPT":
      payload.markdown = str(d.outlineMd) || str(d.scriptMd);
      break;
    case "STORYBOARD_IMAGE":
      payload.prompt = prompt || str(d.prompt) || str(d.imagePrompt);
      payload.role = d.pro2MediaRole ?? "frame";
      if (thumbnailUrl) {
        refs.push({ slotKey: "main", mediaUrl: thumbnailUrl });
      }
      break;
    case "CHARACTER":
      payload.characterKey = str(d.characterKey) || title;
      payload.prompt = prompt;
      if (thumbnailUrl) {
        refs.push({ slotKey: "three_view", mediaUrl: thumbnailUrl });
      }
      break;
    case "STORYBOARD_VIDEO":
      payload.prompt = prompt || str(d.prompt) || str(d.videoPrompt);
      payload.duration = d.duration;
      if (thumbnailUrl) {
        refs.push({
          slotKey: "video",
          mediaUrl: thumbnailUrl,
          mimeType: "video/*",
        });
      }
      break;
    case "STYLE":
      payload.anchorText = str(d.styleAnchorZh) || str(d.anchorZh);
      payload.refUrls = Array.isArray(d.refImageUrls) ? d.refImageUrls : [];
      for (const url of payload.refUrls as string[]) {
        refs.push({ slotKey: `ref_${refs.length}`, mediaUrl: url });
        if (!thumbnailUrl) thumbnailUrl = url;
      }
      break;
    case "PROMPT":
      payload.text = prompt || str(d.themeOutline);
      break;
    case "GROUP_BUNDLE":
      payload.edition = ctx.edition;
      if (d.pro2Kind) payload.pro2Kind = d.pro2Kind;
      payload.layout = {
        nodes: (ctx.groupChildren ?? []).map((child) => ({
          ...child,
          data: sanitizeNodeDataForAssetExport({
            ...child.data,
            ...(mediaUrlFromNodeData(child.data)
              ? { ossUrl: mediaUrlFromNodeData(child.data) }
              : {}),
          }),
        })),
        edges: ctx.groupEdges ?? [],
      };
      for (const child of ctx.groupChildren ?? []) {
        const url = mediaUrlFromNodeData(child.data);
        if (url) {
          refs.push({
            slotKey: child.id,
            label:
              str(child.data.label) ||
              str(child.data.title) ||
              str(child.data.characterKey) ||
              child.type,
            mediaUrl: url,
          });
          if (!thumbnailUrl) thumbnailUrl = url;
        }
      }
      break;
    case "SCRIPT_PACKAGE":
      payload.markdown =
        str(d.scriptStudioCompletedBatchesMd) ||
        str(d.outlineMd) ||
        str(d.generatedOutlineMd);
      payload.frozenBiblesMd = str(d.scriptStudioFrozenBiblesMd);
      payload.frozenBiblesOssUrl = str(d.scriptStudioFrozenBiblesOssUrl);
      payload.completedBatchesOssUrl = str(d.scriptStudioCompletedBatchesOssUrl);
      payload.totalEpisodes = d.scriptStudioTotalEpisodes;
      payload.batchIndex = d.scriptStudioBatchIndex;
      payload.system = d.scriptStudioSystem;
      break;
    default:
      if (thumbnailUrl) refs.push({ slotKey: "main", mediaUrl: thumbnailUrl });
  }

  payload.nodeType = ctx.nodeType;
  payload.nodeSnapshot = sanitizeNodeDataForAssetExport({
    ...d,
    ...(mediaUrl ? { ossUrl: mediaUrl } : {}),
  });
  if (prompt) payload.prompt = prompt;

  return {
    kind,
    displayName: title,
    description: prompt || str(payload.markdown)?.slice(0, 200) || "",
    thumbnailUrl,
    sourceProjectId: ctx.projectId,
    sourceNodeId: ctx.nodeId,
    sourceEdition: ctx.edition,
    payload,
    refs,
  };
}
