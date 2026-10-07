import {
  handlePro2ToolbarAddNodePick,
  type Pro2AddNodePickDialogs,
} from "./pro2-add-node-pick";
import {
  spawnLibtvImageToVideoPreset,
  spawnPro2ShortcutPreset,
} from "./pro2-spawn-shortcut-presets";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";

export type LibtvCanvasEmptyShortcutId =
  | "image-generate"
  | "text-to-video"
  | "image-to-video"
  | "script";

type ShortcutStore = {
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  createGroupContaining: (
    childIds: string[],
    args: {
      label: string;
      color: string;
      measuredSizes?: Record<string, { w: number; h: number }>;
      pro2Styled?: boolean;
      pro2ShortcutPreset?: boolean;
    },
  ) => string | null;
};

export async function runLibtvCanvasEmptyShortcut(
  id: LibtvCanvasEmptyShortcutId,
  edition: "pro2" | "sbv1",
  store: ShortcutStore,
  dialogs: Pro2AddNodePickDialogs,
): Promise<void> {
  const spawnStore = {
    addNode: (type: string, position: { x: number; y: number }, data?: Record<string, unknown>) =>
      store.addNode(type as CanvasNodeType, position, data),
    setEdges: store.setEdges,
    setNodes: store.setNodes,
    createGroupContaining: (
      childIds: string[],
      opts?: {
        label?: string;
        pro2Styled?: boolean;
        pro2ShortcutPreset?: boolean;
      },
    ) =>
      store.createGroupContaining(childIds, {
        label: opts?.label ?? "",
        color: "",
        pro2Styled: opts?.pro2Styled,
        pro2ShortcutPreset: opts?.pro2ShortcutPreset,
      }) ?? "",
  };

  switch (id) {
    case "image-generate":
      await handlePro2ToolbarAddNodePick(
        "image",
        edition === "sbv1" ? "sbv1-image" : "story-pro2-image",
        { addNode: store.addNode, setNodes: store.setNodes },
        dialogs,
        { edition },
      );
      return;
    case "text-to-video":
      spawnPro2ShortcutPreset("text-to-video", spawnStore);
      return;
    case "image-to-video":
      spawnLibtvImageToVideoPreset(spawnStore, edition);
      return;
    case "script":
      await handlePro2ToolbarAddNodePick(
        "script",
        "story-pro2-script-hub",
        { addNode: store.addNode, setNodes: store.setNodes },
        dialogs,
        { edition },
      );
      return;
    default:
      return;
  }
}
