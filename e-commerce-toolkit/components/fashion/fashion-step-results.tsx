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
  isFashionStoryboardPanelsEditable,
  listFashionStoryboardVersionKeys,
  resolveFashionDeliverable,
  resolveFashionStoryboardPanelsForVersion,
} from "@/lib/fashion-workflow";
import type { FashionPanelRow, FashionSellpoint } from "@/lib/fashion-types";
import type { StoryboardProject } from "@/lib/storyboard-types";

function StepSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e8e8ed] bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-[#1d1d1f]">{title}</h2>
      {children}
    </section>
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
  const deliverable = resolveFashionDeliverable(project);
  if (!deliverable) {
    return (
      <div className="rounded-xl border border-dashed border-[#e8e8ed] bg-white p-8 text-center text-sm text-[#86868b]">
        完成右侧交互后，参数档案、卖点、口播与分镜表将在此实时展示。
      </div>
    );
  }

  const awaitingVersionPick = isAwaitingFashionStoryboardPick(project);
  const versionKeys = listFashionStoryboardVersionKeys(deliverable);
  const versionKey = deliverable.selectedVersion ?? null;
  const resolvedPanels =
    versionKey != null
      ? resolveFashionStoryboardPanelsForVersion(project, versionKey, deliverable)
      : undefined;
  const versionMeta = versionKey ? deliverable.storyboardVersions?.[versionKey] : undefined;
  const panels =
    resolvedPanels ??
    versionMeta?.panels ??
    [];
  const version =
    versionKey && (panels.length > 0 || versionMeta?.title || versionMeta?.summary)
      ? { ...versionMeta, id: versionKey, title: versionMeta?.title, panels }
      : versionMeta;
  const selectedVoiceover = deliverable.voiceovers.find(
    (v) => v.id === deliverable.selectedVoiceoverId,
  );
  const panelsEditable = isFashionStoryboardPanelsEditable(project);
  const inDirectVideoProduce = deliverable.outputMode === "direct_video";
  const inProduce = Boolean(deliverable.outputMode);

  const panelsTableSection =
    panels.length > 0 && deliverable.selectedVersion ? (
      <StepSection
        title={`12.1 · 分镜脚本表${versionKey ? `（${versionKey}版${deliverable.storyboardLocked ? " · 已定稿" : ""}）` : ""}`}
      >
        {panelsEditable ? (
          <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
            可直接修改各镜字段，保存后继续；定稿请在右侧助手点击「确认分镜，生成运营包」。
          </p>
        ) : deliverable.storyboardLocked && inProduce && inDirectVideoProduce ? (
          <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
            分镜已定稿；本表仅供查阅，主编辑与成片请在上方「故事版 · 成片工作区」进行。
          </p>
        ) : deliverable.storyboardLocked ? (
          <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
            分镜已定稿，如需修改请返回重新选版（运营包生成前）。
          </p>
        ) : null}
        <FashionPanelsTable
          panels={panels}
          sellpoints={deliverable.sellpoints}
          editable={panelsEditable && Boolean(onSavePanels)}
          saving={panelsSaving}
          onSavePanels={onSavePanels}
        />
      </StepSection>
    ) : null;

  const archiveSections = (
    <>
      <StepSection title="产品参数档案">
        <FashionParamsTable dimensions={deliverable.dimensions} />
      </StepSection>

      {deliverable.sellpoints.length > 0 ? (
        <StepSection
          title={deliverable.sellpointsLocked ? "定稿卖点清单" : "卖点清单（确认前可编辑）"}
        >
          {!deliverable.sellpointsLocked ? (
            <p className="mb-3 text-xs leading-relaxed text-[#6e6e73]">
              可直接修改卖点文案与分层，保存后继续；定稿请在右侧助手点击「确认卖点清单」。
            </p>
          ) : null}
          <FashionSellpointsTable
            sellpoints={deliverable.sellpoints}
            editable={!deliverable.sellpointsLocked && Boolean(onSaveSellpoints)}
            saving={sellpointsSaving}
            onSaveSellpoints={onSaveSellpoints}
          />
        </StepSection>
      ) : null}

      {deliverable.sellpointsLocked && deliverable.voiceovers.length > 0 ? (
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
      ) : null}

      {(inProduce && inDirectVideoProduce) || !inDirectVideoProduce
        ? panelsTableSection
        : null}

      {panels.length > 0 && deliverable.selectedVersion && deliverable.sellpoints.length && !inDirectVideoProduce ? (
        <StepSection title="12.3 · 卖点覆盖率验收清单">
          <FashionCoverageTable sellpoints={deliverable.sellpoints} panels={panels} />
        </StepSection>
      ) : null}

      {deliverable.opsPack ? (
        <StepSection title="运营素材包">
          <FashionOpsPackBlock ops={deliverable.opsPack} />
        </StepSection>
      ) : null}
    </>
  );

  if (inProduce) {
    return (
      <div className="space-y-4">
        <StepSection title="成片制作（当前步骤）">
          <p className="text-sm text-[#1d1d1f]">
            {deliverable.outputMode === "script_compose"
              ? "路径 A：分镜脚本交付 — 生成各镜分镜图后可导出 HTML/ZIP 自行剪辑。"
              : "路径 B：故事版一键成片 — 在下方故事版工作区生图，完成后合成视频。"}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#86868b]">
            七维 → 卖点 → 口播 → 分镜 → 运营包 已全部完成；策划交付物见本页下方「查阅区」。
          </p>
        </StepSection>

        {inDirectVideoProduce ? (
          <>
            <StepSection title="故事版 · 成片工作区">
              {produceWorkspace ?? (
                <p className="text-sm text-[#86868b]">
                  正在同步故事版…若长时间无内容，请点工作区内的「重新同步故事版」。
                </p>
              )}
            </StepSection>
            <StepSection title="各镜头分镜图与单镜视频">
              {imagesSlot ?? <span className="text-sm text-[#86868b]">—</span>}
            </StepSection>
            <StepSection title="成片">
              {videoSlot ?? <span className="text-sm text-[#86868b]">分镜图就绪后可在此合成视频</span>}
            </StepSection>
          </>
        ) : (
          <>
            {panelsTableSection}
            <StepSection title="分镜图">
              {imagesSlot ?? <span className="text-sm text-[#86868b]">—</span>}
            </StepSection>
          </>
        )}

        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[#86868b]">策划交付物（查阅）</h2>
          {archiveSections}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {archiveSections}

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
