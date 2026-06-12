"use client";

import { flowPositionAtViewportCenter } from "./viewport-placement";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  buildPro2ThreeViewNodeData,
  spawnPro2ScriptHubAt,
} from "./pro2-spawn-nodes";
import { PRO2_CHARACTER_THREE_VIEW_HEIGHT, PRO2_CHARACTER_THREE_VIEW_WIDTH } from "./story-pro2-node-chrome";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";

export type Pro2AddNodePickDialogs = {
  alert: (opts: {
    title: string;
    message: string;
    variant?: "info" | "warning" | "error";
  }) => Promise<void>;
};

export type Pro2AddNodePickStore = {
  addNode: (
    type:
      | "story-pro2-starter"
      | "story-pro2-image"
      | "story-pro2-script-hub"
      | "story-pro2-style-asset"
      | "story-pro2-three-view",
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
};

const COMING_SOON: Record<string, string> = {
  video: "视频节点",
  "video-compose": "视频合成",
  director: "导演台",
  audio: "音频节点",
  "fx-library": "特效库",
  upload: "从本地上传资源",
  history: "从生成历史选择",
  "ref-node": "参考节点",
};

/** 底部工具栏 / 空白画布 · 添加节点菜单统一处理 */
export async function handlePro2ToolbarAddNodePick(
  itemId: string,
  nodeType: string | undefined,
  store: Pro2AddNodePickStore,
  dialogs: Pro2AddNodePickDialogs,
  options?: Pro2ToolbarAddNodePickOptions,
): Promise<void> {
  const { addNode, setNodes } = store;

  if (itemId === "style-library") {
    options?.onOpenStyleLibrary?.();
    return;
  }

  if (itemId === "text" && nodeType === "story-pro2-starter") {
    const pos = flowPositionAtViewportCenter("story-pro2-starter");
    const id = addNode("story-pro2-starter", pos, buildPro2StarterNodeData());
    if (id) selectPro2NodeAfterSpawn(setNodes, id);
    return;
  }

  if (itemId === "image" && nodeType === "story-pro2-image") {
    const pos = flowPositionAtViewportCenter("story-pro2-image");
    const id = addNode("story-pro2-image", pos, buildPro2ImageNodeData());
    if (id) selectPro2NodeAfterSpawn(setNodes, id);
    return;
  }

  if (itemId === "three-view" && nodeType === "story-pro2-three-view") {
    const pos = flowPositionAtViewportCenter("story-pro2-three-view");
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
    const pos = flowPositionAtViewportCenter("story-pro2-script-hub");
    const id = spawnPro2ScriptHubAt(addNode, pos);
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
  if (
    itemId === "text" ||
    itemId === "image" ||
    itemId === "script" ||
    nodeType === "story-pro2-starter" ||
    nodeType === "story-pro2-image" ||
    nodeType === "story-pro2-script-hub"
  ) {
    onSpawn(itemId, nodeType);
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
