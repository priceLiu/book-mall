import type { CanvasFlowNode, CanvasNodeType, CanvasFlowEdge } from "./types";
import { isGroupNode, NODE_DEFAULT_SIZE } from "./types";
import { STORY_CONTROL_NODE_HEIGHT, STORY_CONTROL_NODE_WIDTH } from "./story-node-chrome";
import { migrateStoryOutlineLlmParamsAll } from "./story-llm-params-migrate";

const GROUP_PADDING = 28;
const GROUP_HEADER = 40;

/** 漫剧模板分组默认画布位置（孤儿节点还原用） */
const STORY_GROUP_FALLBACK: Record<string, { x: number; y: number }> = {
  "sc-group-characters": { x: 40, y: 720 },
  "sc-group-media": { x: 40, y: 1180 },
};

export function nodeMeasuredSize(n: CanvasFlowNode): { w: number; h: number } {
  const style = n.style as { width?: number; height?: number } | undefined;
  const t = (n.type ?? "text") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t] ?? { width: 320, height: 240 };
  const w = style?.width ?? n.width ?? def.width;
  const h = style?.height ?? n.height ?? def.height;
  return { w: Number(w) || def.width, h: Number(h) || def.height };
}

/** 节点在画布上的绝对坐标（含 parent 链）。 */
export function absoluteNodePosition(
  n: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): { x: number; y: number } {
  const byId = new Map(nodes.map((x) => [x.id, x]));
  let x = n.position.x;
  let y = n.position.y;
  let cur = n.parentId;
  while (cur) {
    const p = byId.get(cur);
    if (!p) break;
    x += p.position.x;
    y += p.position.y;
    cur = p.parentId;
  }
  return { x, y };
}

function attachNodeToGroup(
  n: CanvasFlowNode,
  group: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): CanvasFlowNode {
  const abs = absoluteNodePosition(n, nodes);
  return {
    ...n,
    parentId: group.id,
    extent: "parent",
    position: { x: abs.x - group.position.x, y: abs.y - group.position.y },
  } as CanvasFlowNode;
}

const MEDIA_NODE_TYPES = new Set<CanvasNodeType>([
  "image-engine",
  "video-engine",
  "tts-engine",
  "video-preview",
  "audio-preview",
]);

function belongsInCharacterGroup(n: CanvasFlowNode): boolean {
  if (shouldNeverBeInStoryGroup(n)) return false;
  if (n.id.startsWith("sc-char")) return true;
  if (n.type === "three-view-engine") return true;
  if (n.type === "image-preview") {
    const fi = (n.data as { frameIndex?: number }).frameIndex;
    return typeof fi !== "number";
  }
  if (n.type === "text") {
    const text = String((n.data as { text?: string }).text ?? "");
    return /^\[[^\]]+\]/.test(text);
  }
  return Boolean((n.data as { characterName?: string }).characterName);
}

function belongsInFramesGroup(n: CanvasFlowNode): boolean {
  if (shouldNeverBeInStoryGroup(n)) return false;
  if (n.id.startsWith("sc-f")) return true;
  const fi = (n.data as { frameIndex?: number }).frameIndex;
  if (typeof fi !== "number") return false;
  return (
    n.type === "image-engine" ||
    (n.type === "image-preview" && typeof fi === "number")
  );
}

function belongsInVideosGroup(n: CanvasFlowNode): boolean {
  if (shouldNeverBeInStoryGroup(n)) return false;
  const fi = (n.data as { frameIndex?: number }).frameIndex;
  if (typeof fi !== "number") return false;
  return (
    n.type === "video-engine" ||
    n.type === "tts-engine" ||
    n.type === "video-preview" ||
    n.type === "audio-preview"
  );
}

function belongsInMediaGroup(n: CanvasFlowNode): boolean {
  if (shouldNeverBeInStoryGroup(n)) return false;
  if (n.id.startsWith("sc-f")) return true;
  const fi = (n.data as { frameIndex?: number }).frameIndex;
  if (typeof fi !== "number") return false;
  return (
    MEDIA_NODE_TYPES.has((n.type ?? "text") as CanvasNodeType) ||
    (n.type === "image-preview" && typeof fi === "number")
  );
}

/** 沿连线 + 类型规则收拢应进分组的节点（兼容 batch 随机 id）。 */
export function reattachStoryGroupsByEdges(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  const charGroup = nodes.find((n) => n.id === "sc-group-characters");
  const mediaGroup = nodes.find((n) => n.id === "sc-group-media");
  if (!charGroup && !mediaGroup) return nodes;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const attachIds = new Set<string>();

  const walk = (startIds: string[], accept: (n: CanvasFlowNode) => boolean) => {
    const seen = new Set<string>(startIds);
    const q = [...startIds];
    while (q.length) {
      const id = q.shift()!;
      for (const e of edges) {
        if (e.source !== id || seen.has(e.target)) continue;
        seen.add(e.target);
        const t = byId.get(e.target);
        if (
          !t ||
          t.parentId ||
          isGroupNode(t.type) ||
          shouldNeverBeInStoryGroup(t)
        ) {
          continue;
        }
        if (accept(t)) {
          attachIds.add(t.id);
          q.push(t.id);
        }
      }
    }
  };

  const charRoot = nodes.find((n) => n.id === "sc-character");
  if (charRoot) walk([charRoot.id], belongsInCharacterGroup);

  const sbRoot = nodes.find((n) => n.id === "sc-storyboard");
  if (sbRoot) walk([sbRoot.id], belongsInMediaGroup);

  for (const n of nodes) {
    if (n.parentId || isGroupNode(n.type) || shouldNeverBeInStoryGroup(n)) {
      continue;
    }
    if (charGroup && belongsInCharacterGroup(n)) attachIds.add(n.id);
    if (mediaGroup && belongsInMediaGroup(n)) attachIds.add(n.id);
  }

  return nodes.map((n) => {
    if (!attachIds.has(n.id)) return n;
    const group =
      charGroup && belongsInCharacterGroup(n)
        ? charGroup
        : mediaGroup && belongsInMediaGroup(n)
          ? mediaGroup
          : null;
    if (!group) return n;
    return attachNodeToGroup(n, group, nodes);
  });
}

function applyStoryLayout(
  nodes: CanvasFlowNode[],
  edges?: CanvasFlowEdge[],
): CanvasFlowNode[] {
  let next = repairOrphanParentIds(nodes);
  next = detachMisplacedStoryRootNodes(next);
  next = resetOverlappedStoryRootPositions(next);
  if (edges?.length) next = reattachStoryGroupsByEdges(next, edges);
  next = reattachStoryTemplateOrphans(next);
  next = fixChildRelativePositions(next);
  if (hasStoryTemplateGroups(next)) {
    next = layoutStoryTemplateGroups(next);
    next = fitGroupBoundsToChildren(next);
  }
  return sortNodesForReactFlow(next);
}

/** React Flow 要求 group 父节点排在子节点之前。 */
export function sortNodesForReactFlow(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const groupIds = new Set(
    nodes.filter((n) => isGroupNode(n.type)).map((n) => n.id),
  );
  const groups = nodes.filter((n) => isGroupNode(n.type));
  const roots = nodes.filter(
    (n) => !isGroupNode(n.type) && (!n.parentId || !groupIds.has(n.parentId)),
  );
  const children = nodes.filter(
    (n) =>
      !isGroupNode(n.type) && n.parentId && groupIds.has(n.parentId),
  );
  return [...groups, ...roots, ...children];
}

/** 不应出现在分组内的漫剧顶层节点 */
const STORY_ROOT_NODE_IDS = new Set([
  "sc-idea",
  "sc-outline",
  "sc-outline-md",
  "sc-character",
  "sc-character-md",
  "sc-storyboard",
  "sc-storyboard-md",
  "sc-export",
]);

const STORY_ROOT_NODE_TYPES = new Set([
  "story-outline-engine",
  "character-engine",
  "storyboard-engine",
  "md-preview",
  "jianying-export",
]);

/** 漫剧模板顶层节点标准位置（col 布局） */
const STORY_COMIC_ROOT_POSITIONS: Record<string, { x: number; y: number }> = {
  "sc-idea": { x: 80, y: 120 },
  "sc-outline": { x: 440, y: 120 },
  "sc-outline-md": { x: 800, y: 120 },
  "sc-character": { x: 440, y: 520 },
  "sc-character-md": { x: 800, y: 520 },
  "sc-storyboard": { x: 440, y: 920 },
  "sc-storyboard-md": { x: 800, y: 920 },
  "sc-export": { x: 1160, y: 920 },
  "sc-group-characters": { x: 40, y: 720 },
  "sc-group-media": { x: 40, y: 1180 },
};

function shouldNeverBeInStoryGroup(n: CanvasFlowNode): boolean {
  if (STORY_ROOT_NODE_IDS.has(n.id)) return true;
  if (STORY_ROOT_NODE_TYPES.has(n.type ?? "")) return true;
  return false;
}

/** 引擎 / MD 预览误挂进分组时移回画布根坐标。 */
export function detachMisplacedStoryRootNodes(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  if (!hasStoryTemplateGroups(nodes)) return nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.map((n) => {
    if (!n.parentId || !shouldNeverBeInStoryGroup(n)) return n;
    const parent = byId.get(n.parentId);
    if (!parent || !isGroupNode(parent.type)) return n;
    const abs = {
      x: n.position.x + parent.position.x,
      y: n.position.y + parent.position.y,
    };
    const templatePos = STORY_COMIC_ROOT_POSITIONS[n.id];
    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      position: templatePos ?? abs,
    } as CanvasFlowNode;
  });
}

/** 顶层 pipeline 节点堆叠在一起时，恢复模板坐标。 */
export function resetOverlappedStoryRootPositions(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  if (!hasStoryTemplateGroups(nodes)) return nodes;

  const roots = ["sc-outline", "sc-character", "sc-storyboard"]
    .map((id) => nodes.find((n) => n.id === id && !n.parentId))
    .filter((n): n is CanvasFlowNode => !!n);

  if (roots.length < 2) return nodes;

  const first = roots[0]!.position;
  const stacked = roots.every(
    (n) =>
      Math.abs(n.position.x - first.x) < 100 &&
      Math.abs(n.position.y - first.y) < 100,
  );
  if (!stacked) return nodes;

  return nodes.map((n) => {
    if (n.parentId) return n;
    const pos = STORY_COMIC_ROOT_POSITIONS[n.id];
    if (!pos) return n;
    return { ...n, position: pos } as CanvasFlowNode;
  });
}

/** 误把画布绝对坐标存成 parent 相对坐标时纠正。 */
export function fixChildRelativePositions(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.map((n) => {
    if (!n.parentId) return n;
    const parent = byId.get(n.parentId);
    if (!parent || !isGroupNode(parent.type)) return n;

    const px = n.position.x;
    const py = n.position.y;
    const gx = parent.position.x;
    const gy = parent.position.y;

    // 仅当 position 看起来像画布绝对坐标（而非组内相对坐标）时才换算
    const looksAbsolute =
      px >= gx + 80 ||
      (py >= gy + 80 && px >= gx);

    if (!looksAbsolute) return n;

    return {
      ...n,
      position: {
        x: px - parent.position.x,
        y: py - parent.position.y,
      },
    } as CanvasFlowNode;
  });
}

/** 漫剧模板：把应进分组但 parentId 丢失的节点挂回 group。 */
export function reattachStoryTemplateOrphans(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const charGroup = nodes.find((n) => n.id === "sc-group-characters");
  const framesGroup = nodes.find((n) => n.id === "sc-group-frames");
  const videosGroup = nodes.find((n) => n.id === "sc-group-videos");
  const mediaGroup = nodes.find((n) => n.id === "sc-group-media");
  if (!charGroup && !mediaGroup && !framesGroup && !videosGroup) return nodes;

  return nodes.map((n) => {
    if (n.parentId || isGroupNode(n.type) || shouldNeverBeInStoryGroup(n)) {
      return n;
    }

    if (charGroup && belongsInCharacterGroup(n)) {
      return attachNodeToGroup(n, charGroup, nodes);
    }

    if (framesGroup && belongsInFramesGroup(n)) {
      return attachNodeToGroup(n, framesGroup, nodes);
    }

    if (videosGroup && belongsInVideosGroup(n)) {
      return attachNodeToGroup(n, videosGroup, nodes);
    }

    if (mediaGroup && belongsInMediaGroup(n)) {
      return attachNodeToGroup(n, mediaGroup, nodes);
    }

    return n;
  });
}

function layoutPositions(
  nodes: CanvasFlowNode[],
  groupId: string,
  positions: Map<string, { x: number; y: number }>,
): CanvasFlowNode[] {
  return nodes.map((n) => {
    const p = positions.get(n.id);
    if (!n.parentId || n.parentId !== groupId || !p) return n;
    return { ...n, position: p, extent: "parent" as const } as CanvasFlowNode;
  });
}

/** 角色三视图分组：text → three-view → image-preview 按行排列。 */
function layoutCharacterGroup(
  nodes: CanvasFlowNode[],
  groupId: string,
): CanvasFlowNode[] {
  const children = nodes.filter((n) => n.parentId === groupId);
  if (children.length === 0) return nodes;

  const texts = children.filter((n) => n.type === "text");
  const engines = children.filter((n) => n.type === "three-view-engine");
  const previews = children.filter((n) => n.type === "image-preview");
  const used = new Set<string>();

  const positions = new Map<string, { x: number; y: number }>();
  let rowY = 56;

  const takePreview = (characterName?: string, prompt?: string) => {
    const hit = previews.find((p) => {
      if (used.has(p.id)) return false;
      const d = p.data as { characterName?: string };
      if (characterName && d.characterName === characterName) return true;
      return false;
    });
    if (hit) return hit;
    return previews.find((p) => !used.has(p.id));
  };

  const takeEngine = (characterName?: string, prompt?: string) => {
    const hit = engines.find((e) => {
      if (used.has(e.id)) return false;
      const d = e.data as { characterName?: string; prompt?: string };
      if (characterName && d.characterName === characterName) return true;
      if (prompt && (d.prompt ?? "").includes(characterName ?? "")) return true;
      return false;
    });
    if (hit) return hit;
    return engines.find((e) => !used.has(e.id));
  };

  for (const text of texts) {
    const label = String((text.data as { text?: string }).text ?? "");
    const nameMatch = label.match(/^\[([^\]]+)\]/);
    const characterName = nameMatch?.[1];
    positions.set(text.id, { x: 24, y: rowY });
    used.add(text.id);

    const tv = takeEngine(characterName, label);
    if (tv) {
      positions.set(tv.id, { x: 260, y: rowY - 8 });
      used.add(tv.id);
      const prev = takePreview(
        (tv.data as { characterName?: string }).characterName ?? characterName,
      );
      if (prev) {
        positions.set(prev.id, { x: 680, y: rowY - 8 });
        used.add(prev.id);
      }
    }
    rowY += 300;
  }

  for (const e of engines.filter((n) => !used.has(n.id))) {
    positions.set(e.id, { x: 260, y: rowY - 8 });
    used.add(e.id);
    const prev = takePreview((e.data as { characterName?: string }).characterName);
    if (prev && !used.has(prev.id)) {
      positions.set(prev.id, { x: 680, y: rowY - 8 });
      used.add(prev.id);
    }
    rowY += 300;
  }

  for (const p of previews.filter((n) => !used.has(n.id))) {
    positions.set(p.id, { x: 680, y: rowY - 8 });
    rowY += 300;
  }

  return layoutPositions(nodes, groupId, positions);
}

/** 分镜媒体分组：每镜一行（图 / 视频 / 预览 + 配音行）。 */
function layoutMediaGroup(
  nodes: CanvasFlowNode[],
  groupId: string,
): CanvasFlowNode[] {
  const children = nodes.filter((n) => n.parentId === groupId);
  if (children.length === 0) return nodes;

  const frameIndexes = new Set<number>();
  for (const c of children) {
    const fi = (c.data as { frameIndex?: number }).frameIndex;
    frameIndexes.add(typeof fi === "number" ? fi : 0);
  }
  const frames = Array.from(frameIndexes).sort((a, b) => a - b);

  const positions = new Map<string, { x: number; y: number }>();
  let rowY = 56;

  for (const fi of frames) {
    const bucket = children.filter(
      (n) => ((n.data as { frameIndex?: number }).frameIndex ?? 0) === fi,
    );
    const img = bucket.find((n) => n.type === "image-engine");
    const vid = bucket.find((n) => n.type === "video-engine");
    const vidPrev = bucket.find((n) => n.type === "video-preview");
    const tts = bucket.find((n) => n.type === "tts-engine");
    const aud = bucket.find((n) => n.type === "audio-preview");

    if (img) positions.set(img.id, { x: 24, y: rowY });
    if (vid) positions.set(vid.id, { x: 400, y: rowY });
    if (vidPrev) positions.set(vidPrev.id, { x: 780, y: rowY });
    if (tts) positions.set(tts.id, { x: 24, y: rowY + 164 });
    if (aud) positions.set(aud.id, { x: 420, y: rowY + 164 });

    rowY += 280;
  }

  return layoutPositions(nodes, groupId, positions);
}

/** 分镜图列：每镜一行 image-engine */
function layoutFramesGroup(
  nodes: CanvasFlowNode[],
  groupId: string,
): CanvasFlowNode[] {
  const children = nodes.filter((n) => n.parentId === groupId);
  if (children.length === 0) return nodes;

  const frameIndexes = new Set<number>();
  for (const c of children) {
    const fi = (c.data as { frameIndex?: number }).frameIndex;
    frameIndexes.add(typeof fi === "number" ? fi : 0);
  }
  const frames = Array.from(frameIndexes).sort((a, b) => a - b);
  const positions = new Map<string, { x: number; y: number }>();
  let rowY = 56;

  for (const fi of frames) {
    const img = children.find(
      (n) =>
        n.type === "image-engine" &&
        ((n.data as { frameIndex?: number }).frameIndex ?? 0) === fi,
    );
    if (img) positions.set(img.id, { x: 24, y: rowY });
    rowY += 300;
  }

  return layoutPositions(nodes, groupId, positions);
}

/** 视频列：每镜 video + tts */
function layoutVideosGroup(
  nodes: CanvasFlowNode[],
  groupId: string,
): CanvasFlowNode[] {
  const children = nodes.filter((n) => n.parentId === groupId);
  if (children.length === 0) return nodes;

  const frameIndexes = new Set<number>();
  for (const c of children) {
    const fi = (c.data as { frameIndex?: number }).frameIndex;
    frameIndexes.add(typeof fi === "number" ? fi : 0);
  }
  const frames = Array.from(frameIndexes).sort((a, b) => a - b);
  const positions = new Map<string, { x: number; y: number }>();
  let rowY = 56;

  for (const fi of frames) {
    const bucket = children.filter(
      (n) => ((n.data as { frameIndex?: number }).frameIndex ?? 0) === fi,
    );
    const vid = bucket.find((n) => n.type === "video-engine");
    const tts = bucket.find((n) => n.type === "tts-engine");
    if (vid) positions.set(vid.id, { x: 24, y: rowY });
    if (tts) positions.set(tts.id, { x: 24, y: rowY + 200 });
    rowY += 320;
  }

  return layoutPositions(nodes, groupId, positions);
}

export function layoutStoryTemplateGroups(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const hasChar = nodes.some((n) => n.id === "sc-group-characters");
  const hasFrames = nodes.some((n) => n.id === "sc-group-frames");
  const hasVideos = nodes.some((n) => n.id === "sc-group-videos");
  const hasMedia = nodes.some((n) => n.id === "sc-group-media");
  let next = nodes;
  if (hasChar) next = layoutCharacterGroup(next, "sc-group-characters");
  if (hasFrames) next = layoutFramesGroup(next, "sc-group-frames");
  if (hasVideos) next = layoutVideosGroup(next, "sc-group-videos");
  if (hasMedia && !hasFrames && !hasVideos) {
    next = layoutMediaGroup(next, "sc-group-media");
  }
  return next;
}

/** 按子节点包围盒扩大 group 的 style 宽高。 */
export function fitGroupBoundsToChildren(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (!isGroupNode(n.type)) return n;

    const children = nodes.filter((c) => c.parentId === n.id);
    if (children.length === 0) return n;

    let maxX = 0;
    let maxY = 0;
    for (const c of children) {
      const { w, h } = nodeMeasuredSize(c);
      maxX = Math.max(maxX, c.position.x + w);
      maxY = Math.max(maxY, c.position.y + h);
    }

    const width = Math.max(320, Math.ceil(maxX + GROUP_PADDING));
    const height = Math.max(
      200,
      Math.ceil(maxY + GROUP_PADDING + GROUP_HEADER),
    );

    return {
      ...n,
      style: { ...((n.style as object) ?? {}), width, height },
      width,
      height,
    } as CanvasFlowNode;
  });
}

/** 父节点缺失或不是 group 时，清除 parentId 并尽量还原画布坐标。 */
export function repairOrphanParentIds(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.map((n) => {
    if (!n.parentId) return n;
    const parent = byId.get(n.parentId);
    if (parent && isGroupNode(parent.type)) return n;
    if (parent) {
      return {
        ...n,
        parentId: undefined,
        extent: undefined,
        position: {
          x: n.position.x + parent.position.x,
          y: n.position.y + parent.position.y,
        },
      } as CanvasFlowNode;
    }

    const fallback = STORY_GROUP_FALLBACK[n.parentId];
    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      position: fallback
        ? {
            x: n.position.x + fallback.x,
            y: n.position.y + fallback.y,
          }
        : n.position,
    } as CanvasFlowNode;
  });
}

/** group 被删除后，将其子节点还原为画布绝对坐标。 */
export function detachChildrenOfRemovedGroups(
  prev: CanvasFlowNode[],
  next: CanvasFlowNode[],
): CanvasFlowNode[] {
  const nextIds = new Set(next.map((n) => n.id));
  const removedGroups = prev.filter(
    (n) => isGroupNode(n.type) && !nextIds.has(n.id),
  );
  if (removedGroups.length === 0) return next;

  const removedGroupIds = new Set(removedGroups.map((n) => n.id));
  const groupPos = new Map(removedGroups.map((n) => [n.id, n.position]));

  return next.map((n) => {
    if (!n.parentId || !removedGroupIds.has(n.parentId)) return n;
    const gp = groupPos.get(n.parentId);
    if (!gp) return n;
    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      position: { x: n.position.x + gp.x, y: n.position.y + gp.y },
    } as CanvasFlowNode;
  });
}

export function hasStoryTemplateGroups(nodes: CanvasFlowNode[]): boolean {
  return nodes.some(
    (n) => n.id === "sc-group-characters" || n.id === "sc-group-media",
  );
}

/** 三视图节点：纠正与默认尺寸偏差过大的持久化宽高 */
function normalizeThreeViewNodeSizes(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const def = NODE_DEFAULT_SIZE["three-view-engine"];
  return nodes.map((n) => {
    if (n.type !== "three-view-engine") return n;
    const { w, h } = nodeMeasuredSize(n);
    const nextW =
      w > def.width + 60 || w < def.width - 40 ? def.width : w;
    const nextH =
      h > def.height + 16 || h < def.height - 40 ? def.height : h;
    if (nextW === w && nextH === h) return n;
    return {
      ...n,
      width: nextW,
      height: nextH,
      style: {
        ...(typeof n.style === "object" && n.style ? n.style : {}),
        width: nextW,
        height: nextH,
      },
    } as CanvasFlowNode;
  });
}

/** 角色列 / 分镜列：固定宽高（内容超出时 bodyScroll 内滚） */
function normalizeStoryMediaColumnSizes(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (
      n.type !== "story-character-column" &&
      n.type !== "story-frame-column" &&
      n.type !== "story-video-column"
    ) {
      return n;
    }
    const def = NODE_DEFAULT_SIZE[n.type];
    const { w, h } = nodeMeasuredSize(n);
    const tooSmall = w < def.width * 0.9 || h < def.height * 0.9;
    const nextW = tooSmall || w !== def.width ? def.width : w;
    const nextH = tooSmall || h !== def.height ? def.height : h;
    if (nextW === w && nextH === h) return n;
    return {
      ...n,
      width: nextW,
      height: nextH,
      style: {
        ...(typeof n.style === "object" && n.style ? n.style : {}),
        width: nextW,
        height: nextH,
      },
    } as CanvasFlowNode;
  });
}

/** 故事主题 / 故事大纲：纠正异常偏小的持久化尺寸；保留用户加长后的高度 */
function normalizeStoryControlNodeSizes(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const fixedW = STORY_CONTROL_NODE_WIDTH;
  const fixedH = STORY_CONTROL_NODE_HEIGHT;

  return nodes.map((n) => {
    if (n.type !== "story-comic-starter" && n.type !== "story-script-hub") {
      return n;
    }
    const { w, h } = nodeMeasuredSize(n);
    const tooSmall = w < fixedW * 0.75 || h < fixedH * 0.85;
    const tooTall = h > fixedH * 1.08 || w > fixedW * 1.08;
    const nextW = tooSmall || tooTall || w !== fixedW ? fixedW : w;
    const nextH = tooSmall || tooTall || h !== fixedH ? fixedH : h;
    if (nextW === w && nextH === h) return n;
    return {
      ...n,
      width: nextW,
      height: nextH,
      style: {
        ...(typeof n.style === "object" && n.style ? n.style : {}),
        width: nextW,
        height: nextH,
      },
    } as CanvasFlowNode;
  });
}

const REF_VIDEO_WORKFLOW_NODE_TYPES = new Set<string>([
  "ref-grid-4",
  "ref-grid-6",
  "ref-grid-9",
  "ai-video-engine",
  "video-generate",
]);

/** 参考生视频工作流节点：过小节点还原为默认尺寸 */
function normalizeRefVideoWorkflowNodeSizes(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    const t = n.type ?? "";
    if (!REF_VIDEO_WORKFLOW_NODE_TYPES.has(t)) return n;
    const def = NODE_DEFAULT_SIZE[t as CanvasNodeType];
    const { w, h } = nodeMeasuredSize(n);
    const tooSmall = w < def.width * 0.9 || h < def.height * 0.9;
    if (!tooSmall) return n;
    return {
      ...n,
      width: def.width,
      height: def.height,
      style: {
        ...(typeof n.style === "object" && n.style ? n.style : {}),
        width: def.width,
        height: def.height,
      },
    } as CanvasFlowNode;
  });
}

export function normalizeCanvasNodes(
  nodes: CanvasFlowNode[],
  edges?: CanvasFlowEdge[],
): CanvasFlowNode[] {
  const withLlmParams = migrateStoryOutlineLlmParamsAll(nodes);
  const sized = normalizeStoryControlNodeSizes(
    normalizeStoryMediaColumnSizes(
      normalizeRefVideoWorkflowNodeSizes(normalizeThreeViewNodeSizes(withLlmParams)),
    ),
  );
  if (!hasStoryTemplateGroups(sized)) {
    return sortNodesForReactFlow(repairOrphanParentIds(sized));
  }
  return applyStoryLayout(sized, edges);
}

export function reflowStoryTemplateGroups(
  nodes: CanvasFlowNode[],
  edges?: CanvasFlowEdge[],
): CanvasFlowNode[] {
  if (!hasStoryTemplateGroups(nodes)) return nodes;
  return applyStoryLayout(nodes, edges);
}
