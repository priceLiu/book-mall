/**
 * 项目资产 · 节点 data 快照（保留媒体/提示词，剥离连线关系与运行时脏字段）
 */

const EPHEMERAL_KEYS = [
  "blobUrl",
  "uploading",
  "uploadError",
  "activeTaskId",
  "runtime",
] as const;

/** 不写入资产：上游/下游/组归属（组资产 GROUP_BUNDLE 单独存 layout） */
const RELATIONSHIP_KEYS = [
  "pro2HubNodeId",
  "pro2ControllerNodeId",
  "pro2GroupId",
  "pro2RowKey",
  "referencedNodeIds",
  "workspaceIds",
  "linkedStarterId",
  "linkedHubId",
] as const;

export function sanitizeNodeDataForAssetExport(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const k of EPHEMERAL_KEYS) delete out[k];
  for (const k of RELATIONSHIP_KEYS) delete out[k];
  delete out.__t;
  return out;
}

export function pickAssetPromptFromNodeData(
  data: Record<string, unknown>,
): string {
  const candidates = [
    data.dockInput,
    data.prompt,
    data.imagePrompt,
    data.videoPrompt,
    data.styleAnchorZh,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}
