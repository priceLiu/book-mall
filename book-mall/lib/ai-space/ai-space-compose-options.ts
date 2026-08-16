import {
  AI_SPACE_COMPOSE_DEFAULT_OPTIONS,
  type AiSpaceComposeOverlayOptions,
} from "./ai-space-compose-types";

/** 解析任务/请求中的 overlay 参数快照（服务端与客户端共用） */
export function parseAiSpaceComposeOverlayOptions(
  raw: unknown,
): AiSpaceComposeOverlayOptions {
  const o = (raw ?? {}) as Partial<AiSpaceComposeOverlayOptions>;
  const scale =
    typeof o.scale === "number" && o.scale >= 0.1 && o.scale <= 1
      ? o.scale
      : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.scale;
  const marginPx =
    typeof o.marginPx === "number" && o.marginPx >= 0 && o.marginPx <= 400
      ? Math.round(o.marginPx)
      : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.marginPx;
  const position =
    o.position === "bottom-left" ||
    o.position === "top-right" ||
    o.position === "top-left" ||
    o.position === "center"
      ? o.position
      : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.position;
  return {
    scale,
    marginPx,
    position,
    burnSubtitle: o.burnSubtitle === true,
    resolution: o.resolution === "720P" ? "720P" : "480P",
    appearFromSec:
      typeof o.appearFromSec === "number" && o.appearFromSec >= 0
        ? o.appearFromSec
        : undefined,
    appearToSec:
      typeof o.appearToSec === "number" && o.appearToSec >= 0
        ? o.appearToSec
        : o.appearToSec === null
          ? null
          : undefined,
  };
}

/** `?tab=compose&fromTask=` — 从合成任务载入参数到合成台 */
export const AI_SPACE_COMPOSE_FROM_TASK_PARAM = "fromTask";

export function buildAiSpaceComposeDeskEditHref(taskId: string): string {
  const params = new URLSearchParams({
    tab: "compose",
    [AI_SPACE_COMPOSE_FROM_TASK_PARAM]: taskId,
  });
  return `/account/ai-space?${params.toString()}`;
}
