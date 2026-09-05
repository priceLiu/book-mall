"use client";

import { ChevronDown, ChevronUp, Eye, Trash2 } from "lucide-react";
import { useMemo } from "react";

import {
  ECOM_MEDIA_TILE_ACTION_BTN_CLASS,
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS,
  ECOM_SLOT_HOVER_OVERLAY_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import {
  ecomDataTableBodyRowClass,
  ecomDataTableClass,
  ecomDataTableHeadRowClass,
  ecomDataTableTdClass,
  ecomDataTableThClass,
  ecomDataTableWrapClass,
} from "@/components/ui/ecom-data-table";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { AnalysisCell } from "@/components/outfit-video/outfit-scene-analysis-cell";
import type { SceneShot } from "@/lib/video-workflow/shot-spine";
import {
  outfitSceneActionLabel,
  outfitSceneBackgroundLabel,
  outfitSceneCameraLabel,
  outfitSceneLightingLabel,
} from "@/lib/video-workflow/templates/outfit-v1/shot-analysis";
import { cn } from "@/lib/utils";

type Props = {
  scenes: SceneShot[];
  disabled?: boolean;
  onChange: (scenes: SceneShot[]) => void;
  onDelete: (index: number) => void;
};

function ScenePreviewThumb({
  src,
  index,
  disabled,
  onPreview,
}: {
  src: string;
  index: number;
  disabled?: boolean;
  onPreview: () => void;
}) {
  return (
    <div
      className={cn(
        "group/image relative h-[4.5rem] w-10 shrink-0 overflow-hidden rounded border border-[#e8e8ed] bg-[#f5f5f7]",
        disabled && "opacity-60",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      {!disabled ? (
        <>
          <div aria-hidden className={ECOM_SLOT_HOVER_OVERLAY_CLASS} />
          <div className={ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS}>
            <button
              type="button"
              title="预览"
              aria-label={`预览分镜 ${index}`}
              className={cn(ECOM_MEDIA_TILE_ACTION_BTN_CLASS, "pointer-events-auto")}
              onClick={onPreview}
            >
              <Eye className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function OutfitSceneTable({ scenes, disabled, onChange, onDelete }: Props) {
  const previewItems = useMemo(
    () =>
      scenes
        .filter((s) => s.previewImageUrl?.trim())
        .map((s) => ({
          src: s.previewImageUrl!,
          title: `${s.index}`,
          thumbSrc: s.previewImageUrl,
        })),
    [scenes],
  );
  const { preview, openPreview, closePreview } = useEcomImagePreview();

  function move(index: number, dir: -1 | 1) {
    const pos = scenes.findIndex((s) => s.index === index);
    const nextPos = pos + dir;
    if (pos < 0 || nextPos < 0 || nextPos >= scenes.length) return;
    const next = scenes.slice();
    const tmp = next[pos]!;
    next[pos] = next[nextPos]!;
    next[nextPos] = tmp;
    onChange(next.map((s, i) => ({ ...s, index: i + 1 })));
  }

  return (
    <>
      <div className={ecomDataTableWrapClass}>
        <table className={`min-w-full ${ecomDataTableClass}`}>
          <thead>
            <tr className={ecomDataTableHeadRowClass}>
              {["镜号", "时长", "预览", "运镜", "动作", "光影", "场景", "操作"].map((h) => (
                <th key={h} className={`whitespace-nowrap ${ecomDataTableThClass}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenes.map((row) => (
              <tr key={row.sceneId} className={ecomDataTableBodyRowClass}>
                <td className={ecomDataTableTdClass}>{row.index}</td>
                <td className={ecomDataTableTdClass}>{row.durationSec}s</td>
                <td className={ecomDataTableTdClass}>
                  {row.previewImageUrl?.trim() ? (
                    <ScenePreviewThumb
                      src={row.previewImageUrl}
                      index={row.index}
                      disabled={disabled}
                      onPreview={() => {
                        openPreview(
                          row.previewImageUrl!,
                          `分镜 ${row.index}`,
                          previewItems,
                        );
                      }}
                    />
                  ) : (
                    <span className="text-[#86868b]">待抽帧</span>
                  )}
                </td>
                <td className={ecomDataTableTdClass}>
                  <AnalysisCell text={outfitSceneCameraLabel(row)} />
                </td>
                <td className={ecomDataTableTdClass}>
                  <AnalysisCell text={outfitSceneActionLabel(row)} />
                </td>
                <td className={ecomDataTableTdClass}>
                  <AnalysisCell text={outfitSceneLightingLabel(row)} />
                </td>
                <td className={ecomDataTableTdClass}>
                  <AnalysisCell text={outfitSceneBackgroundLabel(row)} />
                </td>
                <td className={ecomDataTableTdClass}>
                  <div className="flex flex-wrap gap-1">
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={disabled || row.index <= 1}
                      onClick={() => move(row.index, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </EcomButtonSecondary>
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={disabled || row.index >= scenes.length}
                      onClick={() => move(row.index, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </EcomButtonSecondary>
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={disabled || scenes.length <= 1}
                      onClick={() => onDelete(row.index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </EcomButtonSecondary>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EcomImagePreviewHost
        preview={preview}
        galleryItems={previewItems}
        onClose={closePreview}
        nativeOverlay
      />
    </>
  );
}
