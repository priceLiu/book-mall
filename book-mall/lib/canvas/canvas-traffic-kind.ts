import type { Prisma } from "@prisma/client";

/** 画布任务 inputPayload.kind → 是否走交通控流派发 */
export function isCanvasVideoTrafficKind(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return kind === "video-engine" || kind === "ai-video-engine";
}

export function isCanvasImageTrafficKind(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return kind === "image-engine" || kind === "three-view-engine";
}

/** Story / Pro2 文本 LLM（异步 execute，Gateway log 在 chat 发起后才出现） */
export const CANVAS_LLM_ENGINE_KINDS = [
  "story-outline-engine",
  "character-engine",
  "storyboard-engine",
  "ai-engine",
] as const;

export function isCanvasLlmEngineKind(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return (CANVAS_LLM_ENGINE_KINDS as readonly string[]).includes(kind);
}

export function isCanvasTrafficKind(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  return (
    isCanvasVideoTrafficKind(payload) ||
    isCanvasImageTrafficKind(payload) ||
    isCanvasLlmEngineKind(payload)
  );
}

/** Prisma where：画布 Story LLM 任务 */
export function canvasLlmPayloadWhere(): Prisma.CanvasGenerationTaskWhereInput {
  return {
    OR: CANVAS_LLM_ENGINE_KINDS.map((kind) => ({
      inputPayload: { path: ["kind"], equals: kind },
    })),
  };
}

/** Prisma where：画布交通控流任务（视频 + 生图） */
export function canvasTrafficPayloadWhere(): Prisma.CanvasGenerationTaskWhereInput {
  return {
    OR: [
      { inputPayload: { path: ["kind"], equals: "video-engine" } },
      { inputPayload: { path: ["kind"], equals: "ai-video-engine" } },
      { inputPayload: { path: ["kind"], equals: "image-engine" } },
      { inputPayload: { path: ["kind"], equals: "three-view-engine" } },
    ],
  };
}

export type GridSplitPreparePayload = {
  sourceUrl: string;
  col: number;
  row: number;
  cols: number;
  rows: number;
};

export function readGridSplitPrepare(
  payload: Record<string, unknown>,
): GridSplitPreparePayload | null {
  const raw = payload.gridSplitPrepare;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sourceUrl = typeof o.sourceUrl === "string" ? o.sourceUrl.trim() : "";
  if (!/^https?:\/\//.test(sourceUrl)) return null;
  return {
    sourceUrl,
    col: Number(o.col) || 0,
    row: Number(o.row) || 0,
    cols: Math.max(1, Number(o.cols) || 1),
    rows: Math.max(1, Number(o.rows) || 1),
  };
}

export function readPipelineStage(
  payload: Record<string, unknown>,
): "QUEUED" | "PREPARING" | "DISPATCHING" | null {
  const raw = payload.pipelineStage;
  if (raw === "PREPARING" || raw === "DISPATCHING" || raw === "QUEUED") {
    return raw;
  }
  return null;
}
