import { nanoid } from "nanoid";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  PRO2_3D_DESK_NODE_WIDTH,
  PRO2_IMAGE_NODE_HEIGHT,
} from "./story-pro2-node-chrome";
import { useCanvasStore } from "./store";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const SHOT_GAP = 48;

function dataUrlToFile(dataUrl: string, fileName: string): File | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return null;
  const head = dataUrl.slice(5, comma);
  const mime = head.split(";")[0] || "image/png";
  const isBase64 = /;base64/i.test(head);
  const body = dataUrl.slice(comma + 1);
  try {
    const bin = isBase64 ? atob(body) : decodeURIComponent(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
    return new File([arr], fileName, { type: mime });
  } catch {
    return null;
  }
}

export function directorDeskDefaultLabel(
  nodes: CanvasFlowNode[],
  deskNodeId: string,
): string {
  const desks = nodes.filter((n) => n.type === "story-pro2-3d-desk");
  const idx = desks.findIndex((n) => n.id === deskNodeId);
  return `导演台 ${idx >= 0 ? idx + 1 : ""}`.trim();
}

export function listDirectorDeskShotNodes(
  deskNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  const shotIds = new Set(
    edges
      .filter((e) => e.source === deskNodeId && e.sourceHandle === "image")
      .map((e) => e.target),
  );
  return nodes.filter(
    (n) =>
      shotIds.has(n.id) &&
      n.type === "story-pro2-image" &&
      (n.data as { pro2MediaRole?: string }).pro2MediaRole ===
        "director-desk-shot",
  );
}

function parseShotSuffix(fileName: string): string {
  return fileName.replace(/\.(png|jpe?g|webp)$/i, "").trim() || "shot";
}

export function buildDirectorDeskShotLabel(args: {
  deskNode: CanvasFlowNode;
  nodes: CanvasFlowNode[];
  fileName: string;
}): string {
  const deskLabel =
    String((args.deskNode.data as { label?: string }).label ?? "").trim() ||
    directorDeskDefaultLabel(args.nodes, args.deskNode.id);
  const suffix = parseShotSuffix(args.fileName);
  return `${deskLabel} ${suffix}`;
}

export function computeDirectorDeskShotPosition(
  deskNode: CanvasFlowNode,
  shotIndex: number,
): { x: number; y: number } {
  const deskW = deskNode.width ?? PRO2_3D_DESK_NODE_WIDTH;
  return {
    x: deskNode.position.x + deskW + SHOT_GAP,
    y: deskNode.position.y + shotIndex * (PRO2_IMAGE_NODE_HEIGHT + SHOT_GAP),
  };
}

export type SpawnDirectorDeskShotArgs = {
  deskNodeId: string;
  fileName: string;
  /** 本地预览 URL（blob: 或 data:） */
  previewUrl: string;
  ossUrl?: string;
};

export function spawnDirectorDeskShotNode(args: SpawnDirectorDeskShotArgs): string {
  const store = useCanvasStore.getState();
  const { nodes, edges, addNode, setEdges, setNodes } = store;
  const deskNode = nodes.find(
    (n) => n.id === args.deskNodeId && n.type === "story-pro2-3d-desk",
  );
  if (!deskNode) return "";

  const existingShots = listDirectorDeskShotNodes(args.deskNodeId, nodes, edges);
  const shotIndex = existingShots.length;
  const position = computeDirectorDeskShotPosition(deskNode, shotIndex);
  const label = buildDirectorDeskShotLabel({
    deskNode,
    nodes,
    fileName: args.fileName,
  });

  const shotId = addNode(
    "story-pro2-image",
    position,
    buildPro2ImageNodeData({
      pro2MediaRole: "director-desk-shot",
      label,
      directorDeskNodeId: args.deskNodeId,
      blobUrl: args.previewUrl,
      ossUrl: args.ossUrl,
      uploading: false,
      uploadError: undefined,
      runtime: undefined,
    }),
  );
  if (!shotId) return "";

  setEdges((prev) => [
    ...prev,
    {
      id: `e-${nanoid(6)}`,
      source: args.deskNodeId,
      target: shotId,
      sourceHandle: "image",
      targetHandle: "in_image",
    },
  ]);

  selectPro2NodeAfterSpawn(setNodes, shotId);
  return shotId;
}

type PendingDeskShotUpload = {
  shotId: string;
  file: File;
  previewUrl: string;
};

function flushAutosaveAfterDeskShotUpload(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("canvas:flush-autosave", { detail: { immediate: true } }),
  );
}

/** OSS 落库在后台进行，不阻塞画布预览与导演台关闭 */
function uploadDirectorDeskShotsInBackground(
  pending: PendingDeskShotUpload[],
  upload: (file: File) => Promise<string>,
): void {
  if (pending.length === 0) return;
  void (async () => {
    let anyUploaded = false;
    for (const item of pending) {
      try {
        const ossUrl = await upload(item.file);
        anyUploaded = true;
        useCanvasStore.getState().updateNodeData(item.shotId, {
          ossUrl,
          blobUrl: undefined,
          uploadError: undefined,
        });
        if (item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      } catch (e) {
        useCanvasStore.getState().updateNodeData(item.shotId, {
          uploadError: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (anyUploaded) flushAutosaveAfterDeskShotUpload();
  })();
}

/**
 * 同步在画布生成机位节点（即时 blob 预览），OSS 上传异步进行。
 * 返回新建的机位节点 id 列表。
 */
export function publishDirectorDeskCapturesToCanvas(args: {
  deskNodeId: string;
  captures: Array<{ dataUrl: string; fileName: string }>;
  upload: (file: File) => Promise<string>;
}): string[] {
  const created: string[] = [];
  const pendingUploads: PendingDeskShotUpload[] = [];

  for (const capture of args.captures) {
    const dataUrl = capture.dataUrl.trim();
    if (!dataUrl) continue;
    const fileName =
      capture.fileName.trim() || `机位${created.length + 1}-shot.png`;
    const file = dataUrlToFile(dataUrl, fileName);
    if (!file) continue;

    const previewUrl = URL.createObjectURL(file);
    const shotId = spawnDirectorDeskShotNode({
      deskNodeId: args.deskNodeId,
      fileName,
      previewUrl,
    });
    if (!shotId) {
      URL.revokeObjectURL(previewUrl);
      continue;
    }
    created.push(shotId);
    pendingUploads.push({ shotId, file, previewUrl });
  }

  uploadDirectorDeskShotsInBackground(pendingUploads, args.upload);
  return created;
}
