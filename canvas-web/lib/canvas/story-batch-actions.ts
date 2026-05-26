"use client";

import type { StoryComicPipelineStage } from "./types";
import {
  batchCreateThreeView,
  batchCreateFrameImages,
  batchCreateFrameVideos,
  batchCreateFrameTts,
  wireFrameImageCharacterRefs,
  findStoryboardFramesMissingThreeView,
  allFrameImageNodesExist,
  collectThreeViewEngineIdsForCharacters,
  collectFrameEngineIds,
  applyEnginePickToNodes,
  spawnFrameVideoForImage,
  spawnFrameTtsForImage,
  type BatchArgs,
} from "./story-batch-spawn";
import type { CanvasEnginePick } from "./types";
import { parseCharacterRows, parseStoryboardRows } from "./parse-md-tables";
import { batchRunNodesSequential } from "./batch-run-nodes";
import { batchRunStoryRowsSequential } from "./batch-run-nodes";
import { findStoryWorkspaceIds } from "./story-column-display";
import { findStoryLlmEngines } from "./spawn-story-llm-engines";
import type { StoryEngineNodeData } from "./types";
import type { StoryBatchRunOptions } from "@/components/canvas/story-engine-actions-modal";

export type StoryBatchStore = {
  nodes: import("./types").CanvasFlowNode[];
  edges: import("./types").CanvasFlowEdge[];
  getNodes: () => import("./types").CanvasFlowNode[];
  addNode: BatchArgs["addNode"];
  addNodeInGroup?: BatchArgs["addNodeInGroup"];
  setEdges: BatchArgs["setEdges"];
  reparentNode: BatchArgs["reparentNode"];
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  reflowStoryComicLayout: () => void;
};

export function patchStarterPipelineStage(
  updateNodeData: StoryBatchStore["updateNodeData"],
  nodes: StoryBatchStore["nodes"],
  stage: StoryComicPipelineStage,
) {
  const starter = nodes.find((n) => n.type === "story-comic-starter");
  if (starter) updateNodeData(starter.id, { pipelineStage: stage });
}

function batchBase(store: StoryBatchStore, sourceNodeId: string): BatchArgs {
  return {
    sourceNodeId,
    markdown: "",
    nodes: store.nodes,
    getNodes: store.getNodes,
    edges: store.edges,
    addNode: store.addNode,
    addNodeInGroup: store.addNodeInGroup,
    setEdges: store.setEdges,
    reparentNode: store.reparentNode,
  };
}

function characterEngineNode(store: StoryBatchStore) {
  return store.getNodes().find((n) => n.type === "character-engine");
}

function storyboardEngineNode(store: StoryBatchStore) {
  return store.getNodes().find((n) => n.type === "storyboard-engine");
}

export function getCharacterMarkdown(store: StoryBatchStore): string {
  const n = characterEngineNode(store);
  return (n?.data as StoryEngineNodeData).runtime?.textOutput ?? "";
}

export function getStoryboardMarkdown(store: StoryBatchStore): string {
  const n = storyboardEngineNode(store);
  return (n?.data as StoryEngineNodeData).runtime?.textOutput ?? "";
}

export function buildCharacterBatchSelectItems(md: string) {
  return parseCharacterRows(md).map((c) => ({
    key: c.name,
    label: c.name,
    hint: c.role,
  }));
}

export function buildStoryboardBatchSelectItems(md: string) {
  return parseStoryboardRows(md).map((r) => {
    const tipLines = [
      r.scene ? `场景：${r.scene}` : null,
      r.description ? `画面：${r.description}` : null,
      r.dialogue ? `对白：${r.dialogue}` : null,
      r.videoPrompt ? `视频：${r.videoPrompt}` : null,
    ].filter(Boolean);
    return {
      key: String(r.frameIndex),
      label: `镜 ${r.frameIndex}`,
      hint: r.scene || r.description.slice(0, 24),
      tip: tipLines.length ? tipLines.join("\n") : undefined,
    };
  });
}

/** 故事大纲 · 生成三视图（数据来自角色设定引擎） */
export async function runThreeViewBatchAction(
  store: StoryBatchStore,
  opts: StoryBatchRunOptions & {
    characterNodeId: string;
    batchImage: NonNullable<StoryEngineNodeData["batchImage"]>;
  },
): Promise<{ ok: true } | { ok: false; title: string; message: string }> {
  const { selectedKeys, forceFresh, characterNodeId, batchImage } = opts;
  const md = getCharacterMarkdown(store);
  if (!selectedKeys.length) {
    return { ok: false, title: "未选择角色", message: "请至少勾选一个要生成三视图的角色。" };
  }
  if (!batchImage?.providerId?.trim() || !batchImage?.modelKey?.trim()) {
    return {
      ok: false,
      title: "请选择 IMAGE 模型",
      message: "请在角色设定节点配置三视图生图模型后再批量生成。",
    };
  }
  if (!md.trim()) {
    return {
      ok: false,
      title: "请先完成角色设定",
      message: "需要先生成角色 Markdown 表格，再批量创建三视图。",
    };
  }
  if (!parseCharacterRows(md).length) {
    return {
      ok: false,
      title: "无法解析角色表",
      message: "请确认输出为 GFM 表格，且含角色与外观描述列。",
    };
  }

  const ws = findStoryWorkspaceIds(store.getNodes());
  if (ws?.characterColumnId) {
    store.updateNodeData(ws.characterColumnId, {
      batchImage: {
        providerId: batchImage.providerId,
        modelKey: batchImage.modelKey,
        params: batchImage.params ?? {},
      },
    });
    batchRunStoryRowsSequential(ws.characterColumnId, selectedKeys, "threeView", {
      forceFresh,
    });
    patchStarterPipelineStage(store.updateNodeData, store.getNodes(), "tv_done");
    return { ok: true };
  }

  batchCreateThreeView({
    ...batchBase(store, characterNodeId),
    markdown: md,
    onlyCharacterNames: selectedKeys,
    imageDefaults: {
      providerId: batchImage.providerId,
      modelKey: batchImage.modelKey,
      params: batchImage.params ?? {},
    },
  });
  store.reflowStoryComicLayout();

  const tvIds = collectThreeViewEngineIdsForCharacters(
    store.getNodes(),
    selectedKeys,
  );
  applyEnginePickToNodes(tvIds, batchImage, store.updateNodeData);
  window.setTimeout(() => {
    batchRunNodesSequential(tvIds, { forceFresh });
  }, 0);
  patchStarterPipelineStage(store.updateNodeData, store.getNodes(), "tv_done");
  return { ok: true };
}

/** 角色设定 · 生成分镜图节点 */
export async function runFrameImagesBatchAction(
  store: StoryBatchStore,
  opts: StoryBatchRunOptions & {
    storyboardNodeId: string;
    batchImage: NonNullable<StoryEngineNodeData["batchImage"]>;
    autoRunImages?: boolean;
  },
): Promise<{ ok: true; imgIds: string[] } | { ok: false; title: string; message: string }> {
  const { selectedKeys, storyboardNodeId, batchImage, autoRunImages } = opts;
  const md = getStoryboardMarkdown(store);
  const frameIndices = selectedKeys
    .map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n));
  if (!frameIndices.length) {
    return { ok: false, title: "未选择镜号", message: "请至少勾选一镜。" };
  }
  if (!batchImage?.providerId?.trim() || !batchImage?.modelKey?.trim()) {
    return {
      ok: false,
      title: "请选择 IMAGE 模型",
      message: "请配置分镜图 IMAGE 模型后再创建节点。",
    };
  }
  if (!md.trim()) {
    return { ok: false, title: "缺少分镜脚本", message: "请先完成分镜脚本文案生成。" };
  }

  const nodes = store.getNodes();
  const updateOnly = allFrameImageNodesExist(nodes, frameIndices);

  if (!updateOnly) {
    const frameGaps = findStoryboardFramesMissingThreeView({
      markdown: md,
      nodes,
      onlyFrameIndices: frameIndices,
    });
    if (frameGaps.length) {
      const lines = frameGaps.map((g) => {
        const chars = g.characters
          .map((c) =>
            c.reason === "no_node"
              ? `${c.name}（未创建三视图）`
              : `${c.name}（三视图未生成）`,
          )
          .join("、");
        return `镜 ${g.frameIndex}：${chars}`;
      });
      return {
        ok: false,
        title: "请先完成本镜涉及的角色三视图",
        message: `以下选中镜号涉及的角色三视图尚未就绪：\n\n${lines.map((l) => `· ${l}`).join("\n")}\n\n请先在故事大纲节点点击「生成三视图」。`,
      };
    }
  }

  batchCreateFrameImages({
    ...batchBase(store, storyboardNodeId),
    markdown: md,
    onlyFrameIndices: frameIndices,
    imageDefaults: {
      providerId: batchImage.providerId,
      modelKey: batchImage.modelKey,
      params: batchImage.params ?? {},
    },
  });
  wireFrameImageCharacterRefs({
    ...batchBase(store, storyboardNodeId),
    markdown: md,
    onlyFrameIndices: frameIndices,
    updateNodeData: store.updateNodeData,
  });
  store.reflowStoryComicLayout();

  const imgIds = collectFrameEngineIds(
    store.getNodes(),
    "image-engine",
    frameIndices,
  );
  applyEnginePickToNodes(imgIds, batchImage, store.updateNodeData);

  if (autoRunImages && imgIds.length) {
    window.setTimeout(() => {
      batchRunNodesSequential(imgIds);
    }, 0);
  }

  patchStarterPipelineStage(store.updateNodeData, store.getNodes(), "frames_done");
  return { ok: true, imgIds };
}

/** 分镜脚本 · 批量创建视频 + TTS 并顺序执行 */
export async function runFrameMediaBatchAction(
  store: StoryBatchStore,
  opts: {
    storyboardNodeId: string;
    frameIndices?: number[];
    videoDefaults?: CanvasEnginePick;
    ttsDefaults?: CanvasEnginePick;
    forceFresh?: boolean;
  },
): Promise<{ ok: true; runIds: string[] } | { ok: false; title: string; message: string }> {
  const md = getStoryboardMarkdown(store);
  if (!md.trim()) {
    return { ok: false, title: "缺少分镜脚本", message: "请先完成分镜脚本。" };
  }

  const rows = parseStoryboardRows(md);
  const indices =
    opts.frameIndices?.length ?
      opts.frameIndices
    : rows.map((r) => r.frameIndex);

  const base = batchBase(store, opts.storyboardNodeId);
  base.markdown = md;

  batchCreateFrameVideos({
    ...base,
    onlyFrameIndices: indices,
    videoDefaults: opts.videoDefaults,
  });
  batchCreateFrameTts({
    ...base,
    onlyFrameIndices: indices,
  });
  store.reflowStoryComicLayout();

  const nodes = store.getNodes();
  const edges = store.edges;
  const runIds: string[] = [];

  for (const fi of indices) {
    const imgNode = nodes.find(
      (n) =>
        n.type === "image-engine" &&
        (n.data as { frameIndex?: number }).frameIndex === fi,
    );
    if (!imgNode) continue;

    if (opts.videoDefaults?.providerId && opts.videoDefaults.modelKey) {
      const vid = await spawnFrameVideoForImage({
        imageEngineId: imgNode.id,
        nodes,
        getNodes: store.getNodes,
        edges,
        addNode: store.addNode,
        addNodeInGroup: store.addNodeInGroup,
        setEdges: store.setEdges,
        reparentNode: store.reparentNode,
        updateNodeData: store.updateNodeData,
        videoPick: opts.videoDefaults,
      });
      if (vid) runIds.push(vid);
    }

    if (opts.ttsDefaults?.providerId && opts.ttsDefaults.modelKey) {
      const tts = await spawnFrameTtsForImage({
        imageEngineId: imgNode.id,
        nodes: store.getNodes(),
        getNodes: store.getNodes,
        edges,
        addNode: store.addNode,
        addNodeInGroup: store.addNodeInGroup,
        setEdges: store.setEdges,
        reparentNode: store.reparentNode,
        updateNodeData: store.updateNodeData,
        ttsPick: opts.ttsDefaults,
      });
      if (tts) runIds.push(tts);
    }
  }

  if (runIds.length) {
    window.setTimeout(() => {
      batchRunNodesSequential(runIds, { forceFresh: opts.forceFresh });
    }, 0);
  }

  patchStarterPipelineStage(store.updateNodeData, store.getNodes(), "media_done");
  return { ok: true, runIds };
}

export function resolveStoryEngineIds(store: StoryBatchStore) {
  return findStoryLlmEngines(store.getNodes());
}

/** 视频列 group 底栏：从分镜脚本节点批量创建并跑视频+TTS */
export async function runFrameMediaBatchFromStoryboard(
  store: StoryBatchStore,
  dialogs: {
    alert: (args: {
      title: string;
      message: string;
      variant?: "warning" | "error";
    }) => Promise<void>;
  },
): Promise<void> {
  const sb = storyboardEngineNode(store);
  if (!sb) {
    await dialogs.alert({
      title: "缺少分镜脚本",
      message: "请先完成漫剧启动，生成故事大纲、角色与分镜脚本。",
      variant: "warning",
    });
    return;
  }
  const d = sb.data as StoryEngineNodeData;
  const video =
    d.batchVideo ??
    (d.providerId && d.modelKey ?
      {
        providerId: d.providerId,
        modelKey: d.modelKey,
        params: d.params ?? {},
      }
    : undefined);
  if (!video?.providerId || !video.modelKey) {
    await dialogs.alert({
      title: "请选择 VIDEO 模型",
      message: "请打开「分镜脚本」节点，在文案弹层配置视频模型后再批量生成。",
      variant: "warning",
    });
    return;
  }
  const res = await runFrameMediaBatchAction(store, {
    storyboardNodeId: sb.id,
    videoDefaults: video,
    ttsDefaults: d.batchTts,
  });
  if (!res.ok) {
    await dialogs.alert({
      title: res.title,
      message: res.message,
      variant: "warning",
    });
  }
}
