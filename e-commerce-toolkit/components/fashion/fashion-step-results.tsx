"use client";

import type { ReactNode } from "react";

import {
  FashionCoverageTable,
  FashionOpsPackBlock,
  FashionPanelsTable,
  FashionParamsTable,
  FashionSellpointsTable,
} from "@/components/fashion/fashion-deliverable-tables";
import {
  isAwaitingFashionStoryboardPick,
  isAwaitingStoryTheaterPick,
  isFashionStoryboardPanelsEditable,
  isStoryTheaterPanelsEditable,
  isFashionInProduce,
  isDirectVideoProduceReady,
  isSellpointUserInputActive,
  listFashionStoryboardVersionKeys,
  listStoryTheaterVersionKeys,
  resolveFashionStoryboardPanelsForVersion,
  resolveProVerticalDeliverable,
  getProjectVertical,
  getSellpointInputMode,
} from "@/lib/fashion-workflow";
import { getProVerticalConfig } from "@/lib/pro-vertical/registry";
import { isProDeliverable } from "@/lib/pro-vertical/types";
import type { FashionPanelRow, FashionSellpoint } from "@/lib/fashion-types";
import { isFashionDeliverable } from "@/lib/fashion-types";
import type { StoryTheaterTopicRef } from "@/lib/story-theater-types";
import type { StoryboardProject } from "@/lib/storyboard-types";

function StepSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e8e8ed] bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-[#1d1d1f]">{title}</h2>
      {children}
    </section>
  );
}

function StoryTopicSection({ topic }: { topic: StoryTheaterTopicRef }) {
  return (
    <StepSection title="故事主题（已定稿）">
      <div className="space-y-2 text-sm">
        <p className="font-medium text-[#1d1d1f]">{topic.title}</p>
        <p className="text-xs text-[#86868b]">
          类型：{topic.storyType}
          {topic.id ? ` · ID ${topic.id}` : ""}
        </p>
        <p className="leading-relaxed text-[#6e6e73]">{topic.storyCore}</p>
      </div>
    </StepSection>
  );
}

type Props = {
  project: StoryboardProject;
  imagesSlot?: ReactNode;
  videoSlot?: ReactNode;
  produceWorkspace?: ReactNode;
  sellpointsSaving?: boolean;
  onSaveSellpoints?: (sellpoints: FashionSellpoint[]) => void | Promise<void>;
  panelsSaving?: boolean;
  onSavePanels?: (panels: FashionPanelRow[]) => void | Promise<void>;
};

export function FashionStepResults({
  project,
  imagesSlot,
  videoSlot,
  produceWorkspace,
  sellpointsSaving = false,
  onSaveSellpoints,
  panelsSaving = false,
  onSavePanels,
}: Props) {
  const deliverable = resolveProVerticalDeliverable(project);
  const verticalConfig = getProVerticalConfig(getProjectVertical(project) ?? "fashion_apparel");
  if (!deliverable) {
    return (
      <div className="rounded-xl border border-dashed border-[#e8e8ed] bg-white p-8 text-center text-sm text-[#86868b]">
        完成右侧交互后，参数档案、卖点、口播与分镜表将在此实时展示。
      </div>
    );
  }

  const awaitingVersionPick = isAwaitingFashionStoryboardPick(project);
  const awaitingStoryTheaterPick = isAwaitingStoryTheaterPick(project);
  const versionKeys = listFashionStoryboardVersionKeys(deliverable);
  const storyTheaterKeys = listStoryTheaterVersionKeys(deliverable);
  const showSellpointsSection =
    deliverable.sellpoints.length > 0 || isSellpointUserInputActive(project);
  const sellpointsEditable =
    !deliverable.sellpointsLocked &&
    Boolean(onSaveSellpoints) &&
    (isSellpointUserInputActive(project) || deliverable.sellpoints.length > 0);
  const versionKey = deliverable.selectedVersion ?? null;
  const storyTheaterKey = deliverable.selectedStoryTheaterVersion ?? null;
  const isStoryLine = deliverable.productionMode === "story_theater";
  const selectedStoryTopic = deliverable.selectedStoryTopic ?? null;
  const resolvedPanels =
    isStoryLine && storyTheaterKey
      ? deliverable.storyTheaterVersions?.[storyTheaterKey]?.panels
      : versionKey != null
        ? isFashionDeliverable(deliverable)
          ? resolveFashionStoryboardPanelsForVersion(project, versionKey, deliverable)
          : isProDeliverable(deliverable)
            ? deliverable.storyboardVersions?.[versionKey]?.panels
            : undefined
        : undefined;
  const versionMeta =
    isStoryLine && storyTheaterKey
      ? deliverable.storyTheaterVersions?.[storyTheaterKey]
      : versionKey
        ? deliverable.storyboardVersions?.[versionKey]
        : undefined;
  const panels =
    resolvedPanels ??
    versionMeta?.panels ??
    [];
  const version =
    (isStoryLine && storyTheaterKey && (panels.length > 0 || versionMeta?.title)) ||
    (versionKey && (panels.length > 0 || versionMeta?.title || versionMeta?.summary))
      ? { ...versionMeta, id: (isStoryLine ? storyTheaterKey : versionKey)!, title: versionMeta?.title, panels }
      : versionMeta;
  const selectedVoiceover = deliverable.voiceovers.find(
    (v) => v.id === deliverable.selectedVoiceoverId,
  );
  const panelsEditable =
    deliverable.productionMode === "story_theater"
      ? isStoryTheaterPanelsEditable(project)
      : isFashionStoryboardPanelsEditable(project);
  const inDirectVideoProduce = isDirectVideoProduceReady(project);
  const inProduce = isFashionInProduce(project);
  const showPanelsAboveProduceWorkspace = Boolean(
    inProduce && inDirectVideoProduce && panels.length > 0,
  );
  const showPanelsInProduceMain =
    inProduce &&
    panels.length > 0 &&
    (deliverable.selectedVersion || deliverable.selectedStoryTheaterVersion);

  const paramsSection = (
    <StepSection title="产品参数档案">
      <FashionParamsTable
        dimensions={deliverable.dimensions}
        dimensionLabels={verticalConfig?.dimensionSteps.map((s) => ({
          key: s.key,
          label: s.label,
        }))}
      />
    </StepSection>
  );

  const sellpointsSection = showSellpointsSection ? (
    <StepSection
      title={
        deliverable.sellpointsLocked
          ? "定稿卖点清单"
          : getSellpointInputMode(project) === "user"
            ? "卖点清单（用户输入 · 确认前可编辑）"
            : "卖点清单（确认前可编辑）"
      }
    >
      {deliverable.sellpointsLocked ? (
        <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
          已定稿，仅供查阅与验收；如需修改请回到右侧助手重新走卖点流程。
        </p>
      ) : (
        <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
          {isSellpointUserInputActive(project)
            ? "填写您的原始卖点；润色与确认在右侧会话区进行。定稿后将在此展示结构化清单。"
            : "可直接修改卖点文案与分层，保存后继续；定稿请在右侧助手点击「确认卖点清单」。"}
        </p>
      )}
      <FashionSellpointsTable
        sellpoints={deliverable.sellpoints}
        editable={sellpointsEditable}
        saving={sellpointsSaving}
        onSaveSellpoints={onSaveSellpoints}
      />
    </StepSection>
  ) : null;

  const storyTopicSection =
    isStoryLine && selectedStoryTopic ? (
      <StoryTopicSection topic={selectedStoryTopic} />
    ) : null;

  const panelsTableSection =
    panels.length > 0 && (deliverable.selectedVersion || deliverable.selectedStoryTheaterVersion) ? (
      <StepSection
        title={
          isStoryLine && storyTheaterKey
            ? `故事剧场 · 分镜表（${storyTheaterKey}${deliverable.storyTheaterLocked ? " · 已定稿" : ""}）`
            : `12.1 · 分镜脚本表${versionKey ? `（${versionKey}版${deliverable.storyboardLocked ? " · 已定稿" : ""}）` : ""}`
        }
      >
        {panelsEditable ? (
          <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
            {isStoryLine
              ? "可直接修改各镜字段，保存后继续；定稿请在右侧助手点击「确认故事版，开始成片」。"
              : "可直接修改各镜字段，保存后继续；定稿请在右侧助手点击「确认分镜，生成运营包」。"}
          </p>
        ) : deliverable.storyTheaterLocked && inProduce && inDirectVideoProduce ? (
          <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
            故事版已定稿；本表仅供查阅，生图与合成请在下方「故事版 · 成片工作区」进行。
          </p>
        ) : deliverable.storyboardLocked && inProduce && inDirectVideoProduce ? (
          <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
            分镜已定稿；本表仅供查阅，生图与合成请在下方「故事版 · 成片工作区」进行。
          </p>
        ) : deliverable.storyboardLocked ? (
          <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
            分镜已定稿，如需修改请返回重新选版（运营包生成前）。
          </p>
        ) : null}
        <FashionPanelsTable
          panels={panels}
          sellpoints={deliverable.sellpoints}
          panelFocusLabel={verticalConfig?.panelFocusLabel ?? "展示重点"}
          editable={panelsEditable && Boolean(onSavePanels)}
          saving={panelsSaving}
          onSavePanels={onSavePanels}
          storyTheaterMode={deliverable.productionMode === "story_theater"}
        />
      </StepSection>
    ) : null;

  const voiceoverSection =
    deliverable.sellpointsLocked && deliverable.voiceovers.length > 0 ? (
      <StepSection
        title={selectedVoiceover ? "口播文案（已定稿）" : "口播文案（待选定）"}
      >
        {selectedVoiceover ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-[#1d1d1f]">
              已选：{selectedVoiceover.type}（{selectedVoiceover.id}）
            </p>
            <p className="text-[#6e6e73]">{selectedVoiceover.narrative}</p>
            <p className="whitespace-pre-wrap text-[#1d1d1f]">{selectedVoiceover.script}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#6e6e73]">请在右侧助手点选一套口播文案继续。</p>
            {deliverable.voiceovers.map((v) => (
              <div key={v.id} className="rounded-lg border border-[#f0f0f2] p-3 text-sm">
                <p className="font-medium">
                  {v.type}（{v.id}）
                </p>
                <p className="text-xs text-[#86868b]">{v.narrative}</p>
              </div>
            ))}
          </div>
        )}
      </StepSection>
    ) : null;

  const coverageSection =
    panels.length > 0 && deliverable.selectedVersion && deliverable.sellpoints.length && !inDirectVideoProduce ? (
      <StepSection title="12.3 · 卖点覆盖率验收清单">
        <FashionCoverageTable sellpoints={deliverable.sellpoints} panels={panels} />
      </StepSection>
    ) : null;

  const opsSection = deliverable.opsPack ? (
    <StepSection title="运营素材包">
      <FashionOpsPackBlock ops={deliverable.opsPack} />
    </StepSection>
  ) : null;

  /** 策划阶段：完整交付物栈（七维 → 卖点 → 主题 → 口播 → 分镜 → 验收 → 运营包） */
  const planningArchiveSections = (
    <>
      {paramsSection}
      {sellpointsSection}
      {storyTopicSection}
      {voiceoverSection}
      {!showPanelsAboveProduceWorkspace ? panelsTableSection : null}
      {coverageSection}
      {opsSection}
    </>
  );

  /** 成片阶段主区：已定稿策划摘要，保持在分镜表与成片工作区之上 */
  const producePlanningSummary = (
    <>
      {paramsSection}
      {sellpointsSection}
      {storyTopicSection}
    </>
  );

  /** 成片阶段底部查阅区：仅次要交付物，避免与主区重复 */
  const produceSupplementaryArchive = (
    <>
      {voiceoverSection}
      {coverageSection}
      {opsSection}
    </>
  );

  const hasProduceSupplementaryArchive =
    Boolean(voiceoverSection) || Boolean(coverageSection) || Boolean(opsSection);

  if (inProduce) {
    return (
      <div className="space-y-4">
        <StepSection title="成片制作（当前步骤）">
          <p className="text-sm text-[#1d1d1f]">
            {deliverable.outputMode === "script_compose"
              ? "路径 A：分镜脚本交付 — 在下方分镜图/单镜视频区逐镜生成，可导出或合并。"
              : "路径 B：故事版一键成片 — 在故事版工作区生成各镜分镜图，完成后在「一键成片」提交整页故事版至视频模型。"}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#86868b]">
            {isStoryLine
              ? "七维 → 卖点 → 主题 → T 版 → 成片 已全部完成；下方保留策划摘要与定稿分镜表，请在「故事版 · 成片工作区」生图与合成。"
              : "七维 → 卖点 → 口播 → 分镜 → 运营包 已全部完成；口播与运营包等补充交付物见本页最下方「查阅区」。"}
          </p>
        </StepSection>

        {producePlanningSummary}

        {showPanelsInProduceMain ? panelsTableSection : null}

        {inDirectVideoProduce ? (
          <>
            <StepSection title="故事版 · 成片工作区">
              {produceWorkspace ?? (
                <p className="text-sm text-[#86868b]">
                  正在同步故事版…若长时间无内容，请点工作区内的「重新同步故事版」。
                </p>
              )}
            </StepSection>
            <StepSection title="一键成片">
              {videoSlot ?? (
                <span className="text-sm text-[#86868b]">
                  故事版 6 镜分镜图就绪后，在此整图提交视频模型生成成片。
                </span>
              )}
            </StepSection>
          </>
        ) : (
          <>
            {!showPanelsInProduceMain ? panelsTableSection : null}
            <StepSection title="分镜图与单镜视频">
              {imagesSlot ?? <span className="text-sm text-[#86868b]">—</span>}
            </StepSection>
          </>
        )}

        {hasProduceSupplementaryArchive ? (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-[#86868b]">策划交付物（查阅）</h2>
            {produceSupplementaryArchive}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {planningArchiveSections}

      {awaitingStoryTheaterPick && storyTheaterKeys.length > 0 ? (
        <StepSection title="故事版方案（待选定）">
          <p className="mb-3 text-sm text-[#6e6e73]">
            已在右侧生成 {storyTheaterKeys.length} 套故事版方案。请先在助手区选定 T1–T5，再在此查看分镜表并确认定稿。
          </p>
          <ul className="space-y-2 text-sm">
            {storyTheaterKeys.map((k) => {
              const v = deliverable.storyTheaterVersions![k]!;
              return (
                <li key={k} className="rounded-lg border border-[#f0f0f2] px-3 py-2 text-[#1d1d1f]">
                  <span className="font-medium">{k}</span>
                  {v.title ? `：${v.title}` : ""}
                  {v.summary ? (
                    <p className="mt-1 text-xs leading-relaxed text-[#86868b]">{v.summary}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </StepSection>
      ) : null}

      {awaitingVersionPick && versionKeys.length > 0 ? (
        <StepSection title="分镜方案（待选定）">
          <p className="mb-3 text-sm text-[#6e6e73]">
            已在右侧生成 {versionKeys.length} 套分镜方案。请先在助手区选定 A–E 版，再在此查看 12.1
            分镜表与 12.3 验收清单。
          </p>
          <ul className="space-y-2 text-sm">
            {versionKeys.map((k) => {
              const v = deliverable.storyboardVersions![k]!;
              return (
                <li key={k} className="rounded-lg border border-[#f0f0f2] px-3 py-2 text-[#1d1d1f]">
                  <span className="font-medium">{k}版</span>
                  {v.title ? `：${v.title}` : ""}
                  {v.summary ? (
                    <p className="mt-1 text-xs leading-relaxed text-[#86868b]">{v.summary}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </StepSection>
      ) : null}
    </div>
  );
}
