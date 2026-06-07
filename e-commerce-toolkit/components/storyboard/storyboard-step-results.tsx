"use client";

import { Pencil } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { characterPresetLabelFromKey } from "@/lib/storyboard-character-presets";
import { resolveScenePresetByKey } from "@/lib/storyboard-scene-presets";
import type {
  StoryboardPanel,
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

function ScriptPanelsTable({
  panels,
  editable,
  onEditPanel,
}: {
  panels: StoryboardPanel[];
  editable?: boolean;
  onEditPanel?: (index: number) => void;
}) {
  if (panels.length === 0) return <Dash />;

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e8e8ed]">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-[#1d1d1f] text-white">
            <th className="px-3 py-2 font-medium">镜号</th>
            <th className="px-3 py-2 font-medium">时间轴</th>
            <th className="px-3 py-2 font-medium">景别</th>
            <th className="px-3 py-2 font-medium">画面内容</th>
            <th className="px-3 py-2 font-medium">口播台词</th>
            <th className="px-3 py-2 font-medium">运镜</th>
            <th className="px-3 py-2 font-medium">情绪</th>
            {editable ? <th className="px-3 py-2 font-medium">操作</th> : null}
          </tr>
        </thead>
        <tbody>
          {panels.map((p, i) => (
            <tr key={`panel-${p.index}-${i}`} className="border-t border-[#e8e8ed] align-top">
              <td className="px-3 py-2 font-medium">{p.index}</td>
              <td className="px-3 py-2 text-[#6e6e73]">{p.timeline?.trim() || "--"}</td>
              <td className="px-3 py-2">{p.shotType?.trim() || "--"}</td>
              <td className="px-3 py-2">
                {[p.scene, p.action].filter(Boolean).join(" · ") || "--"}
              </td>
              <td className="px-3 py-2">{p.dialogue?.trim() || "--"}</td>
              <td className="px-3 py-2">{p.camera?.trim() || "--"}</td>
              <td className="px-3 py-2">{p.emotion?.trim() || "--"}</td>
              {editable ? (
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-[#d2d2d7] px-2 py-1 text-[11px] text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3]"
                    onClick={() => onEditPanel?.(p.index)}
                  >
                    <Pencil className="h-3 w-3" />
                    修改
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function resolveFinalized(
  project: StoryboardProject,
): {
  scheme: StoryboardScheme | null;
  sheet: StoryboardSheet | null;
  markdown: string | null;
} {
  const schemes = project.meta?.deliverable?.schemes ?? [];
  const selectedIndex = project.meta?.selectedSchemeIndex ?? 0;
  const scheme = schemes[selectedIndex] ?? schemes[0] ?? null;
  const sheet = project.sheet;
  const markdown =
    !sheet && !scheme ? (project.meta?.deliverableMarkdown?.trim() || null) : null;
  return { scheme, sheet, markdown };
}

type Props = {
  project: StoryboardProject;
  references: StoryboardReference[];
  onPreviewImage?: (src: string, title: string) => void;
  /** 分镜图区块（卡片与操作） */
  imagesSlot?: ReactNode;
  /** 成片区块 */
  videoSlot?: ReactNode;
  /** 已定稿 sheet 时可编辑分镜脚本 */
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
  const deliverable = project.meta?.deliverable;
  const analysis = deliverable?.analysis;
  const wf = project.meta?.workflow ?? {};
  const { scheme, sheet, markdown } = resolveFinalized(project);

  const productRefs = references.filter((r) => r.role === "product");
  const characterRefs = references.filter((r) => r.role === "character");
  const otherRefs = references.filter((r) => r.role === "scene" || r.role === "other");

  const scriptPanels = sheet?.panels ?? scheme?.panels ?? [];
  const hasFinalizedPlan = Boolean(sheet || scheme || markdown);
  const productName = deliverable?.productName?.trim();
  const params = deliverable?.params ?? {};
  const paramEntries = Object.entries(params).filter(([, v]) => typeof v === "string" && v.trim());

  const schemeTitle = sheet?.overview.title ?? scheme?.title;
  const schemeSummary = sheet?.overview.logline ?? scheme?.summary;
  const schemeStrategy = scheme?.strategy;
  const productHighlight =
    sheet?.overview.productHighlight ??
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
        {analysis ? (
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
            {markdown ? (
              <div className="pt-4">
                <h4 className="mb-2 text-xs font-semibold text-[#6e6e73]">助手交付原文</h4>
                <StoryboardMarkdownBlock markdown={markdown} />
              </div>
            ) : null}
          </div>
        ) : (
          <Dash />
        )}
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
              <>
                <p className="text-sm text-[#1d1d1f]">自定义场景：{wf.scenePresetCustom}</p>
              </>
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
        <ScriptPanelsTable
          panels={scriptPanels}
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
