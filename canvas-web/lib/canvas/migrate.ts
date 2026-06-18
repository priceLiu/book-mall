/**
 * canvas v1 → v2 in-memory graph 迁移
 *
 * 策略：
 * - `ai-text` → `ai-engine`（保留 prompt 写到三段式的「系统任务」段；providerId/modelKey 留空待用户选）
 * - `image-gen` → `image-engine`（保留原 prompt + 把 aspectRatio/resolution/outputFormat 写到 params；providerId/modelKey 留空待用户选）
 * - `product-params` → `text`（5 字段拼成 markdown 多行，写入 data.text，mode = manual）
 *
 * 不主动改写 DB；调用方在 server 端 getCanvasProject 返回前 / 客户端 hydrate 时调一次即可。
 * schemaVersion 升至 2 后，下一次保存自然落入 DB。
 */

import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasGraph,
  CanvasNodeType,
} from "./types";
import {
  AI_ENGINE_PROMPT_TEMPLATE,
  CANVAS_SCHEMA_VERSION,
  NODE_DEFAULT_SIZE,
} from "./types";
import { migratePro2SceneColumnOffCanvas } from "./pro2-spawn-scene-image-group";
import { migratePro2TextPurposeAll } from "./pro2-text-purpose";
import { normalizeCanvasNodes } from "./normalize-graph-nodes";
import { migrateStoryComicStarterNode } from "./story-starter-migrate";
import { migrateStoryOutlineLlmParams } from "./story-llm-params-migrate";
import { migrateStoryPromptPackAll } from "./story-prompt-pack-migrate";
import { STORY_CONTROL_NODE_HEIGHT, STORY_CONTROL_NODE_WIDTH } from "./story-node-chrome";

// 这个文件需要识别 v1 的节点字符串字面量，但 v6 阶段后 CanvasNodeType 已经
// 不再包含它们。所以这里把 type 弱化成 string，避免 TS 报"无 overlap"。
type LooseNode = Omit<CanvasFlowNode, "type"> & { type?: string };

function migrateNode(n: LooseNode): LooseNode {
  const t = n.type ?? "";
  const data = (n.data ?? {}) as Record<string, unknown>;

  if (t === "ai-text") {
    const oldPrompt = typeof data.prompt === "string" ? data.prompt : "";
    const promptStitched = oldPrompt
      ? AI_ENGINE_PROMPT_TEMPLATE.replace(
          "你是顶尖的视觉艺术指导，请根据上述输入，输出一段约 200 字的设计方案，包含主视觉、配色、版式、字体、关键元素与情绪关键词。",
          oldPrompt,
        )
      : AI_ENGINE_PROMPT_TEMPLATE;
    return {
      ...n,
      type: "ai-engine",
      data: {
        providerId: "",
        modelKey: "",
        prompt: promptStitched,
        referencedNodeIds: [],
        params: { reasoning_effort: "low", max_tokens: 4000, temperature: 0.7 },
        runtime: data.runtime,
      },
    };
  }
  if (t === "image-gen") {
    const oldPrompt = typeof data.prompt === "string" ? data.prompt : "";
    const aspect = data.aspectRatio ?? "1:1";
    const resolution = data.resolution ?? "2K";
    const output_format = data.outputFormat ?? "png";
    return {
      ...n,
      type: "image-engine",
      data: {
        providerId: "",
        modelKey: typeof data.modelKey === "string" ? data.modelKey : "",
        prompt: oldPrompt,
        referencedNodeIds: [],
        params: {
          aspect_ratio: aspect,
          resolution,
          output_format,
        },
        runtime: data.runtime,
      },
    };
  }
  if (t === "product-params") {
    const lines = [
      data.brand && `品牌：${data.brand}`,
      data.productName && `名称：${data.productName}`,
      data.specs && `规格：${data.specs}`,
      data.price && `价格：${data.price}`,
      data.extras && `备注：${data.extras}`,
    ].filter(Boolean);
    return {
      ...n,
      type: "text",
      data: {
        text: lines.join("\n"),
        mode: "manual",
        runtime: data.runtime,
      },
    };
  }
  return n;
}

/**
 * 给所有节点回填 `style.width / style.height`。
 *
 * 老画布 / v1→v2 迁移产物里的节点没有显式宽高，NodeResizer 抓不到初值；
 * 这里按节点类型回填默认尺寸。已有 width/height 的节点保持不变（用户已经
 * 手动调整过的尺寸不能被覆盖）。
 */
function backfillNodeSize(n: LooseNode): LooseNode {
  const t = (n.type ?? "") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t];
  if (!def) return n;
  const cur = (n.style ?? {}) as { width?: number | string; height?: number | string };
  const next: { width?: number | string; height?: number | string } = { ...cur };
  let changed = false;
  if (cur.width === undefined || cur.width === null) {
    next.width = def.width;
    changed = true;
  }
  if (cur.height === undefined || cur.height === null) {
    next.height = def.height;
    changed = true;
  }
  if (t === "jianying-export" || t === "jianying-export-pro") {
    const manual = Boolean((n.data as { manualSize?: boolean })?.manualSize);
    if (!manual) {
      const w = Number(next.width ?? cur.width) || def.width;
      const h = Number(next.height ?? cur.height) || def.height;
      if (w < def.width * 0.85 || h < def.height * 0.85) {
        next.width = def.width;
        next.height = def.height;
        changed = true;
      }
    }
  } else if (
    t === "story-comic-starter" ||
    t === "story-script-hub" ||
    t.startsWith("story-pro-")
  ) {
    const targetH = STORY_CONTROL_NODE_HEIGHT;
    const targetW = STORY_CONTROL_NODE_WIDTH;
    const w = Number(next.width ?? cur.width) || def.width;
    const h = Number(next.height ?? cur.height) || def.height;
    if (w < targetW * 0.75 || h < targetH * 0.85 || h > targetH * 1.08 || w > targetW * 1.08) {
      next.width = targetW;
      next.height = targetH;
      changed = true;
    }
  }
  const width = Number(next.width ?? cur.width) || def.width;
  const height = Number(next.height ?? cur.height) || def.height;
  if (
    !changed &&
    n.width === width &&
    n.height === height
  ) {
    return n;
  }
  return { ...n, width, height, style: next };
}

/**
 * 把 v1 graph in-memory 迁到 v2。已是 v2（schemaVersion >= 2）的 graph 原样返回，
 * 但仍会回填缺失的节点尺寸（不破坏已有尺寸）。
 */
export function migrateGraphV1ToV2(graph: CanvasGraph): CanvasGraph {
  const ver = typeof graph.schemaVersion === "number" ? graph.schemaVersion : 0;
  const rawNodes = graph.nodes ?? [];
  const transform = (n: LooseNode) =>
    migrateStoryOutlineLlmParams(
      migrateStoryComicStarterNode(
        backfillNodeSize(ver >= 2 ? n : migrateNode(n)) as CanvasFlowNode,
      ),
    );
  const edges: CanvasFlowEdge[] = graph.edges ?? [];
  const rawMigrated = migratePro2SceneColumnOffCanvas(
    rawNodes.map((n) =>
      transform(n as unknown as LooseNode),
    ) as unknown as CanvasFlowNode[],
    edges,
  );
  const nodes = migratePro2TextPurposeAll(
    migrateStoryPromptPackAll(
      normalizeCanvasNodes(rawMigrated.nodes, rawMigrated.edges),
    ),
    rawMigrated.edges,
  );
  return {
    ...graph,
    schemaVersion: CANVAS_SCHEMA_VERSION,
    nodes,
    edges: rawMigrated.edges,
  };
}
