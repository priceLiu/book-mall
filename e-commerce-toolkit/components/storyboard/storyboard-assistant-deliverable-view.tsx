"use client";

import {
  StoryboardAnalysisTables,
  StoryboardCreativeBrief,
  StoryboardDeliverableSectionBlock,
  StoryboardSchemePanelsTable,
  StoryboardSellingPointsList,
} from "@/components/storyboard/storyboard-deliverable-tables";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import {
  isLegacyAnalysisMarkdown,
  isStructuredAnalysis,
} from "@/lib/storyboard-deliverable-labels";
import {
  extractStoryboardDeliverableFromText,
  looksLikeRawDeliverableJson,
  stripStoryboardDeliverableFence,
} from "@/lib/storyboard-deliverable-parse";
import type { StoryboardDeliverable } from "@/lib/storyboard-types";

type Props = {
  content: string;
  /** 服务端已入库的 deliverable（优先） */
  projectDeliverable?: StoryboardDeliverable;
  selectedSchemeIndex?: number;
  /** 多套方案待选：不默认展示方案一 */
  awaitingSchemePick?: boolean;
  compact?: boolean;
};

export function StoryboardAssistantDeliverableView({
  content,
  projectDeliverable,
  selectedSchemeIndex = 0,
  awaitingSchemePick = false,
  compact = false,
}: Props) {
  const parsedFromMessage = extractStoryboardDeliverableFromText(content);
  const deliverable = projectDeliverable ?? parsedFromMessage;
  const brief = stripStoryboardDeliverableFence(content);

  if (!deliverable && looksLikeRawDeliverableJson(content)) {
    return (
      <p className="text-sm text-[var(--ecom-muted)]">
        策划 JSON 已收到，正在同步结构化结果…请稍候或刷新页面。
      </p>
    );
  }

  if (!deliverable) {
    if (!brief) return null;
    return <StoryboardMarkdownBlock markdown={brief} />;
  }

  const schemes = deliverable.schemes ?? [];
  const multiAwaitingPick = awaitingSchemePick && schemes.length > 1;
  const scheme = multiAwaitingPick
    ? null
    : schemes[selectedSchemeIndex] ?? schemes[0];

  return (
    <div className="space-y-4">
      {brief ? (
        <div className="text-sm text-[var(--ecom-ink)]">
          <StoryboardMarkdownBlock markdown={brief} />
        </div>
      ) : null}

      {multiAwaitingPick ? (
        <p className="rounded-lg border border-[var(--ecom-divider)] bg-[var(--ecom-content-selected-bg)] px-3 py-2 text-xs text-[var(--ecom-primary)]">
          共 {schemes.length} 套方案已生成，请在下方卡片中单选一套后继续。
        </p>
      ) : null}

      {multiAwaitingPick ? null : (
      <div className="rounded-lg border border-[var(--ecom-divider)] bg-[#fafafa] p-3">
        <p className="mb-3 text-xs font-semibold text-[var(--ecom-muted)]">
          策划交付 · {deliverable.productName?.trim() || "产品方案"}
          {schemes.length > 1 ? ` · 共 ${schemes.length} 套` : ""}
        </p>

        {multiAwaitingPick ? null : deliverable.creativeBrief && !compact ? (
          <div className="mb-4">
            <StoryboardCreativeBrief brief={deliverable.creativeBrief} />
          </div>
        ) : null}

        {multiAwaitingPick ? null : deliverable.productSellingPoints?.length ? (
          <StoryboardDeliverableSectionBlock title="产品卖点">
            <StoryboardSellingPointsList sellpoints={deliverable.productSellingPoints} />
          </StoryboardDeliverableSectionBlock>
        ) : null}

        {multiAwaitingPick ? null : deliverable.analysis && isStructuredAnalysis(deliverable.analysis) ? (
          <StoryboardAnalysisTables analysis={deliverable.analysis} />
        ) : multiAwaitingPick ? null : deliverable.analysis && isLegacyAnalysisMarkdown(deliverable.analysis) ? (
          <div className="space-y-3">
            <StoryboardMarkdownBlock markdown={deliverable.analysis.audienceMarkdown} />
            <StoryboardMarkdownBlock markdown={deliverable.analysis.painPointsMarkdown} />
            <StoryboardMarkdownBlock markdown={deliverable.analysis.strategiesMarkdown} />
          </div>
        ) : null}

        {multiAwaitingPick ? null : scheme ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-[var(--ecom-ink)]">{scheme.title}</p>
            {scheme.summary ? (
              <p className="text-xs text-[var(--ecom-muted)]">{scheme.summary}</p>
            ) : null}
            <StoryboardSchemePanelsTable
              panels={scheme.panels}
              sellpoints={deliverable.productSellingPoints}
            />
          </div>
        ) : null}

        {!compact && !multiAwaitingPick && schemes.length > 1 && scheme ? (
          <div className="mt-4 space-y-4 border-t border-[var(--ecom-divider)] pt-4">
            <p className="text-xs font-semibold text-[var(--ecom-muted)]">其它方案</p>
            {schemes.map((s, i) =>
              i === selectedSchemeIndex ? null : (
                <div key={s.id} className="space-y-2">
                  <p className="text-sm font-medium text-[var(--ecom-ink)]">{s.title}</p>
                  {s.summary ? (
                    <p className="text-xs text-[var(--ecom-muted)]">{s.summary}</p>
                  ) : null}
                  <StoryboardSchemePanelsTable
                    panels={s.panels}
                    sellpoints={deliverable.productSellingPoints}
                  />
                </div>
              ),
            )}
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
}
