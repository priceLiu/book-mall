"use client";

import {
  SEED_VIDEO_FORMAL_SCRIPT_TABLE_HEADERS,
  type SeedVideoStoryboardDraftRow,
} from "@/lib/seed-video-storyboard-parse";
import { cn } from "@/lib/utils";

type Props = {
  rows: SeedVideoStoryboardDraftRow[];
  onChange: (rows: SeedVideoStoryboardDraftRow[]) => void;
  disabled?: boolean;
};

export function SeedVideoStoryboardDraftEditor({ rows, onChange, disabled }: Props) {
  function patchRow(index: number, patch: Partial<SeedVideoStoryboardDraftRow>) {
    onChange(rows.map((r) => (r.index === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e8e8ed]">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[#f5f5f7] text-[#6e6e73]">
          <tr>
            {SEED_VIDEO_FORMAL_SCRIPT_TABLE_HEADERS.map((label) => (
              <th
                key={label}
                className={cn(
                  "px-3 py-2 font-medium",
                  label === "参考素材" && "min-w-[88px]",
                  label === "画面设计" && "min-w-[160px]",
                  label === "口播文案" && "min-w-[140px]",
                  label === "AI视频生成提示词" && "min-w-[180px]",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.index} className="border-t border-[#e8e8ed] align-top">
              <td className="px-3 py-2 font-medium text-[#1d1d1f]">{row.index}</td>
              <td className="px-3 py-2">
                <input
                  className="w-full min-w-[4.5rem] rounded-lg border border-[#e8e8ed] px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                  value={row.duration}
                  disabled={disabled}
                  onChange={(e) => patchRow(row.index, { duration: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  className="w-full min-w-[5rem] rounded-lg border border-[#e8e8ed] px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                  value={row.refLabel}
                  disabled={disabled}
                  onChange={(e) => patchRow(row.index, { refLabel: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <textarea
                  className="ecom-scrollbar-thin min-h-[3.5rem] w-full resize-y rounded-lg border border-[#e8e8ed] px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                  value={row.cameraMove}
                  disabled={disabled}
                  placeholder="推镜、慢动作、特写…"
                  onChange={(e) => patchRow(row.index, { cameraMove: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <textarea
                  className="ecom-scrollbar-thin min-h-[3.5rem] w-full resize-y rounded-lg border border-[#e8e8ed] px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                  value={row.sceneDescription}
                  disabled={disabled}
                  onChange={(e) => patchRow(row.index, { sceneDescription: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <textarea
                  className="ecom-scrollbar-thin min-h-[3.5rem] w-full resize-y rounded-lg border border-[#e8e8ed] px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                  value={row.voiceover}
                  disabled={disabled}
                  onChange={(e) => patchRow(row.index, { voiceover: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <textarea
                  className="ecom-scrollbar-thin min-h-[4rem] w-full resize-y rounded-lg border border-[#e8e8ed] px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                  value={row.aiPrompt}
                  disabled={disabled}
                  placeholder="留空则根据画面描述自动生成"
                  onChange={(e) => patchRow(row.index, { aiPrompt: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
