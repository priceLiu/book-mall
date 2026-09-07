import type { FashionDeliverable } from "@/lib/fashion-types";
import { listProStoryboardVersionKeys } from "@/lib/pro-vertical/deliverable-parse";
import type { ProDeliverable } from "@/lib/pro-vertical/types";
import { listFashionStoryboardVersionKeys, listStoryTheaterVersionKeys } from "@/lib/fashion-workflow";
import { isStoryTheaterDeliverable } from "@/lib/story-theater-workflow";

export type VerticalDeliverable = FashionDeliverable | ProDeliverable;

function hasOpsPackContent(
  d: Pick<VerticalDeliverable, "opsPack"> | null | undefined,
): boolean {
  const ops = d?.opsPack;
  if (!ops) return false;
  return Boolean(
    (ops.titles?.length ?? 0) > 0 ||
      (ops.coverWords?.length ?? 0) > 0 ||
      (ops.tags?.length ?? 0) > 0 ||
      (ops.detailBullets?.length ?? 0) > 0 ||
      Boolean(ops.xiaohongshuBody?.trim()),
  );
}

/** 本条助手 JSON 是否为口播/分镜/故事剧场/运营包阶段（此类消息不应再重复展示卖点表） */
export function isNonSellpointDeliverableMessage(
  parsed: Partial<FashionDeliverable> | Partial<ProDeliverable> | null,
): boolean {
  if (!parsed) return false;
  if (listFashionStoryboardVersionKeys(parsed).length > 0) return true;
  if (listProStoryboardVersionKeys(parsed as ProDeliverable).length > 0) return true;
  if (listStoryTheaterVersionKeys(parsed).length > 0) return true;
  if (parsed.selectedStoryTopic) return true;
  if ((parsed.voiceovers?.length ?? 0) > 0) return true;
  if (hasOpsPackContent(parsed)) return true;
  return false;
}

/** 故事剧场线：卖点已定稿且已进入选题/故事版阶段时，勿在会话区重复渲染卖点表 */
export function shouldReplaySellpointsInAssistant(
  deliverable: VerticalDeliverable | null | undefined,
): boolean {
  if (!deliverable?.sellpoints?.length) return false;
  if (!isStoryTheaterDeliverable(deliverable)) return true;
  if (!deliverable.sellpointsLocked) return true;
  if (deliverable.selectedStoryTopic) return false;
  if (listStoryTheaterVersionKeys(deliverable).length > 0) return false;
  return true;
}

export function parsedMessageHasStoryTheaterContent(
  parsed: Partial<FashionDeliverable> | Partial<ProDeliverable> | null | undefined,
): boolean {
  if (!parsed) return false;
  return (
    listStoryTheaterVersionKeys(parsed).length > 0 || Boolean(parsed.selectedStoryTopic)
  );
}
