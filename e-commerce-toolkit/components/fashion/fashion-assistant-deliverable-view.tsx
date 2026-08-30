"use client";

import {
  FashionPanelsTable,
  FashionSellpointsTable,
  FashionStoryboardResultBlock,
} from "@/components/fashion/fashion-deliverable-tables";
import {
  extractFashionDeliverableFromText,
  mergeFashionDeliverableState,
  stripFashionDeliverableFence,
} from "@/lib/fashion-deliverable-parse";
import type { FashionDeliverable } from "@/lib/fashion-types";
import { isFashionDeliverable } from "@/lib/fashion-types";
import type { ProDeliverable } from "@/lib/pro-vertical/types";
import { isProDeliverable } from "@/lib/pro-vertical/types";
import { listProStoryboardVersionKeys } from "@/lib/pro-vertical/deliverable-parse";
import { listFashionStoryboardVersionKeys } from "@/lib/fashion-workflow";

type VerticalDeliverable = FashionDeliverable | ProDeliverable;

type Props = {
  content: string;
  projectDeliverable?: VerticalDeliverable | null;
  /** 仅在等待用户选分镜版本时展示蓝色提示 */
  showStoryboardPickHint?: boolean;
  /** 已定稿版本、等待用户确认时展示 */
  showStoryboardConfirmHint?: boolean;
  /** 非最后一条助手消息时不重复展示 Brief 摘要 */
  showBrief?: boolean;
};

function storyboardVersionCount(d: VerticalDeliverable | null | undefined): number {
  if (!d) return 0;
  if (isProDeliverable(d)) return listProStoryboardVersionKeys(d).length;
  return listFashionStoryboardVersionKeys(d).length;
}

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

/** 本条助手 JSON 是否为口播/分镜/运营包阶段（此类消息不应再重复展示卖点表） */
function isNonSellpointDeliverableMessage(
  parsed: Partial<FashionDeliverable> | null,
): boolean {
  if (!parsed) return false;
  if (listFashionStoryboardVersionKeys(parsed).length > 0) return true;
  if ((parsed.voiceovers?.length ?? 0) > 0) return true;
  if (hasOpsPackContent(parsed)) return true;
  return false;
}

export function FashionAssistantDeliverableView({
  content,
  projectDeliverable,
  showStoryboardPickHint = false,
  showStoryboardConfirmHint = false,
  showBrief = true,
}: Props) {
  const parsed = extractFashionDeliverableFromText(content);
  const merged =
    parsed && projectDeliverable && isFashionDeliverable(projectDeliverable)
      ? mergeFashionDeliverableState(projectDeliverable, parsed)
      : projectDeliverable ?? parsed;
  /** 展示以 projectDeliverable（含用户保存）为准，避免历史 assistant JSON 覆盖 */
  const deliverable = projectDeliverable ?? merged;
  const brief = stripFashionDeliverableFence(content);
  const nonSellpointPhaseMessage = isNonSellpointDeliverableMessage(parsed);
  /** 本条消息 JSON 内的卖点（历史快照）；定稿后仍须在会话区展示 */
  const sellpointsFromMessage =
    parsed?.sellpoints?.length && !nonSellpointPhaseMessage ? parsed.sellpoints : null;
  /** 当前进行中的卖点（未锁定、未选口播） */
  const sellpointsFromProject =
    !sellpointsFromMessage &&
    !nonSellpointPhaseMessage &&
    deliverable?.sellpoints?.length &&
    !deliverable.sellpointsLocked &&
    !deliverable.selectedVoiceoverId
      ? deliverable.sellpoints
      : null;
  const sellpointsToShow = sellpointsFromMessage ?? sellpointsFromProject;
  const showSellpointsTable = Boolean(sellpointsToShow?.length);
  const showBriefText =
    Boolean(brief) &&
    (showBrief || Boolean(sellpointsFromMessage?.length));
  const versionCount = storyboardVersionCount(deliverable);
  const awaitingPick =
    showStoryboardPickHint &&
    versionCount > 0 &&
    !deliverable?.selectedVersion &&
    !hasOpsPackContent(deliverable) &&
    !deliverable?.outputMode;

  const confirmKey = deliverable?.selectedVersion;
  const confirmVersion = confirmKey ? deliverable?.storyboardVersions?.[confirmKey] : undefined;
  const showSelectedStoryboard =
    Boolean(confirmKey && confirmVersion?.panels?.length) &&
    !awaitingPick &&
    (deliverable?.storyboardLocked ||
      hasOpsPackContent(deliverable) ||
      Boolean(deliverable?.outputMode) ||
      showStoryboardConfirmHint);

  if (
    !showSellpointsTable &&
    !showBriefText &&
    versionCount === 0 &&
    !showStoryboardConfirmHint &&
    !showSelectedStoryboard
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      {showBriefText ? (
        <p className="whitespace-pre-wrap text-sm text-[#1d1d1f]">{brief}</p>
      ) : null}
      {showStoryboardConfirmHint && confirmKey ? (
        <div className="rounded-lg border border-[#e8e8ed] bg-[#f0f6ff] px-3 py-2 text-xs text-[#0071e3]">
          已选定 {confirmKey}版{confirmVersion?.title ? `：${confirmVersion.title}` : ""}。左侧
          12.1 分镜表可编辑并保存，确认后点下方「确认分镜，生成运营包」。
        </div>
      ) : null}
      {showSellpointsTable && sellpointsToShow ? (
        <div className="rounded-lg border border-[#e8e8ed] bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-[#6e6e73]">卖点清单</p>
          <FashionSellpointsTable sellpoints={sellpointsToShow} />
        </div>
      ) : null}
      {showSelectedStoryboard && confirmKey && confirmVersion?.panels?.length ? (
        <FashionStoryboardResultBlock
          versionKey={confirmKey}
          title={confirmVersion.title}
          panels={confirmVersion.panels}
          sellpoints={deliverable?.sellpoints}
          locked={Boolean(deliverable?.storyboardLocked)}
        />
      ) : null}
      {awaitingPick ? (
        <div className="rounded-lg border border-[#e8e8ed] bg-[#f0f6ff] px-3 py-2 text-xs text-[#0071e3]">
          已生成 {versionCount} 套分镜方案
          {versionCount === 1 ? "（A 版）" : ""}，请在下方选择继续。
        </div>
      ) : null}
    </div>
  );
}
