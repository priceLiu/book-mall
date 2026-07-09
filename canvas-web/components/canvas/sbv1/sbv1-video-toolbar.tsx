"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import {
  estimateSbv1ListCostYuan,
  getSbv1VolcengineModelById,
  migrateSbv1ModelVariantId,
  type Sbv1VolcengineModelOption,
} from "@/lib/canvas/sbv1-video-models";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import type {
  Sbv1AspectRatio,
  Sbv1ReferenceMode,
  Sbv1VideoEngineNodeData,
} from "@/lib/canvas/sbv1-workspace-types";
import { Sbv1AspectRatioPicker } from "./sbv1-aspect-ratio-picker";
import { Sbv1CreationTypePicker } from "./sbv1-creation-type-picker";
import { Sbv1DurationPicker } from "./sbv1-duration-picker";
import { Sbv1ReferenceModePicker } from "./sbv1-reference-mode-picker";
import { Sbv1ResolutionPicker } from "./sbv1-resolution-picker";
import { Sbv1VolcengineModelPicker } from "./sbv1-volcengine-model-picker";

export function Sbv1VideoToolbar({
  data,
  isGenerating,
  onPatch,
  onRun,
}: {
  data: Sbv1VideoEngineNodeData;
  isGenerating: boolean;
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
  onRun: () => void;
}) {
  const { providers } = useUserProviders();
  const smartMulti = data.referenceMode === "smart_multi";
  const selectedModel = getSbv1VolcengineModelById(
    migrateSbv1ModelVariantId(data.volcengineVariantId ?? data.jimengModelId),
    providers,
  );
  const estCostYuan = estimateSbv1ListCostYuan({
    listCostYuanPerSec: selectedModel.listCostYuanPerSec,
    durationSec: smartMulti && data.durationSec <= 0 ? 4 : data.durationSec,
  });

  const onReferenceModeChange = (mode: Sbv1ReferenceMode) => {
    const patch: Partial<Sbv1VideoEngineNodeData> = { referenceMode: mode };
    if (mode === "smart_multi") {
      patch.durationSec = 0;
      patch.resolution = data.resolution ?? "720p";
    } else if (data.durationSec < 4 || data.durationSec > 15) {
      patch.durationSec = 15;
    }
    onPatch(patch);
  };

  const onModelChange = (model: Sbv1VolcengineModelOption) => {
    onPatch({
      volcengineVariantId: model.id,
      jimengModelId: model.id,
      engine: { ...model.engine },
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-2 py-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-0.5">
        <Sbv1CreationTypePicker
          value={data.creationType}
          onChange={() => {}}
        />
        <span className="mx-0.5 h-4 w-px bg-white/10" />
        <Sbv1VolcengineModelPicker
          value={data.volcengineVariantId ?? data.jimengModelId}
          onChange={onModelChange}
        />
        <span className="mx-0.5 h-4 w-px bg-white/10" />
        <Sbv1ReferenceModePicker
          value={data.referenceMode}
          onChange={onReferenceModeChange}
        />
        <span className="mx-0.5 h-4 w-px bg-white/10" />
        <Sbv1AspectRatioPicker
          value={data.aspectRatio}
          onChange={(aspectRatio: Sbv1AspectRatio) => onPatch({ aspectRatio })}
        />
        {smartMulti ? (
          <>
            <span className="mx-0.5 h-4 w-px bg-white/10" />
            <Sbv1ResolutionPicker
              value={data.resolution === "1080p" ? "1080p" : "720p"}
              onChange={(resolution) =>
                onPatch({
                  resolution,
                  engine: {
                    ...data.engine,
                    params: { ...data.engine.params, resolution },
                  },
                })
              }
            />
          </>
        ) : null}
        <span className="mx-0.5 h-4 w-px bg-white/10" />
        <Sbv1DurationPicker
          value={data.durationSec}
          readOnly={smartMulti}
          onChange={(durationSec) =>
            onPatch({
              durationSec,
              engine: {
                ...data.engine,
                params: { ...data.engine.params, duration: durationSec },
              },
            })
          }
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {estCostYuan != null ? (
          <span
            className="hidden text-[10px] text-white/40 sm:inline"
            title="火山挂牌估算（BYOK 实扣以控制台为准）"
          >
            ≈¥{estCostYuan.toFixed(2)}
          </span>
        ) : (
          <span className="hidden text-[10px] text-white/30 sm:inline">
            火山 BYOK
          </span>
        )}
        <button
          type="button"
          disabled={isGenerating}
          className="flex size-8 items-center justify-center rounded-full bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
          title="生成视频"
          onClick={onRun}
        >
          {isGenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
