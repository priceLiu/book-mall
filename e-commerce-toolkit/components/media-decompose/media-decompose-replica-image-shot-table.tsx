"use client";

import Image from "next/image";
import { ImageIcon, Loader2, Sparkles } from "lucide-react";

import { EcomPromptMentionRefBar } from "@/components/media/ecom-prompt-mention-ref-bar";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { SeedVideoShot } from "@/lib/seed-video-types";
import { cn } from "@/lib/utils";

type Props = {
  shots: SeedVideoShot[];
  onChange: (shots: SeedVideoShot[]) => void;
  disabled?: boolean;
  mentionRefs?: EcomPromptImageRef[];
  generatingImageIndices?: ReadonlySet<number>;
  generatingVideoIndices?: ReadonlySet<number>;
  onPreviewVideo?: (src: string, title?: string) => void;
  onPreviewImage?: (src: string, title: string) => void;
  onGenerateImage?: (shotIndex: number) => void;
  onGenerateVideo?: (shotIndex: number) => void;
};

export function MediaDecomposeReplicaImageShotTable({
  shots,
  onChange,
  disabled,
  mentionRefs,
  generatingImageIndices,
  generatingVideoIndices,
  onPreviewVideo,
  onPreviewImage,
  onGenerateImage,
  onGenerateVideo,
}: Props) {
  function patchShot(index: number, patch: Partial<SeedVideoShot>) {
    onChange(shots.map((s) => (s.index === index ? { ...s, ...patch } : s)));
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e8e8ed]">
      {mentionRefs && mentionRefs.length > 0 ? (
        <div className="border-b border-[#e8e8ed] bg-[#fafafa] px-3 py-2.5">
          <EcomPromptMentionRefBar refs={mentionRefs} onPreviewImage={onPreviewImage} />
        </div>
      ) : null}

      <div className="divide-y divide-[#e8e8ed]">
        {shots.map((shot) => {
          const imageBusy = generatingImageIndices?.has(shot.index) ?? false;
          const videoBusy = generatingVideoIndices?.has(shot.index) ?? false;
          const rowDisabled = disabled || imageBusy || videoBusy;

          return (
            <section key={shot.index} className="bg-white p-3">
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#1d1d1f]">镜 {shot.index}</span>
                <span className="text-[11px] text-[#6e6e73]">{shot.timeSlice}</span>
                {shot.sceneDescription?.trim() ? (
                  <span className="text-[11px] text-[#6e6e73]">· {shot.sceneDescription}</span>
                ) : null}
              </header>

              <div className="grid gap-3 lg:grid-cols-[7.5rem_minmax(0,1fr)_auto] lg:items-start">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
                    分镜图
                  </p>
                  <button
                    type="button"
                    className={cn(
                      "relative block h-[8.5rem] w-[7.5rem] overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]",
                      shot.imageUrl?.trim() && !imageBusy && "cursor-zoom-in",
                    )}
                    disabled={!shot.imageUrl?.trim() || imageBusy}
                    onClick={() => {
                      if (shot.imageUrl?.trim()) {
                        onPreviewImage?.(shot.imageUrl, `镜 ${shot.index} · 分镜图`);
                      }
                    }}
                  >
                    {shot.imageUrl?.trim() ? (
                      <Image
                        src={shot.imageUrl}
                        alt={`镜 ${shot.index} 分镜图`}
                        fill
                        className={cn("object-cover", imageBusy && "opacity-40")}
                        unoptimized
                      />
                    ) : !imageBusy ? (
                      <span className="flex h-full flex-col items-center justify-center gap-1 text-[#86868b]">
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[10px]">待生图</span>
                      </span>
                    ) : null}
                    {imageBusy ? (
                      <EcomMediaGeneratingBusy className="absolute inset-0 h-full w-full" />
                    ) : null}
                  </button>
                </div>

                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
                    生图 Prompt
                  </p>
                  <ProductDesignPromptMentionTextarea
                    value={shot.imagePrompt ?? ""}
                    referenceImages={mentionRefs ?? []}
                    disabled={rowDisabled}
                    minHeightClass="min-h-[10rem]"
                    className="rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-xs leading-relaxed"
                    hideQuickInsert
                    showTopRefBar={false}
                    onChange={(next) => patchShot(shot.index, { imagePrompt: next })}
                  />
                </div>

                <div className="flex items-end lg:pb-0.5">
                  <EcomButtonSecondary
                    type="button"
                    size="sm"
                    disabled={rowDisabled || !shot.imagePrompt?.trim()}
                    onClick={() => onGenerateImage?.(shot.index)}
                  >
                    {imageBusy ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        生图中…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        生图
                      </>
                    )}
                  </EcomButtonSecondary>
                </div>
              </div>

              <div className="mt-3 grid gap-3 border-t border-dashed border-[#e8e8ed] pt-3 lg:grid-cols-[7.5rem_minmax(0,1fr)_auto] lg:items-start">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
                    分镜视频
                  </p>
                  <EcomVideoSlot
                    src={shot.videoUrl}
                    aspectRatio="9:16"
                    compact
                    generating={videoBusy}
                    emptyLabel="待生视频"
                    playSize="sm"
                    onPreview={
                      shot.videoUrl?.trim()
                        ? () => onPreviewVideo?.(shot.videoUrl!, `镜 ${shot.index}`)
                        : undefined
                    }
                  />
                  {shot.imageUrl?.trim() ? (
                    <button
                      type="button"
                      className="block w-full overflow-hidden rounded-lg border border-[#0071e3]/35 bg-[#f0f6ff] p-1 text-left"
                      title="生视频首帧参考"
                      onClick={() =>
                        onPreviewImage?.(shot.imageUrl!, `镜 ${shot.index} · 生视频首帧`)
                      }
                    >
                      <p className="mb-1 px-0.5 text-[9px] font-medium text-[#0071e3]">首帧参考</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shot.imageUrl}
                        alt={`镜 ${shot.index} 首帧参考`}
                        className="aspect-[3/4] w-full rounded-md object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ) : null}
                </div>

                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6e6e73]">
                    视频 Prompt
                  </p>
                  <ProductDesignPromptMentionTextarea
                    value={shot.videoPrompt}
                    referenceImages={mentionRefs ?? []}
                    disabled={rowDisabled}
                    minHeightClass="min-h-[10rem]"
                    className="rounded-lg border border-[#e8e8ed] bg-white px-2 py-1.5 text-xs leading-relaxed"
                    hideQuickInsert
                    showTopRefBar={false}
                    onChange={(next) => patchShot(shot.index, { videoPrompt: next })}
                  />
                  {shot.imageUrl?.trim() ? (
                    <p className="text-[10px] text-[#0071e3]">生视频时将优先带入上方分镜图</p>
                  ) : (
                    <p className="text-[10px] text-[#86868b]">
                      未生成分镜图时将直接用 @人物A / @产品1 等 token 参考生成
                    </p>
                  )}
                </div>

                <div className="flex items-end lg:pb-0.5">
                  <EcomButtonPrimary
                    type="button"
                    size="sm"
                    disabled={rowDisabled || !shot.videoPrompt.trim()}
                    onClick={() => onGenerateVideo?.(shot.index)}
                  >
                    {videoBusy ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        生视频中…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        生视频
                      </>
                    )}
                  </EcomButtonPrimary>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
