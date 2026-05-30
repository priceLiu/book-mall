/**
 * 影视专业版 ·「AI 生成草稿」结果解析与写回节点
 */
import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type {
  StoryProColorTone,
  StoryProMainStyle,
  StoryProRenderQuality,
} from "./story-pro-workspace-types";
import type { CanvasNodeRuntime } from "./types";
import { formatCanvasTaskError } from "./friendly-task-error";

const MAIN_STYLES = new Set([
  "anime",
  "american-comic",
  "webtoon",
  "chibi",
  "cg",
  "photorealistic",
  "game-cg",
  "chinese-3d",
  "other",
]);
const COLOR_TONES = new Set([
  "bright-warm",
  "dark-moody",
  "vivid",
  "soft",
  "high-contrast",
]);
const RENDER_QUALITIES = new Set(["flat", "thick-paint", "watercolor", "oil"]);

export type StoryProStyleDraftPatch = {
  mainStyle?: StoryProMainStyle;
  colorTone?: StoryProColorTone;
  renderQuality?: StoryProRenderQuality;
  styleAnchorZh?: string;
  styleAnchorEn?: string;
  negativePrompt?: string;
  runtime: CanvasNodeRuntime;
};

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  if (!t) return null;
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? t).trim();
  try {
    const j = JSON.parse(candidate) as unknown;
    return j && typeof j === "object" && !Array.isArray(j)
      ? (j as Record<string, unknown>)
      : null;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const j = JSON.parse(candidate.slice(start, end + 1)) as unknown;
        return j && typeof j === "object" && !Array.isArray(j)
          ? (j as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseStoryProStyleDraftPatch(
  textOutput: string | null | undefined,
): Omit<StoryProStyleDraftPatch, "runtime"> | null {
  const json = extractJsonObject(textOutput ?? "");
  if (!json) return null;
  const patch: Omit<StoryProStyleDraftPatch, "runtime"> = {};
  const main = String(json.mainStyle ?? "").trim();
  if (MAIN_STYLES.has(main)) patch.mainStyle = main as StoryProMainStyle;
  const tone = String(json.colorTone ?? "").trim();
  if (COLOR_TONES.has(tone)) patch.colorTone = tone as StoryProColorTone;
  const qual = String(json.renderQuality ?? "").trim();
  if (RENDER_QUALITIES.has(qual)) {
    patch.renderQuality = qual as StoryProRenderQuality;
  }
  const zh = String(json.styleAnchorZh ?? "").trim();
  const en = String(json.styleAnchorEn ?? "").trim();
  const neg = String(json.negativePrompt ?? "").trim();
  if (zh) patch.styleAnchorZh = zh;
  if (en) patch.styleAnchorEn = en;
  if (neg) patch.negativePrompt = neg;
  if (
    !patch.mainStyle &&
    !patch.colorTone &&
    !patch.renderQuality &&
    !patch.styleAnchorZh &&
    !patch.styleAnchorEn &&
    !patch.negativePrompt
  ) {
    return null;
  }
  return patch;
}

export function buildStoryProStyleDraftApplyPatch(
  task: CanvasTaskRecord,
): StoryProStyleDraftPatch | null {
  if (task.status === "FAILED") {
    return {
      runtime: {
        status: "error",
        taskId: task.id,
        failCode: task.failCode ?? "FAILED",
        failMessage: formatCanvasTaskError(
          task.failCode,
          task.failMessage,
        ),
      },
    };
  }
  if (task.status !== "SUCCEEDED" || !task.textOutput?.trim()) {
    return {
      runtime: {
        status:
          task.status === "PENDING" || task.status === "SUBMITTED"
            ? task.status === "PENDING"
              ? "pending"
              : "running"
            : "running",
        taskId: task.id,
      },
    };
  }
  const fields = parseStoryProStyleDraftPatch(task.textOutput);
  if (!fields) {
    return {
      runtime: {
        status: "error",
        taskId: task.id,
        failCode: "STYLE_DRAFT_PARSE_FAILED",
        failMessage:
          "AI 返回内容无法解析为风格 JSON，请重试或手动填写锚定词",
        textOutput: task.textOutput ?? undefined,
      },
    };
  }
  return {
    ...fields,
    runtime: {
      status: "done",
      taskId: task.id,
      textOutput: task.textOutput,
    },
  };
}
