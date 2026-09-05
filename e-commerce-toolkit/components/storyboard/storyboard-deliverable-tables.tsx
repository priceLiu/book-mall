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
    <div className="space-y-2 text-sm text-[#1d1d1f]">
      <p>
        <span className="text-[#6e6e73]">人群钩子：</span>
        {brief.audienceHook}
      </p>
      <p>
        <span className="text-[#6e6e73]">爆款结构：</span>
        {brief.viralStructure}
      </p>
      <p>
        <span className="text-[#6e6e73]">情景扩展：</span>
        {brief.scenarioExpansion}
      </p>
    </div>
  );
}

export function StoryboardSellingPointsList({ sellpoints }: DeliverableSellingPointsProps) {
  return (
    <ul className="space-y-1.5 text-sm">
      {sellpoints.map((sp) => (
        <li key={sp.id} className="text-[#1d1d1f]">
          <span className="font-medium">{sp.text}</span>
          {sp.source === "inferred" ? (
            <span className="ml-2 rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] text-[#6e6e73]">
              AI 推导
            </span>
          ) : null}
          {sp.source === "painpoint" ? (
            <span className="ml-2 rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] text-[#6e6e73]">
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
        <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">表1 · 人群画像</h3>
        <EcomDataTable
          headers={["人群类型", "画像描述"]}
          rows={analysis.audience.map((r) => [r.segment, r.description])}
        />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">表2 · 三层痛点</h3>
        <EcomDataTable
          headers={["痛点层级", "具体描述"]}
          rows={analysis.painPoints.map((r) => [r.level, r.description])}
        />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">表3 · 爆款策略</h3>
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
    return <span className="text-sm text-[#86868b]">—</span>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e8e8ed]">
      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-[#1d1d1f] text-white">
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
            <tr key={`panel-${p.index}-${i}`} className="border-t border-[#e8e8ed] align-top">
              <td className="px-3 py-2 font-medium">{p.index}</td>
              <td className="px-3 py-2 text-[#6e6e73]">{formatPanelCellText(p.timeline)}</td>
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

export function StoryboardDeliverableSectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-semibold text-[#6e6e73]">{title}</h3>
      {children}
    </div>
  );
}
