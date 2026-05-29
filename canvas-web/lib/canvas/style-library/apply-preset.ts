import type { CanvasFlowNode } from "../types";
import type {
  StoryProScriptHubNodeData,
  StoryProStyleNodeData,
} from "../story-pro-workspace-types";
import type { StyleLibraryPreset } from "./catalog";
import { styleLibraryPickerDefaults } from "./category-pickers";

const MAX_STYLE_REF_IMAGES = 6;

export function styleNodeFieldsLocked(d: StoryProStyleNodeData): {
  locked: boolean;
  reason?: string;
} {
  if (d.styleFinalized) {
    return { locked: true, reason: "风格已定稿，无法套用风格库条目。" };
  }
  return { locked: false };
}

export function styleNodeHasAnchorContent(d: StoryProStyleNodeData): boolean {
  return (
    Boolean(d.styleAnchorZh?.trim()) ||
    Boolean(d.styleAnchorEn?.trim()) ||
    Boolean(d.negativePrompt?.trim())
  );
}

function hubForStyleNode(
  nodes: CanvasFlowNode[],
  style: CanvasFlowNode,
): CanvasFlowNode | undefined {
  const hubId = (style.data as StoryProStyleNodeData).hubNodeId;
  if (hubId) {
    return nodes.find(
      (n) => n.id === hubId && n.type === "story-pro-script-hub",
    );
  }
  return undefined;
}

function styleNodeSortKey(n: CanvasFlowNode): number {
  return n.position?.y ?? 0;
}

export type StyleLibraryApplyResolve =
  | { ok: true; styleNode: CanvasFlowNode; hub: CanvasFlowNode }
  | { ok: false; title: string; message: string };

/**
 * 多工作流画布：解析可套用风格库的目标「风格定义」节点。
 * 禁止误用第一套已定稿风格；优先选中节点，否则取可编辑且故事已定稿的一套（偏下方新建工作流）。
 */
export function resolveStyleLibraryApplyTarget(
  nodes: CanvasFlowNode[],
  options?: { selectedStyleNodeId?: string | null },
): StyleLibraryApplyResolve {
  const styleNodes = nodes.filter((n) => n.type === "story-pro-style");
  if (!styleNodes.length) {
    return {
      ok: false,
      title: "未找到风格节点",
      message:
        "当前画布没有「风格定义」节点。请先使用影视专业版工作流模板，并在故事定稿后生成风格层。",
    };
  }

  const editable = styleNodes.filter(
    (n) => !styleNodeFieldsLocked(n.data as StoryProStyleNodeData).locked,
  );

  if (!editable.length) {
    return {
      ok: false,
      title: "无法套用",
      message:
        "画布上各工作流的风格均已定稿。请在未定的稿的风格节点上操作，或新建工作流后再套用风格库。",
    };
  }

  const ready = editable.filter((n) => {
    const hub = hubForStyleNode(nodes, n);
    return Boolean(
      (hub?.data as StoryProScriptHubNodeData | undefined)?.scriptFinalized,
    );
  });

  const selectedId = options?.selectedStyleNodeId?.trim();
  if (selectedId) {
    const sel = styleNodes.find((n) => n.id === selectedId);
    if (sel) {
      const lock = styleNodeFieldsLocked(sel.data as StoryProStyleNodeData);
      if (lock.locked) {
        return {
          ok: false,
          title: "无法套用",
          message: lock.reason ?? "该套工作流的风格已定稿。",
        };
      }
      const hub = hubForStyleNode(nodes, sel);
      if (!hub) {
        return {
          ok: false,
          title: "无法套用",
          message: "未找到该风格节点所属的故事剧本，请检查连线。",
        };
      }
      if (!(hub.data as StoryProScriptHubNodeData).scriptFinalized) {
        return {
          ok: false,
          title: "请先故事定稿",
          message:
            "请先在当前工作流的「故事剧本」节点完成大纲并点击「故事定稿」，再套用风格库。",
        };
      }
      return { ok: true, styleNode: sel, hub };
    }
  }

  if (ready.length === 1) {
    const styleNode = ready[0]!;
    const hub = hubForStyleNode(nodes, styleNode)!;
    return { ok: true, styleNode, hub };
  }

  if (ready.length > 1) {
    const styleNode = [...ready].sort(
      (a, b) => styleNodeSortKey(b) - styleNodeSortKey(a),
    )[0]!;
    const hub = hubForStyleNode(nodes, styleNode)!;
    return { ok: true, styleNode, hub };
  }

  return {
    ok: false,
    title: "请先故事定稿",
    message:
      "存在未锁定的风格节点，但其所属故事剧本尚未定稿。请先在对应「故事剧本」节点点击「故事定稿」后再套用风格库。",
  };
}

/** 将风格库预设写入风格定义节点 data patch（用户可见以锚定词为主；分类映射仅作资产元数据） */
export function buildStyleLibraryPresetPatch(
  preset: StyleLibraryPreset,
  current: StoryProStyleNodeData,
  options?: { includeRefImage?: boolean },
): Partial<StoryProStyleNodeData> {
  const pickers = styleLibraryPickerDefaults(preset.category);
  const patch: Partial<StoryProStyleNodeData> = {
    styleAnchorZh: preset.prompt,
    mainStyle: pickers.mainStyle,
    colorTone: pickers.colorTone,
    renderQuality: pickers.renderQuality,
  };

  if (options?.includeRefImage && preset.imageUrl.trim()) {
    const existing = current.refImages ?? [];
    const withoutDup = existing.filter((r) => r.id !== `style-lib-${preset.id}`);
    const nextRef = {
      id: `style-lib-${preset.id}`,
      label: preset.name,
      url: preset.imageUrl,
    };
    const merged = [nextRef, ...withoutDup].slice(0, MAX_STYLE_REF_IMAGES);
    patch.refImages = merged;
  }

  return patch;
}
