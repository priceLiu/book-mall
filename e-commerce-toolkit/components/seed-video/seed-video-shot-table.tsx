"use client";

import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import type { SeedVideoReference, SeedVideoShot } from "@/lib/seed-video-types";

type Props = {
  shots: SeedVideoShot[];
  references: SeedVideoReference[];
  onChange: (shots: SeedVideoShot[]) => void;
  disabled?: boolean;
  generatingIndex?: number | null;
  generatingIndices?: ReadonlySet<number>;
  onPreviewVideo?: (src: string, title?: string) => void;
  /** 单次成片：只展示脚本表，不展示逐镜视频格 */
  hideVideoColumn?: boolean;
  hideStatusColumn?: boolean;
};

export function SeedVideoShotTable({
  shots,
  references,
  onChange,
  disabled,
  generatingIndex = null,
  generatingIndices,
  onPreviewVideo,
  hideVideoColumn = false,
  hideStatusColumn = false,
}: Props) {
  function patchShot(index: number, patch: Partial<SeedVideoShot>) {
    onChange(shots.map((s) => (s.index === index ? { ...s, ...patch } : s)));
  }

  function refUrl(refImageId: string): string | undefined {
    return references.find((r) => r.id === refImageId)?.ossUrl;
  }

  function isShotGenerating(index: number): boolean {
    if (generatingIndices?.has(index)) return true;
    return generatingIndex === index;
  }

  function shotStatus(shot: SeedVideoShot): { label: string; className: string } {
    if (isShotGenerating(shot.index)) {
      return { label: "生成中", className: "text-[#0071e3]" };
    }
    if (shot.videoUrl && shot.ttsUrl) {
      return { label: "就绪", className: "text-[#34c759]" };
    }
    if (shot.videoUrl) {
      return { label: "视频 OK", className: "text-[#1d1d1f]" };
    }
    if (shot.ttsUrl) {
      return { label: "TTS OK", className: "text-[#6e6e73]" };
    }
    return { label: "待生成", className: "text-[#86868b]" };
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e8e8ed]">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[#f5f5f7] text-[#6e6e73]">
          <tr>
            <th className="px-3 py-2 font-medium">镜号</th>
            <th className="px-3 py-2 font-medium">时间</th>
            <th className="px-3 py-2 font-medium">参考图</th>
            {!hideVideoColumn ? (
              <th className="px-3 py-2 font-medium w-[108px]">镜头视频</th>
            ) : null}
            <th className="px-3 py-2 font-medium min-w-[120px]">画面描述</th>
            <th className="px-3 py-2 font-medium min-w-[180px]">视频 Prompt</th>
            <th className="px-3 py-2 font-medium min-w-[140px]">口播</th>
            {!hideStatusColumn ? <th className="px-3 py-2 font-medium">状态</th> : null}
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => {
            const thumb = refUrl(shot.refImageId);
            const status = shotStatus(shot);
            const isGenerating = isShotGenerating(shot.index);
            return (
              <tr key={shot.index} className="border-t border-[#e8e8ed] align-top">
                <td className="px-3 py-2 font-medium text-[#1d1d1f]">{shot.index}</td>
                <td className="px-3 py-2 text-[#6e6e73]">{shot.timeSlice}</td>
                <td className="px-3 py-2">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={shot.refImageLabel}
                      className="h-12 w-12 rounded-lg border border-[#e8e8ed] object-cover"
                    />
                  ) : (
                    <span className="text-[#86868b]">{shot.refImageLabel || "—"}</span>
                  )}
                </td>
                {!hideVideoColumn ? (
                  <td className="px-3 py-2">
                    <EcomVideoSlot
                      src={shot.videoUrl}
                      aspectRatio="9:16"
                      compact
                      generating={isGenerating}
                      emptyLabel="待生成"
                      playSize="sm"
                      onPreview={
                        shot.videoUrl
                          ? () => onPreviewVideo?.(shot.videoUrl!, `镜 ${shot.index}`)
                          : undefined
                      }
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <textarea
                    className="ecom-scrollbar-thin w-full min-h-[4rem] resize-y rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                    value={shot.sceneDescription}
                    disabled={disabled}
                    onChange={(e) => patchShot(shot.index, { sceneDescription: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <textarea
                    className="ecom-scrollbar-thin w-full min-h-[4rem] resize-y rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                    value={shot.videoPrompt}
                    disabled={disabled}
                    onChange={(e) => patchShot(shot.index, { videoPrompt: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <textarea
                    className="ecom-scrollbar-thin w-full min-h-[4rem] resize-y rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none disabled:opacity-50"
                    value={shot.voiceover}
                    disabled={disabled}
                    onChange={(e) => patchShot(shot.index, { voiceover: e.target.value })}
                  />
                </td>
                {!hideStatusColumn ? (
                  <td className={`px-3 py-2 ${status.className}`}>{status.label}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
