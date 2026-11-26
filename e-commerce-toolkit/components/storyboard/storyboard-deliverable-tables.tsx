"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { EcomDataTable } from "@/components/ui/ecom-data-table";
import {
  formatPanelCellText,
  formatProductInteractionLabel,
  resolveSellpointTexts,
  type AnalysisTablesProps,
  type CreativeBriefProps,
  type DeliverableSellingPointsProps,
  type SchemePanelsTableProps,
} from "@/lib/storyboard-deliverable-labels";

export function StoryboardCreativeBrief({ brief }: CreativeBriefProps) {
  return (
    <div className="space-y-2 text-sm text-[var(--ecom-ink)]">
      <p>
        <span className="text-[var(--ecom-muted)]">人群钩子：</span>
        {brief.audienceHook}
      </p>
      <p>
        <span className="text-[var(--ecom-muted)]">爆款结构：</span>
        {brief.viralStructure}
      </p>
      <p>
        <span className="text-[var(--ecom-muted)]">情景扩展：</span>
        {brief.scenarioExpansion}
      </p>
    </div>
  );
}

export function StoryboardSellingPointsList({ sellpoints }: DeliverableSellingPointsProps) {
  return (
    <ul className="space-y-1.5 text-sm">
      {sellpoints.map((sp) => (
        <li key={sp.id} className="text-[var(--ecom-ink)]">
          <span className="font-medium">{sp.text}</span>
          {sp.source === "inferred" ? (
            <span className="ml-2 rounded bg-[var(--ecom-parchment)] px-1.5 py-0.5 text-[10px] text-[var(--ecom-muted)]">
              AI 推导
            </span>
          ) : null}
          {sp.source === "painpoint" ? (
            <span className="ml-2 rounded bg-[var(--ecom-parchment)] px-1.5 py-0.5 text-[10px] text-[var(--ecom-muted)]">
              痛点映射
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function StoryboardAnalysisTables({ analysis }: AnalysisTablesProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--ecom-muted)]">表1 · 人群画像</h3>
        <EcomDataTable
          headers={["人群类型", "画像描述"]}
          rows={analysis.audience.map((r) => [r.segment, r.description])}
        />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--ecom-muted)]">表2 · 三层痛点</h3>
        <EcomDataTable
          headers={["痛点层级", "具体描述"]}
          rows={analysis.painPoints.map((r) => [r.level, r.description])}
        />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--ecom-muted)]">表3 · 爆款策略</h3>
        <EcomDataTable
          headers={["策略", "3秒钩子", "中段承接", "结尾话术"]}
          rows={analysis.strategies.map((r) => [
            r.name,
            r.hook3s,
            r.middle,
            r.closing,
          ])}
        />
      </div>
    </div>
  );
}

export function StoryboardSchemePanelsTable({
  panels,
  sellpoints,
  editable,
  onEditPanel,
}: SchemePanelsTableProps) {
  if (panels.length === 0) {
    return <span className="text-sm text-[var(--ecom-subtle)]">—</span>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--ecom-divider)]">
      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-[var(--ecom-ink)] text-white">
            <th className="px-3 py-2 font-medium">镜号</th>
            <th className="px-3 py-2 font-medium">时间轴</th>
            <th className="px-3 py-2 font-medium">景别</th>
            <th className="px-3 py-2 font-medium">场景</th>
            <th className="px-3 py-2 font-medium">场景Prompt</th>
            <th className="px-3 py-2 font-medium">动作</th>
            <th className="px-3 py-2 font-medium">产品交互</th>
            <th className="px-3 py-2 font-medium">卖点</th>
            <th className="px-3 py-2 font-medium">口播</th>
            <th className="px-3 py-2 font-medium">运镜</th>
            <th className="px-3 py-2 font-medium">情绪</th>
            {editable ? <th className="px-3 py-2 font-medium">操作</th> : null}
          </tr>
        </thead>
        <tbody>
          {panels.map((p, i) => (
            <tr key={`panel-${p.index}-${i}`} className="border-t border-[var(--ecom-divider)] align-top">
              <td className="px-3 py-2 font-medium">{p.index}</td>
              <td className="px-3 py-2 text-[var(--ecom-muted)]">{formatPanelCellText(p.timeline)}</td>
              <td className="px-3 py-2">{formatPanelCellText(p.shotType)}</td>
              <td className="px-3 py-2">{formatPanelCellText(p.scene)}</td>
              <td className="px-3 py-2 max-w-[10rem]">{formatPanelCellText(p.scenePrompt)}</td>
              <td className="px-3 py-2">{formatPanelCellText(p.action)}</td>
              <td className="px-3 py-2">
                {formatProductInteractionLabel(p.productInteraction)}
              </td>
              <td className="px-3 py-2">
                {resolveSellpointTexts(p.sellpointTags, sellpoints)}
              </td>
              <td className="px-3 py-2">{formatPanelCellText(p.dialogue)}</td>
              <td className="px-3 py-2">{formatPanelCellText(p.camera)}</td>
              <td className="px-3 py-2">{formatPanelCellText(p.emotion)}</td>
              {editable ? (
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--ecom-border-soft)] px-2 py-1 text-[11px] text-[var(--ecom-ink)] hover:border-[var(--ecom-outline-border)] hover:text-[var(--ecom-primary)]"
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

export function StoryboardDeliverableSectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-semibold text-[var(--ecom-muted)]">{title}</h3>
      {children}
    </div>
  );
}
