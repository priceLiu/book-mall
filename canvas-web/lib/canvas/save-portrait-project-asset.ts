import {
  createProjectAsset,
  listProjectAssets,
} from "@/lib/canvas-api";
import type {
  CanvasPortraitKind,
  CanvasPortraitNodeFields,
} from "@/lib/canvas/portrait-node-data";
import { detectCanvasEditionFromNodes } from "./spawn-project-asset-on-canvas";
import type { CanvasFlowNode } from "./types";
import { notifyProjectAssetsChanged } from "@/lib/canvas/use-project-assets";

export type SavePortraitProjectAssetInput = {
  base: string;
  displayName: string;
  imageUrl: string;
  assetUri: string;
  assetId: string;
  portraitKind: CanvasPortraitKind;
  portraitStatus: "active" | "pending" | "failed";
  groupId?: string;
  projectId?: string;
  nodeId?: string;
  edition: "sbv1" | "pro2";
};

function portraitAssetDisplayName(raw: string): string {
  const trimmed = raw.trim() || "未命名人像";
  const stripped = trimmed.replace(/^分镜图\s*[·:.：\-—]\s*/u, "").trim();
  if (/^私域人像/u.test(stripped)) return stripped;
  return `私域人像 · ${stripped || "未命名"}`;
}

/** 私域人像入库成功后写入项目资产库（含 asset://，插入画布即可生视频） */
export async function savePortraitToProjectAssets(
  input: SavePortraitProjectAssetInput,
): Promise<{ created: boolean; assetId?: string }> {
  if (input.portraitStatus !== "active" || !input.assetUri.startsWith("asset://")) {
    return { created: false };
  }
  if (!input.assetId.trim() || !input.portraitKind) {
    return { created: false };
  }

  const displayName = portraitAssetDisplayName(input.displayName);

  let dup: { id: string } | undefined;
  try {
    const existing = await listProjectAssets(input.base, {
      kind: "PRIVATE_PORTRAIT",
      scope: "all",
    });
    dup = existing.assets.find(
      (a) => String(a.payload?.portraitAssetId ?? "") === input.assetId,
    );
  } catch {
    /* 枚举未迁移等：跳过去重，直接尝试创建 */
  }
  if (dup) {
    notifyProjectAssetsChanged();
    return { created: false, assetId: dup.id };
  }

  const nodeType = input.edition === "sbv1" ? "sbv1-image" : "story-pro2-image";
  const nodeSnapshot = {
    label: displayName,
    ossUrl: input.imageUrl,
    portraitKind: input.portraitKind,
    portraitAssetId: input.assetId,
    portraitAssetUri: input.assetUri,
    portraitStatus: "active" as const,
    portraitGroupId: input.groupId,
  };

  const asset = await createProjectAsset(input.base, {
    kind: "PRIVATE_PORTRAIT",
    displayName,
    description: input.assetUri,
    thumbnailUrl: input.imageUrl,
    sourceProjectId: input.projectId ?? null,
    sourceNodeId: input.nodeId ?? null,
    sourceEdition: input.edition,
    payload: {
      nodeType,
      nodeSnapshot,
      portraitKind: input.portraitKind,
      portraitAssetId: input.assetId,
      portraitAssetUri: input.assetUri,
      portraitStatus: "active",
      portraitGroupId: input.groupId,
      sourceOssUrl: input.imageUrl,
    },
    refs: [
      {
        slotKey: "source",
        label: "源图",
        mediaUrl: input.imageUrl,
        mimeType: "image/png",
        sortOrder: 0,
      },
    ],
  });

  notifyProjectAssetsChanged();
  return { created: true, assetId: asset.id };
}

/** 将画布上已入库的人像节点补写入项目资产「私域人像库」（幂等） */
export async function backfillPortraitProjectAssetsFromCanvas(input: {
  base: string;
  projectId?: string;
  nodes: CanvasFlowNode[];
  edition?: "sbv1" | "pro2";
}): Promise<{ synced: number }> {
  const edition =
    input.edition ??
    (detectCanvasEditionFromNodes(input.nodes) === "sbv1" ? "sbv1" : "pro2");
  if (edition !== "sbv1" && edition !== "pro2") return { synced: 0 };

  let synced = 0;
  for (const node of input.nodes) {
    if (node.type !== "sbv1-image" && node.type !== "story-pro2-image") continue;
    const d = node.data as CanvasPortraitNodeFields & {
      ossUrl?: string;
      blobUrl?: string;
      label?: string;
    };
    if (d.portraitStatus !== "active" || !d.portraitKind) continue;
    const assetUri = String(d.portraitAssetUri ?? "").trim();
    const assetId = String(d.portraitAssetId ?? "").trim();
    const imageUrl = String(d.ossUrl ?? d.blobUrl ?? "").trim();
    if (!assetUri.startsWith("asset://") || !assetId || !/^https:\/\//.test(imageUrl)) {
      continue;
    }
    try {
      const r = await savePortraitToProjectAssets({
        base: input.base,
        displayName: String(d.label ?? "canvas-portrait"),
        imageUrl,
        assetUri,
        assetId,
        portraitKind: d.portraitKind,
        portraitStatus: "active",
        groupId: d.portraitGroupId,
        projectId: input.projectId,
        nodeId: node.id,
        edition,
      });
      if (r.created) synced += 1;
    } catch {
      /* 单条失败不阻断其余节点 */
    }
  }
  return { synced };
}
