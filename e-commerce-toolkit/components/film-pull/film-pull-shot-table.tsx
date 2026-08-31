"use client";

import type { FilmPullShot } from "@/lib/film-pull-types";

type Props = {
  shots: FilmPullShot[];
  editable?: boolean;
  onChange?: (shots: FilmPullShot[]) => void;
};

export function FilmPullShotTable({ shots, editable, onChange }: Props) {
  const update = (index: number, field: keyof FilmPullShot, value: string) => {
    if (!editable || !onChange) return;
    const next = shots.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange(next);
  };

  return (
    <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-auto rounded-xl border border-[#e8e8ed] bg-white">
      <table className="min-w-[1200px] w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-[#1d1d1f] text-white">
          <tr>
            {[
              "镜号",
              "时段",
              "景别",
              "运镜",
              "机位",
              "主体调度",
              "场景",
              "布光",
              "台词",
              "aiVisualPrompt",
            ].map((h) => (
              <th key={h} className="border-b border-[#333] px-2 py-2 align-top font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shots.map((row, i) => (
            <tr key={row.shotNo} className="border-b border-[#e8e8ed] align-top">
              <td className="px-2 py-2">{row.shotNo}</td>
              <td className="px-2 py-2 whitespace-nowrap">
                {row.startTimeSec.toFixed(2)}–{row.endTimeSec.toFixed(2)}s
              </td>
              <td className="px-2 py-2">
                {editable ? (
                  <input
                    className="w-full rounded border border-[#d2d2d7] px-1 py-0.5"
                    value={row.shotScale}
                    onChange={(e) => update(i, "shotScale", e.target.value)}
                  />
                ) : (
                  row.shotScale
                )}
              </td>
              <td className="px-2 py-2">{row.cameraMovement}</td>
              <td className="px-2 py-2">{row.cameraAngle}</td>
              <td className="max-w-[160px] px-2 py-2">
                {editable ? (
                  <textarea
                    className="w-full rounded border border-[#d2d2d7] px-1 py-0.5"
                    rows={2}
                    value={row.subjectBlocking}
                    onChange={(e) => update(i, "subjectBlocking", e.target.value)}
                  />
                ) : (
                  row.subjectBlocking
                )}
              </td>
              <td className="max-w-[140px] px-2 py-2">{row.sceneEnvironment}</td>
              <td className="max-w-[120px] px-2 py-2">{row.lightingSetup}</td>
              <td className="max-w-[100px] px-2 py-2">{row.audioInfo.scriptSubtitle}</td>
              <td className="max-w-[220px] px-2 py-2 text-[#6e6e73]">{row.aiVisualPrompt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
