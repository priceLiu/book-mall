"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import {
  StoryboardAnalysisTables,
  StoryboardCreativeBrief,
  StoryboardDeliverableSectionBlock,
  StoryboardSchemePanelsTable,
  StoryboardSellingPointsList,
} from "@/components/storyboard/storyboard-deliverable-tables";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { characterPresetLabelFromKey } from "@/lib/storyboard-character-presets";
import {
  isLegacyAnalysisMarkdown,
  isStructuredAnalysis,
} from "@/lib/storyboard-deliverable-labels";
import { extractStoryboardDeliverableFromText, asStoryboardDeliverable, looksLikeRawDeliverableJson } from "@/lib/storyboard-deliverable-parse";
import { resolveScenePresetByKey, formatSceneCustomDisplay } from "@/lib/storyboard-scene-presets";
import { isAwaitingSchemePick, resolveSelectedSchemeIndex, userPickedScheme } from "@/lib/storyboard-workflow";
import type {
  StoryboardDeliverable,
  StoryboardProject,
  StoryboardReference,
  StoryboardScheme,
  StoryboardSheet,
} from "@/lib/storyboard-types";

function Dash() {
  return <span className="text-sm text-[#86868b]">--</span>;
}

function StepSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e8e8ed] bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-[#1d1d1f]">{title}</h2>
      {children}
    </section>
  );
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[#f0f0f2] py-2.5 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <span className="text-xs font-medium text-[#6e6e73]">{label}</span>
      <div className="min-w-0 text-sm text-[#1d1d1f]">{value}</div>
    </div>
  );
}

function RefImagesBlock({
  title,
  refs,
  skipped,
  skipNote,
  onPreview,
}: {
  title: string;
  refs: StoryboardReference[];
  skipped?: boolean;
  skipNote?: string;
  onPreview?: (src: string, label: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">{title}</h3>
      {skipped ? (
        <p className="text-sm text-[#86868b]">{skipNote ?? "已跳过"}</p>
      ) : refs.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {refs.map((r) => (
            <button
              key={r.id}
              type="button"
              className="group relative h-24 w-24 overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]"
              onClick={() => onPreview?.(r.ossUrl, r.label)}
            >
              <Image src={r.ossUrl} alt={r.label} fill className="object-cover" unoptimized />
              <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">
                {r.label}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Dash />
      )}
    </div>
  );
}

function resolveFinalized(project: StoryboardProject): {
  scheme: StoryboardScheme | null;
  sheet: StoryboardSheet | null;
  legacyMarkdown: string | null;
  parsedDeliverable?: StoryboardDeliverable;
} {
  const metaDeliverable = asStoryboardDeliverable(project.meta?.deliverable);
  const schemes = metaDeliverable?.schemes ?? [];
  const selectedIndex = resolveSelectedSchemeIndex(project);
  const awaitingPick = isAwaitingSchemePick(project);
  const pickScheme = (idx: number) =>
    awaitingPick ? null : schemes[idx] ?? schemes[0] ?? null;
  const scheme = pickScheme(selectedIndex);
  const sheet = project.sheet;

  let parsedDeliverable = metaDeliverable;
  const rawMd = project.meta?.deliverableMarkdown?.trim();
  if (!parsedDeliverable?.schemes?.length && rawMd && looksLikeRawDeliverableJson(rawMd)) {
    parsedDeliverable = extractStoryboardDeliverableFromText(rawMd) ?? parsedDeliverable;
  }

  const legacyMarkdown =
    !sheet && !scheme && rawMd && !looksLikeRawDeliverableJson(rawMd) ? rawMd : null;

  const schemeFromParsed = awaitingPick
    ? null
    : scheme ??
      parsedDeliverable?.schemes?.[selectedIndex] ??
      parsedDeliverable?.schemes?.[0] ??
      null;

  return {
    scheme: schemeFromParsed,
    sheet,
    legacyMarkdown,
    parsedDeliverable,
  };
}

type Props = {
  project: StoryboardProject;
  references: StoryboardReference[];
  onPreviewImage?: (src: string, title: string) => void;
  imagesSlot?: ReactNode;
  videoSlot?: ReactNode;
  onEditScriptPanel?: (panelIndex: number) => void;
};

/** 右侧内容区：按创作步骤完整展示各阶段结果，缺失显示 -- */
export function StoryboardStepResults({
  project,
  references,
  onPreviewImage,
  imagesSlot,
  videoSlot,
  onEditScriptPanel,
}: Props) {
  const deliverableFromMeta = asStoryboardDeliverable(project.meta?.deliverable);
  const wf = project.meta?.workflow ?? {};
  const { scheme, sheet, legacyMarkdown, parsedDeliverable } = resolveFinalized(project);
  const deliverable = deliverableFromMeta ?? parsedDeliverable;
  const analysis = deliverable?.analysis;

  const productRefs = references.filter((r) => r.role === "product");
  const characterRefs = references.filter((r) => r.role === "character");
  const otherRefs = references.filter((r) => r.role === "scene" || r.role === "other");

  const schemes = deliverable?.schemes ?? [];
  const selectedIndex = resolveSelectedSchemeIndex(project);
  const schemeFromPick =
    userPickedScheme(project) && !project.sheet
      ? schemes[selectedIndex] ?? schemes[0]
      : null;
  const scriptPanels =
    sheet?.panels ?? scheme?.panels ?? schemeFromPick?.panels ?? [];
  const awaitingSchemePick = isAwaitingSchemePick(project);
  const allSchemes = deliverable?.schemes ?? [];
  const hasFinalizedPlan = Boolean(sheet || scheme || legacyMarkdown || deliverable?.schemes?.length);
  const productName = deliverable?.productName?.trim();
  const params = deliverable?.params ?? {};
  const paramEntries = Object.entries(params).filter(([, v]) => typeof v === "string" && v.trim());

  const schemeTitle = sheet?.overview.title ?? scheme?.title;
  const schemeSummary = sheet?.overview.logline ?? scheme?.summary;
  const schemeStrategy = scheme?.strategy;
  const productHighlight =
    sheet?.overview.productHighlight ??
    deliverable?.productSellingPoints?.map((sp) => sp.text).join("；") ??
    (typeof params.卖点 === "string" ? params.卖点 : undefined) ??
    (typeof params["核心卖点"] === "string" ? params["核心卖点"] : undefined);

  const characterDisplay =
    characterRefs.length > 0 ? null : wf.characterPresetKey || wf.autoGenCharacter ? (
      <span className="text-sm text-[#1d1d1f]">
        {characterPresetLabelFromKey(wf.characterPresetKey) ?? "自动生成角色"}（生图前将生成角色参考图）
      </span>
    ) : wf.skippedCharacter ? (
      <span className="text-sm text-[#86868b]">已跳过</span>
    ) : null;

  return (
    <div className="space-y-6">
      <StepSection title="策划定稿">
        {awaitingSchemePick && allSchemes.length > 1 ? (
          <p className="rounded-lg border border-[#e8e8ed] bg-[#f0f6ff] px-4 py-3 text-sm text-[#0071e3]">
            共 {allSchemes.length} 套方案已生成，请在<strong className="font-semibold">左侧助手区</strong>
            点选一套后继续（无需在此重复选择）。
          </p>
        ) : null}

        {!awaitingSchemePick ? (
          <>
        {deliverable?.creativeBrief ? (
          <div className="mb-6 border-b border-[#e8e8ed] pb-6">
            <StoryboardDeliverableSectionBlock title="创意简报">
              <StoryboardCreativeBrief brief={deliverable.creativeBrief} />
            </StoryboardDeliverableSectionBlock>
          </div>
        ) : null}

        {deliverable?.productSellingPoints?.length ? (
          <div className="mb-6 border-b border-[#e8e8ed] pb-6">
            <StoryboardDeliverableSectionBlock title="产品卖点">
              <StoryboardSellingPointsList sellpoints={deliverable.productSellingPoints} />
            </StoryboardDeliverableSectionBlock>
          </div>
        ) : null}

        {analysis && isStructuredAnalysis(analysis) ? (
          <div className="mb-6 border-b border-[#e8e8ed] pb-6">
            <StoryboardAnalysisTables analysis={analysis} />
          </div>
        ) : analysis && isLegacyAnalysisMarkdown(analysis) ? (
          <div className="mb-6 space-y-5 border-b border-[#e8e8ed] pb-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">表1 · 人群画像</h3>
              <StoryboardMarkdownBlock markdown={analysis.audienceMarkdown} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">表2 · 三层痛点</h3>
              <StoryboardMarkdownBlock markdown={analysis.painPointsMarkdown} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">表3 · 爆款策略</h3>
              <StoryboardMarkdownBlock markdown={analysis.strategiesMarkdown} />
            </div>
          </div>
        ) : null}

        <h3 className="mb-3 text-sm font-semibold text-[#6e6e73]">定稿方案</h3>
        {hasFinalizedPlan ? (
          <div className="divide-y divide-[#f0f0f2]">
            <FieldRow label="产品名称" value={productName || <Dash />} />
            {paramEntries.length > 0 ? (
              <FieldRow
                label="策划参数"
                value={
                  <ul className="space-y-1">
                    {paramEntries.map(([k, v]) => (
                      <li key={k}>
                        <span className="text-[#6e6e73]">{k}：</span>
                        {v}
                      </li>
                    ))}
                  </ul>
                }
              />
            ) : (
              <FieldRow label="策划参数" value={<Dash />} />
            )}
            <FieldRow label="方案标题" value={schemeTitle?.trim() || <Dash />} />
            <FieldRow label="方案概要" value={schemeSummary?.trim() || <Dash />} />
            <FieldRow label="内容策略" value={schemeStrategy?.trim() || <Dash />} />
            <FieldRow label="核心卖点" value={productHighlight?.trim() || <Dash />} />
            <FieldRow
              label="镜头数量"
              value={
                scriptPanels.length > 0 ? (
                  `${scriptPanels.length} 镜 · ${sheet?.totalDurationHintSec ?? scheme?.totalDurationHintSec ?? "--"}s`
                ) : (
                  <Dash />
                )
              }
            />
            {legacyMarkdown ? (
              <div className="pt-4">
                <h4 className="mb-2 text-xs font-semibold text-[#6e6e73]">
                  历史交付原文（legacy）
                </h4>
                <StoryboardMarkdownBlock markdown={legacyMarkdown} />
              </div>
            ) : null}
            {!sheet && deliverable?.schemes?.length && !scheme ? (
              <p className="pt-2 text-xs text-[#86868b]">
                策划 JSON 已解析，请刷新或重新打开项目以同步定稿 sheet。
              </p>
            ) : null}
          </div>
        ) : (
          <Dash />
        )}
          </>
        ) : null}
      </StepSection>

      <StepSection title="产品图">
        <RefImagesBlock
          title="产品参考图"
          refs={productRefs}
          skipped={Boolean(wf.skippedProduct) && productRefs.length === 0}
          onPreview={onPreviewImage}
        />
      </StepSection>

      <StepSection title="角色图">
        {characterDisplay ? (
          characterDisplay
        ) : (
          <RefImagesBlock
            title="角色参考图"
            refs={characterRefs}
            skipped={Boolean(wf.skippedCharacter) && characterRefs.length === 0}
            onPreview={onPreviewImage}
          />
        )}
      </StepSection>

      <StepSection title="场景图">
        {(wf.scenePreset || wf.scenePresetCustom) && otherRefs.length === 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">场景参考</h3>
            {wf.scenePreset === "custom" && wf.scenePresetCustom ? (
              <p className="text-sm text-[#1d1d1f]">
                自定义场景：{formatSceneCustomDisplay(wf.scenePresetCustom)}
              </p>
            ) : (
              <>
                <p className="text-sm text-[#1d1d1f]">
                  预设场景：
                  {resolveScenePresetByKey(wf.scenePreset)?.label ?? wf.scenePreset}
                </p>
                <p className="mt-1 text-xs text-[#86868b]">
                  {resolveScenePresetByKey(wf.scenePreset)?.scriptHint}
                </p>
              </>
            )}
          </div>
        ) : (
          <RefImagesBlock
            title="场景参考图"
            refs={otherRefs}
            skipped={Boolean(wf.skippedRefs) && otherRefs.length === 0}
            onPreview={onPreviewImage}
          />
        )}
      </StepSection>

      <StepSection title="分镜脚本">
        {onEditScriptPanel && scriptPanels.length > 0 ? (
          <p className="mb-3 text-xs text-[#86868b]">
            修改并保存后，生成全部分镜图将按最新脚本执行。
          </p>
        ) : null}
        <StoryboardSchemePanelsTable
          panels={scriptPanels}
          sellpoints={deliverable?.productSellingPoints}
          editable={Boolean(onEditScriptPanel && sheet)}
          onEditPanel={onEditScriptPanel}
        />
      </StepSection>

      <StepSection title="分镜图">
        {imagesSlot ?? <Dash />}
      </StepSection>

      <StepSection title="成片">
        {videoSlot ?? <Dash />}
      </StepSection>
    </div>
  );
}
