import { fetchCanvasPortraitImportStatus } from "./portrait-import-api";
import type { CanvasPortraitNodeFields } from "./portrait-node-data";
import {
  buildPortraitAssetUri,
  isPortraitNodeActive,
} from "./portrait-node-data";
import { resolveSbv1UpstreamRefLinks } from "./sbv1-upstream-ref-links";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

type UpdateNodeData = (
  id: string,
  patch: Record<string, unknown>,
) => void;

/** 生视频前：轮询上游 sbv1-image 上 pending 的入库任务并写回节点 */
export async function refreshSbv1UpstreamPortraitStatuses(opts: {
  base: string;
  engineNodeId: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  updateNodeData: UpdateNodeData;
  projectId?: string;
}): Promise<void> {
  const links = resolveSbv1UpstreamRefLinks(
    opts.engineNodeId,
    opts.nodes,
    opts.edges,
  );
  await Promise.all(
    links.map(async (link) => {
      const imgNode = opts.nodes.find((n) => n.id === link.sourceNodeId);
      if (!imgNode || imgNode.type !== "sbv1-image") return;
      const d = imgNode.data as CanvasPortraitNodeFields;
      if (isPortraitNodeActive(d)) return;
      const assetId = String(d.portraitAssetId ?? "").trim();
      if (!assetId || d.portraitStatus !== "pending") return;
      try {
        const final = await fetchCanvasPortraitImportStatus(opts.base, {
          assetId,
          kind: d.portraitKind ?? "virtual",
          edition: "sbv1",
          projectId: opts.projectId,
        });
        const assetUri = final.assetUri?.startsWith("asset://")
          ? final.assetUri
          : buildPortraitAssetUri(final.assetId);
        opts.updateNodeData(link.sourceNodeId, {
          portraitKind: final.kind,
          portraitAssetId: final.assetId,
          portraitAssetUri: assetUri,
          portraitStatus: final.status,
          portraitGroupId: final.groupId,
          portraitImportMessage: final.message,
        });
      } catch {
        /* 状态查询失败时不阻断生成，由 resolve 给出明确错误 */
      }
    }),
  );
}
