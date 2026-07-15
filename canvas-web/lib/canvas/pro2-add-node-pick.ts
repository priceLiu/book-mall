"use client";

import { flowPositionAtScreenPoint, flowPositionAtViewportCenter } from "./viewport-placement";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  buildPro2TagNodeData,
  buildPro2ThreeViewNodeData,
  spawnPro2ScriptHubAt,
} from "./pro2-spawn-nodes";
import { NODE_DEFAULT_DATA } from "./types";
import { PRO2_CHARACTER_THREE_VIEW_HEIGHT, PRO2_CHARACTER_THREE_VIEW_WIDTH } from "./story-pro2-node-chrome";
import { selectPro2NodeAfterSpawn, focusNodeAfterSpawn } from "./pro2-spawn-select";
import { buildSbv1ImageNodeData, buildSbv1VideoEngineNodeDataForMenuItem, selectSbv1NodeAfterSpawn } from "./sbv1-spawn-nodes";
import {
  resolveLibtvSideSpawnNodeType,
} from "./libtv-side-spawn";
import { resolvePro2ProductionGate, pro2ProductionGateAllowsStageSpawn } from "./pro2-production-gate";
import { useCanvasStore } from "./store";
import type { CanvasNodeType } from "./types";

export type LibtvCanvasEdition = "pro2" | "sbv1";

export type Pro2AddNodePickDialogs = {
  alert: (opts: {
    title: string;
    message: string;
    variant?: "info" | "warning" | "error";
  }) => Promise<void>;
  confirm?: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "info" | "warning" | "error";
  }) => Promise<boolean>;
};

export type Pro2AddNodePickStore = {
  addNode: (
    type:
      | "story-pro2-starter"
      | "story-pro2-tag"
      | "story-pro2-image"
      | "story-pro2-script-hub"
      | "story-pro2-style-asset"
      | "story-pro2-three-view"
      | "story-pro2-style"
      | "story-pro2-character"
      | "story-pro2-scene"
      | "story-pro2-frame"
      | "story-pro2-video"
      | "story-pro2-prop"
      | "story-pro2-mood"
      | "story-pro2-audio"
      | "jianying-export-pro2"
      | "jianying-auto-render-pro2"
      | "sbv1-image"
      | "sbv1-video-engine",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setNodes: (
    fn: (
      nodes: import("./types").CanvasFlowNode[],
    ) => import("./types").CanvasFlowNode[],
  ) => void;
};

export type Pro2ToolbarAddNodePickOptions = {
  onOpenStyleLibrary?: () => void;
  onOpenMyHistory?: () => void;
  edition?: LibtvCanvasEdition;
  spawnAtScreen?: { x: number; y: number };
};

const COMING_SOON: Record<string, string> = {
  audio: "音频节点",
  "fx-library": "特效库",
  upload: "从本地上传资源",
  "ref-node": "参考节点",
};

function spawnPosition(
  type: CanvasNodeType,
  options?: Pro2ToolbarAddNodePickOptions,
  data?: Record<string, unknown>,
) {
  if (options?.spawnAtScreen) {
    return flowPositionAtScreenPoint(type, options.spawnAtScreen, data);
  }
  return flowPositionAtViewportCenter(type, data);
}

function spawnVideoEngine(
  store: Pro2AddNodePickStore,
  options?: Pro2ToolbarAddNodePickOptions,
  itemId = "video",
) {
  const { addNode, setNodes } = store;
  const pos = spawnPosition("sbv1-video-engine", options);
  const id = addNode(
    "sbv1-video-engine",
    pos,
    buildSbv1VideoEngineNodeDataForMenuItem(itemId),
  );
  if (id) selectSbv1NodeAfterSpawn(setNodes, id);
}

function spawnPro2RoleImageNode(
  store: Pro2AddNodePickStore,
  options: Pro2ToolbarAddNodePickOptions | undefined,
  role: "scene" | "prop" | "mood",
  label: string,
): void {
  const { addNode, setNodes } = store;
  const data = buildPro2ImageNodeData({ pro2MediaRole: role, label });
  const pos = spawnPosition("story-pro2-image", options, data);
  const id = addNode("story-pro2-image", pos, data);
  if (id) selectPro2NodeAfterSpawn(setNodes, id);
}

/** 底部工具栏 / 空白画布 · 添加节点菜单统一处理 */
export async function handlePro2ToolbarAddNodePick(
  itemId: string,
  nodeType: string | undefined,
  store: Pro2AddNodePickStore,
  dialogs: Pro2AddNodePickDialogs,
  options?: Pro2ToolbarAddNodePickOptions,
): Promise<void> {
  const { addNode, setNodes } = store;
  const edition = options?.edition ?? "pro2";

  const gate = resolvePro2ProductionGate(
    useCanvasStore.getState().nodes,
    useCanvasStore.getState().graphMeta ?? undefined,
  );
  const stagePick =
    itemId === "character-column" ||
    itemId === "video-column" ||
    itemId === "scene-column" ||
    itemId === "prop-column" ||
    itemId === "mood-column" ||
    itemId === "audio-column";
  if (stagePick && !pro2ProductionGateAllowsStageSpawn(gate)) {
    const ok = await (dialogs.confirm ?? (async () => true))({
      title: "建议先关联剧本",
      message: `${gate.message}\n\n仍要继续添加节点吗？`,
      confirmLabel: "继续添加",
      variant: "warning",
    });
    if (!ok) return;
  }

  if (itemId === "style-library" || itemId === "style") {
    if (options?.onOpenStyleLibrary) {
      options.onOpenStyleLibrary();
    } else {
      window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
    }
    return;
  }

  if (itemId === "history") {
    options?.onOpenMyHistory?.();
    window.dispatchEvent(new CustomEvent("canvas:open-my-history"));
    return;
  }

  if (
    itemId === "video" ||
    itemId === "hd-video" ||
    itemId === "video-compose" ||
    itemId === "video-engine" ||
    nodeType === "sbv1-video-engine"
  ) {
    spawnVideoEngine(store, options, itemId);
    return;
  }

  if (edition === "sbv1") {
    if (itemId === "image" || nodeType === "sbv1-image" || nodeType === "story-pro2-image") {
      const pos = spawnPosition("sbv1-image", options);
      const id = addNode("sbv1-image", pos, buildSbv1ImageNodeData());
      if (id) selectSbv1NodeAfterSpawn(setNodes, id);
      return;
    }
  }

  if (itemId === "text" && nodeType === "story-pro2-starter") {
    const pos = spawnPosition("story-pro2-starter", options);
    const id = addNode("story-pro2-starter", pos, buildPro2StarterNodeData());
    if (id) selectPro2NodeAfterSpawn(setNodes, id);
    return;
  }

  if (itemId === "tag" && nodeType === "story-pro2-tag") {
    const pos = spawnPosition("story-pro2-tag", options);
    const id = addNode("story-pro2-tag", pos, buildPro2TagNodeData());
    if (id) selectPro2NodeAfterSpawn(setNodes, id);
    return;
  }

  if (itemId === "image" && nodeType === "story-pro2-image") {
    const pos = spawnPosition("story-pro2-image", options);
    const id = addNode("story-pro2-image", pos, buildPro2ImageNodeData());
    if (id) selectPro2NodeAfterSpawn(setNodes, id);
    return;
  }

  if (itemId === "three-view" && nodeType === "story-pro2-three-view") {
    const pos = spawnPosition("story-pro2-three-view", options);
    const id = addNode(
      "story-pro2-three-view",
      pos,
      buildPro2ThreeViewNodeData(),
    );
    if (id) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
                height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
                style: {
                  width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
                  height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
                },
              }
            : n,
        ),
      );
      selectPro2NodeAfterSpawn(setNodes, id);
    }
    return;
  }

  if (itemId === "script" && nodeType === "story-pro2-script-hub") {
    const pos = spawnPosition("story-pro2-script-hub", options);
    const id = spawnPro2ScriptHubAt(addNode, pos);
    if (id) selectPro2NodeAfterSpawn(setNodes, id);
    return;
  }

  if (itemId === "scene-column") {
    spawnPro2RoleImageNode(store, options, "scene", "场景设计");
    return;
  }

  if (itemId === "prop-column") {
    spawnPro2RoleImageNode(store, options, "prop", "道具设计");
    return;
  }

  if (itemId === "mood-column") {
    spawnPro2RoleImageNode(store, options, "mood", "氛围设计");
    return;
  }

  if (
    itemId === "character-column" ||
    (itemId === "three-view" && nodeType === "story-pro2-three-view")
  ) {
    const pos = spawnPosition("story-pro2-three-view", options);
    const id = addNode(
      "story-pro2-three-view",
      pos,
      buildPro2ThreeViewNodeData({ label: "角色" }),
    );
    if (id) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
                height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
                style: {
                  width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
                  height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
                },
              }
            : n,
        ),
      );
      selectPro2NodeAfterSpawn(setNodes, id);
    }
    return;
  }

  if (itemId === "video-column") {
    spawnVideoEngine(store, options);
    return;
  }

  if (
    itemId === "export" ||
    nodeType === "jianying-export-pro2"
  ) {
    const pos = spawnPosition("jianying-export-pro2", options);
    const id = addNode(
      "jianying-export-pro2",
      pos,
      { ...(NODE_DEFAULT_DATA["jianying-export-pro2"] as Record<string, unknown>) },
    );
    if (id) selectPro2NodeAfterSpawn(setNodes, id);
    return;
  }

  if (
    itemId === "auto-render" ||
    nodeType === "jianying-auto-render-pro2"
  ) {
    const pos = spawnPosition("jianying-auto-render-pro2", options);
    const id = addNode(
      "jianying-auto-render-pro2",
      pos,
      { ...(NODE_DEFAULT_DATA["jianying-auto-render-pro2"] as Record<string, unknown>) },
    );
    if (id) selectSbv1NodeAfterSpawn(setNodes, id);
    return;
  }

  const stageColumnTypes = [
    "story-pro2-audio",
  ] as const;
  if (
    nodeType &&
    (stageColumnTypes as readonly string[]).includes(nodeType)
  ) {
    const t = nodeType as (typeof stageColumnTypes)[number];
    const pos = spawnPosition(t, options);
    const id = addNode(
      t,
      pos,
      { ...(NODE_DEFAULT_DATA[t] as Record<string, unknown>) },
    );
    if (id) selectPro2NodeAfterSpawn(setNodes, id);
    return;
  }

  const label = COMING_SOON[itemId];
  if (label) {
    await dialogs.alert({
      title: "即将推出",
      message: `「${label}」将在后续版本接入。`,
      variant: "info",
    });
    return;
  }

  await dialogs.alert({
    title: "即将推出",
    message: "该节点类型将在后续版本接入。",
    variant: "info",
  });
}

/** 节点侧边 + 菜单：未实现项提示 */
export async function handlePro2SideAddNodePick(
  itemId: string,
  nodeType: string | undefined,
  dialogs: Pro2AddNodePickDialogs,
  onSpawn: (itemId: string, nodeType?: string) => void,
): Promise<void> {
  const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
  if (
    spawnType ||
    itemId === "text" ||
    itemId === "image" ||
    itemId === "three-view" ||
    itemId === "style-asset" ||
    itemId === "script" ||
    itemId === "video" ||
    itemId === "video-compose" ||
    nodeType === "story-pro2-starter" ||
    nodeType === "story-pro2-image" ||
    nodeType === "story-pro2-script-hub" ||
    nodeType === "story-pro2-three-view" ||
    nodeType === "sbv1-video-engine"
  ) {
    onSpawn(itemId, nodeType ?? spawnType);
    return;
  }

  const label = COMING_SOON[itemId];
  await dialogs.alert({
    title: "即将推出",
    message: label
      ? `「${label}」将在后续版本接入。`
      : "该节点类型将在后续版本接入。",
    variant: "info",
  });
}
