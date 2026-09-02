"use client";

import type { ReactNode } from "react";

import {
  ecomDataTableBodyRowClass,
  ecomDataTableClass,
  ecomDataTableHeadRowClass,
  ecomDataTableTdClass,
  ecomDataTableThClass,
  ecomDataTableWrapClass,
} from "@/components/ui/ecom-data-table";
import type { MediaDecomposePatch } from "@/lib/media-decompose-types";

type Props = {
  structured: MediaDecomposePatch;
};

export function MediaDecomposeResultPanel({ structured }: Props) {
  if (structured.mediaType === "video") {
    return (
      <div className="space-y-4">
        <div className={ecomDataTableWrapClass}>
          <table className={`min-w-full ${ecomDataTableClass}`}>
            <thead>
              <tr className={ecomDataTableHeadRowClass}>
                {[
                  "镜号",
                  "时长",
                  "景别",
                  "运镜",
                  "镜头角度",
                  "构图",
                  "画面内容",
                  "人物动作",
                  "表情",
                  "字幕",
                  "口播",
                  "音效",
                  "BGM",
                  "转场",
                  "剪辑节奏",
                ].map((h) => (
                  <th key={h} className={`whitespace-nowrap ${ecomDataTableThClass}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {structured.storyboardTable.map((row) => (
                <tr key={row.shotNo} className={ecomDataTableBodyRowClass}>
                  <td className={ecomDataTableTdClass}>{row.shotNo}</td>
                  <td className={ecomDataTableTdClass}>{row.duration}</td>
                  <td className={ecomDataTableTdClass}>{row.shotSize}</td>
                  <td className={ecomDataTableTdClass}>{row.cameraMove}</td>
                  <td className={ecomDataTableTdClass}>{row.cameraAngle}</td>
                  <td className={ecomDataTableTdClass}>{row.composition}</td>
                  <td className={ecomDataTableTdClass}>{row.visualContent}</td>
                  <td className={ecomDataTableTdClass}>{row.characterAction}</td>
                  <td className={ecomDataTableTdClass}>{row.expression}</td>
                  <td className={ecomDataTableTdClass}>{row.subtitle}</td>
                  <td className={ecomDataTableTdClass}>
                    {row.voiceover.trim() || row.subtitle.trim() || "—"}
                  </td>
                  <td className={ecomDataTableTdClass}>{row.sfx}</td>
                  <td className={ecomDataTableTdClass}>{row.bgm}</td>
                  <td className={ecomDataTableTdClass}>{row.transition}</td>
                  <td className={ecomDataTableTdClass}>{row.editRhythm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Section title="整体叙事逻辑">{structured.narrativeLogic}</Section>
        <Section title="镜头卡点要点">{structured.beatPoints}</Section>
        <Section title="可复刻拍摄脚本">{structured.replicableShootingScript}</Section>
      </div>
    );
  }

  const e = structured.elements;
  const l = e.lighting;
  return (
    <div className="space-y-4 text-sm text-[#1d1d1f]">
      <Section title="画面要素">
        <ul className="list-inside list-disc space-y-1 text-[#424245]">
          <li>主体：{e.subject}</li>
          <li>姿态：{e.subjectPose}</li>
          <li>场景：{e.sceneEnvironment}</li>
          <li>透视：{e.spatialPerspective}</li>
          <li>构图：{e.composition}</li>
          <li>等效焦距：{e.equivalentFocalLength}</li>
          <li>拍摄角度：{e.shootingAngle}</li>
          <li>
            布光：主 {l.keyLight}；辅 {l.fillLight}；轮廓 {l.rimLight}；环境 {l.ambientLight}；方向{" "}
            {l.direction}；{l.hardSoft}；色温 {l.colorTemperature}
          </li>
          <li>材质：{e.materialTexture}</li>
          <li>色彩：{e.colorSystem}</li>
          <li>氛围：{e.atmosphere}</li>
          <li>细节：{e.detailNotes}</li>
        </ul>
      </Section>
      <CopyBlock title="正向生图 Prompt" text={structured.positivePrompt} />
      <CopyBlock title="反向负面 Prompt" text={structured.negativePrompt} />
      <Section title="实拍复刻方案">
        <ul className="list-inside list-disc space-y-1 text-[#424245]">
          <li>机位：{structured.liveActionReplication.cameraPlacement}</li>
          <li>灯光：{structured.liveActionReplication.lightingSetup}</li>
          <li>道具：{structured.liveActionReplication.props}</li>
          <li>相机参数：{structured.liveActionReplication.cameraParams}</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-[#1d1d1f]">{title}</h3>
      <div className="whitespace-pre-wrap rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3 text-sm text-[#424245]">
        {children}
      </div>
    </div>
  );
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#1d1d1f]">{title}</h3>
        <button
          type="button"
          className="text-xs text-[#0071e3] hover:underline"
          onClick={() => void navigator.clipboard.writeText(text)}
        >
          复制
        </button>
      </div>
      <pre className="whitespace-pre-wrap rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3 text-xs text-[#424245]">
        {text}
      </pre>
    </div>
  );
}
