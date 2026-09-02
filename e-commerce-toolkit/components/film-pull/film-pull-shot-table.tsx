"use client";

import {
  ecomDataTableBodyRowClass,
  ecomDataTableClass,
  ecomDataTableHeadRowClass,
  ecomDataTableTdClass,
  ecomDataTableThClass,
  ecomDataTableWrapClass,
} from "@/components/ui/ecom-data-table";
import type { FilmPullShot } from "@/lib/film-pull-types";
import { cn } from "@/lib/utils";

type Props = {
  shots: FilmPullShot[];
  editable?: boolean;
  onChange?: (shots: FilmPullShot[]) => void;
  /** 嵌入结果卡片内（只读 · 与拆图拆视频数据表一致） */
  embedded?: boolean;
  /** 不可编辑列（默认仅镜号） */
  readOnlyKeys?: string[];
};

export type FilmPullShotColumnDef = {
  key: string;
  label: string;
  minW: string;
  multiline?: boolean;
  get: (row: FilmPullShot) => string;
  set?: (row: FilmPullShot, value: string) => FilmPullShot;
};

export const FILM_PULL_SHOT_TABLE_COLUMNS: FilmPullShotColumnDef[] = [
  { key: "shotNo", label: "镜号", minW: "min-w-[44px]", get: (r) => String(r.shotNo) },
  {
    key: "startTimeSec",
    label: "入点(s)",
    minW: "min-w-[64px]",
    get: (r) => r.startTimeSec.toFixed(2),
    set: (r, v) => ({ ...r, startTimeSec: Number(v) || r.startTimeSec }),
  },
  {
    key: "endTimeSec",
    label: "出点(s)",
    minW: "min-w-[64px]",
    get: (r) => r.endTimeSec.toFixed(2),
    set: (r, v) => ({ ...r, endTimeSec: Number(v) || r.endTimeSec }),
  },
  {
    key: "durationSec",
    label: "时长(s)",
    minW: "min-w-[56px]",
    get: (r) => r.durationSec.toFixed(2),
    set: (r, v) => ({ ...r, durationSec: Number(v) || r.durationSec }),
  },
  {
    key: "cutTransition",
    label: "转场",
    minW: "min-w-[72px]",
    get: (r) => r.cutTransition,
    set: (r, v) => ({ ...r, cutTransition: v }),
  },
  {
    key: "cutDetail",
    label: "切点说明",
    minW: "min-w-[120px]",
    multiline: true,
    get: (r) => r.cutDetail,
    set: (r, v) => ({ ...r, cutDetail: v }),
  },
  {
    key: "shotScale",
    label: "景别",
    minW: "min-w-[72px]",
    get: (r) => r.shotScale,
    set: (r, v) => ({ ...r, shotScale: v }),
  },
  {
    key: "cameraAngle",
    label: "机位",
    minW: "min-w-[72px]",
    get: (r) => r.cameraAngle,
    set: (r, v) => ({ ...r, cameraAngle: v }),
  },
  {
    key: "cameraMovement",
    label: "运镜",
    minW: "min-w-[88px]",
    get: (r) => r.cameraMovement,
    set: (r, v) => ({ ...r, cameraMovement: v }),
  },
  {
    key: "focalLengthPerspective",
    label: "焦距透视",
    minW: "min-w-[88px]",
    get: (r) => r.focalLengthPerspective,
    set: (r, v) => ({ ...r, focalLengthPerspective: v }),
  },
  {
    key: "composition",
    label: "构图",
    minW: "min-w-[100px]",
    multiline: true,
    get: (r) => r.composition,
    set: (r, v) => ({ ...r, composition: v }),
  },
  {
    key: "subjectBlocking",
    label: "主体调度",
    minW: "min-w-[140px]",
    multiline: true,
    get: (r) => r.subjectBlocking,
    set: (r, v) => ({ ...r, subjectBlocking: v }),
  },
  {
    key: "sightDirection",
    label: "视线方向",
    minW: "min-w-[88px]",
    get: (r) => r.sightDirection,
    set: (r, v) => ({ ...r, sightDirection: v }),
  },
  {
    key: "sceneEnvironment",
    label: "场景环境",
    minW: "min-w-[120px]",
    multiline: true,
    get: (r) => r.sceneEnvironment,
    set: (r, v) => ({ ...r, sceneEnvironment: v }),
  },
  {
    key: "foreMidBackLayer",
    label: "前中后景",
    minW: "min-w-[120px]",
    multiline: true,
    get: (r) => r.foreMidBackLayer,
    set: (r, v) => ({ ...r, foreMidBackLayer: v }),
  },
  {
    key: "dynamicProps",
    label: "动态道具",
    minW: "min-w-[88px]",
    get: (r) => r.dynamicProps,
    set: (r, v) => ({ ...r, dynamicProps: v }),
  },
  {
    key: "lightingSetup",
    label: "布光",
    minW: "min-w-[100px]",
    multiline: true,
    get: (r) => r.lightingSetup,
    set: (r, v) => ({ ...r, lightingSetup: v }),
  },
  {
    key: "toneContrast",
    label: "影调对比",
    minW: "min-w-[88px]",
    get: (r) => r.toneContrast,
    set: (r, v) => ({ ...r, toneContrast: v }),
  },
  {
    key: "narrativeFunction",
    label: "叙事功能",
    minW: "min-w-[100px]",
    multiline: true,
    get: (r) => r.narrativeFunction,
    set: (r, v) => ({ ...r, narrativeFunction: v }),
  },
  {
    key: "scriptSubtitle",
    label: "台词",
    minW: "min-w-[100px]",
    multiline: true,
    get: (r) => r.audioInfo.scriptSubtitle,
    set: (r, v) => ({ ...r, audioInfo: { ...r.audioInfo, scriptSubtitle: v } }),
  },
  {
    key: "vocalEmotion",
    label: "人声情绪",
    minW: "min-w-[88px]",
    get: (r) => r.audioInfo.vocalEmotion,
    set: (r, v) => ({ ...r, audioInfo: { ...r.audioInfo, vocalEmotion: v } }),
  },
  {
    key: "ambientSound",
    label: "环境声",
    minW: "min-w-[88px]",
    get: (r) => r.audioInfo.ambientSound,
    set: (r, v) => ({ ...r, audioInfo: { ...r.audioInfo, ambientSound: v } }),
  },
  {
    key: "fxAndBgm",
    label: "音效/BGM",
    minW: "min-w-[88px]",
    get: (r) => r.audioInfo.fxAndBgm,
    set: (r, v) => ({ ...r, audioInfo: { ...r.audioInfo, fxAndBgm: v } }),
  },
  {
    key: "rhythmWeight",
    label: "节奏权重",
    minW: "min-w-[72px]",
    get: (r) => r.rhythmWeight,
    set: (r, v) => ({ ...r, rhythmWeight: v }),
  },
  {
    key: "visualMetaphor",
    label: "视觉隐喻",
    minW: "min-w-[100px]",
    multiline: true,
    get: (r) => r.visualMetaphor,
    set: (r, v) => ({ ...r, visualMetaphor: v }),
  },
  {
    key: "aiVisualPrompt",
    label: "aiVisualPrompt",
    minW: "min-w-[200px]",
    multiline: true,
    get: (r) => r.aiVisualPrompt,
    set: (r, v) => ({ ...r, aiVisualPrompt: v }),
  },
];

function CellEditor({
  value,
  multiline,
  editable,
  onChange,
}: {
  value: string;
  multiline?: boolean;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  if (!editable) {
    const text = value?.trim() ? value : "--";
    return <span className="block whitespace-pre-wrap break-words">{text}</span>;
  }
  const className =
    "w-full rounded border border-[#d2d2d7] px-1.5 py-1 text-xs outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/20";
  if (multiline) {
    return (
      <textarea className={className} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  return <input className={className} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function FilmPullShotTable({
  shots,
  editable,
  onChange,
  embedded,
  readOnlyKeys = ["shotNo"],
}: Props) {
  const readOnly = !editable;
  const readOnlySet = new Set(readOnlyKeys);
  const updateCell = (rowIndex: number, col: FilmPullShotColumnDef, value: string) => {
    if (!editable || !onChange || !col.set) return;
    const next = shots.map((s, i) => (i === rowIndex ? col.set!(s, value) : s));
    onChange(next);
  };

  const wrapClass = embedded && readOnly ? ecomDataTableWrapClass : "overflow-x-auto rounded-lg border border-[#e8e8ed]";
  const tableClass = cn("min-w-[3200px] w-full", embedded && readOnly ? ecomDataTableClass : "border-collapse text-left text-xs");
  const headRowClass =
    embedded && readOnly
      ? ecomDataTableHeadRowClass
      : embedded
        ? "bg-[#f5f5f7] text-[#6e6e73]"
        : "sticky top-0 z-10 bg-[#1d1d1f] text-white";
  const thClass = embedded && readOnly ? cn("whitespace-nowrap", ecomDataTableThClass) : "border-b border-[#e8e8ed] px-2 py-2 align-top font-medium whitespace-nowrap";
  const bodyRowClass = embedded && readOnly ? ecomDataTableBodyRowClass : "border-b border-[#e8e8ed] align-top";
  const tdClass = embedded && readOnly ? ecomDataTableTdClass : "px-2 py-2 align-top";

  return (
    <div className={wrapClass}>
      <table className={tableClass}>
        <thead>
          <tr className={headRowClass}>
            {FILM_PULL_SHOT_TABLE_COLUMNS.map((col) => (
              <th key={col.key} className={cn(thClass, col.minW)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shots.map((row, rowIndex) => (
            <tr key={`${row.shotNo}-${rowIndex}`} className={bodyRowClass}>
              {FILM_PULL_SHOT_TABLE_COLUMNS.map((col) => {
                const value = col.get(row);
                const canEdit = Boolean(editable && col.set && !readOnlySet.has(col.key));
                return (
                  <td
                    key={col.key}
                    className={cn(tdClass, col.minW, col.key === "shotNo" && readOnly && "font-medium")}
                  >
                    <CellEditor
                      value={value}
                      multiline={col.multiline}
                      editable={canEdit}
                      onChange={(v) => updateCell(rowIndex, col, v)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
