"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Film, ImageIcon, Sparkles } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { LibtvMediaGeneratingState } from "@/components/canvas/libtv-media-generating-state";
import { MediaHoverBox } from "@/components/canvas/media-hover-box";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useCanvasStore } from "@/lib/canvas/store";
import { buildWizardAssetMentionables } from "@/lib/canvas/pro2-production-wizard-assets";
import { useWizardJobProgressStatus } from "@/lib/canvas/pro2-wizard-asset-progress";
import { wizardAssetDraftsShallowEqual } from "@/lib/canvas/pro2-wizard-asset-draft-patch";
import { enqueueWizardShotGenerate } from "@/lib/canvas/pro2-wizard-shot-generate-queue";
import { patchProductionWizardShotDraft } from "@/lib/canvas/pro2-wizard-shot-draft-patch";
import type { Pro2ProductionWizardShotDraft } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import {
  defaultWizardShotPrompt,
  WIZARD_SHOT_PLACEHOLDER,
  wizardShotDraftKey,
  type Pro2WizardShotMediaKind,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { pickDefaultPro2FrameImageEngine } from "@/lib/canvas/pro2-frame-batch-image";
import {
  pickDefaultPro2VideoEngine,
  PRO2_VIDEO_MODEL_KEYS,
} from "@/lib/canvas/pro2-video-batch-video";
import { cn } from "@/lib/utils";
import { Pro2ProductionWizardShotStudioModal } from "./pro2-production-wizard-shot-studio-modal";

export type Pro2ProductionWizardShotMediaCardProps = {
  mediaKind: Pro2WizardShotMediaKind;
  shotIndex: number;
  scriptHubId: string;
  script?: Pro2ProductionScript;
  draft?: Pro2ProductionWizardShotDraft;
  frameDraft?: Pro2ProductionWizardShotDraft;
};

function draftVisualEqual(
  a: Pro2ProductionWizardShotDraft | undefined,
  b: Pro2ProductionWizardShotDraft | undefined,
): boolean {
  if (a === b) return true;
  return (
    a?.previewUrl === b?.previewUrl &&
    a?.generateStatus === b?.generateStatus &&
    a?.failMessage === b?.failMessage &&
    a?.modelKey === b?.modelKey
  );
}

export const Pro2ProductionWizardShotMediaCard = memo(
  function Pro2ProductionWizardShotMediaCard({
    mediaKind,
    shotIndex,
    scriptHubId,
    script,
    draft,
    frameDraft,
  }: Pro2ProductionWizardShotMediaCardProps) {
    const base = useBookMallBaseUrl();
    const projectId = useCanvasStore((s) => s.projectId) ?? "";
    const { providers } = useUserProviders();
    const [studioOpen, setStudioOpen] = useState(false);

    const shot = useMemo(
      () => script?.shots?.find((s) => s.index === shotIndex),
      [script, shotIndex],
    );

    const defaultPrompt = useMemo(() => {
      if (!shot) return "";
      return defaultWizardShotPrompt(mediaKind, shot);
    }, [mediaKind, shot]);

    const prompt = draft?.prompt?.trim() || defaultPrompt;
    const refImages = draft?.refImages ?? [];
    const assetDrafts = useCanvasStore((s) => {
      const hub = s.nodes.find((n) => n.id === scriptHubId);
      return (
        (hub?.data as StoryProScriptHubNodeData | undefined)
          ?.productionWizardAssetDrafts ?? {}
      );
    }, wizardAssetDraftsShallowEqual);
    const mentionables = useMemo(
      () => buildWizardAssetMentionables(script, refImages, undefined, assetDrafts),
      [script, refImages, assetDrafts],
    );
    const previewUrl = draft?.previewUrl;
    const jobId = wizardShotDraftKey(mediaKind, shotIndex);
    const progressStatus = useWizardJobProgressStatus(jobId);
    const liveGenerateStatus = useCanvasStore((s) => {
      const hub = s.nodes.find((n) => n.id === scriptHubId);
      const drafts =
        (hub?.data as StoryProScriptHubNodeData | undefined)
          ?.productionWizardShotDrafts ?? {};
      return drafts[jobId]?.generateStatus ?? "idle";
    });
    const generateStatus = liveGenerateStatus;
    const isGenerating =
      progressStatus === "running" || generateStatus === "running";
    const framePreviewUrl = frameDraft?.previewUrl?.trim();

    const defaultFrameEngine = useMemo(
      () => pickDefaultPro2FrameImageEngine(providers),
      [providers],
    );
    const defaultVideoEngine = useMemo(
      () => pickDefaultPro2VideoEngine(providers),
      [providers],
    );

    const providerId =
      draft?.providerId ??
      (mediaKind === "frame"
        ? defaultFrameEngine?.providerId
        : defaultVideoEngine?.providerId) ??
      "";
    const modelKey =
      draft?.modelKey ??
      (mediaKind === "frame"
        ? defaultFrameEngine?.modelKey
        : defaultVideoEngine?.modelKey) ??
      "";
    const params =
      draft?.params ??
      (mediaKind === "frame"
        ? defaultFrameEngine?.params
        : defaultVideoEngine?.params) ??
      {};

    const patchDraft = useCallback(
      (patch: Partial<Pro2ProductionWizardShotDraft>) => {
        patchProductionWizardShotDraft(
          scriptHubId,
          mediaKind,
          shotIndex,
          patch,
        );
      },
      [mediaKind, scriptHubId, shotIndex],
    );

    const handleEnqueueGenerate = useCallback(
      (payload: {
        prompt: string;
        refImages: typeof refImages;
        providerId: string;
        modelKey: string;
        params: Record<string, unknown>;
        frameSettings?: import("@/lib/canvas/sbv1-workspace-types").Sbv1ImageNodeData;
      }) => {
        if (!base?.trim() || !projectId.trim()) return false;
        patchDraft({
          prompt: payload.prompt.trim(),
          refImages: payload.refImages,
          providerId: payload.providerId,
          modelKey: payload.modelKey,
          params: payload.params,
        });
        return enqueueWizardShotGenerate({
          scriptHubId,
          mediaKind,
          shotIndex,
          base,
          projectId,
          prompt: payload.prompt,
          refImages: payload.refImages,
          script,
          dialogue: shot?.dialogue,
          framePreviewUrl:
            mediaKind === "video" ? framePreviewUrl : undefined,
          frameSettings: payload.frameSettings,
          videoEngine:
            mediaKind === "video"
              ? {
                  providerId: payload.providerId,
                  modelKey: payload.modelKey,
                  params: payload.params,
                }
              : undefined,
        });
      },
      [
        base,
        framePreviewUrl,
        mediaKind,
        patchDraft,
        projectId,
        script,
        scriptHubId,
        shot?.dialogue,
        shotIndex,
      ],
    );

    const mediaLabel = mediaKind === "frame" ? "分镜图" : "分镜视频";
    const MediaIcon = mediaKind === "frame" ? ImageIcon : Film;

    return (
      <>
        <article
          className={cn(
            "flex min-w-[220px] flex-col overflow-hidden rounded-xl border bg-white/[0.02]",
            generateStatus === "failed"
              ? "border-amber-500/25"
              : "border-white/[0.06]",
            mediaKind === "video" &&
              !framePreviewUrl &&
              !previewUrl &&
              "opacity-75",
          )}
        >
          <div className="relative aspect-video w-full bg-black/40">
            {previewUrl ? (
              <MediaHoverBox
                src={previewUrl}
                mediaKind={mediaKind === "video" ? "video" : "image"}
                alt={`镜 ${shotIndex} ${mediaLabel}`}
                fit="cover"
                variant="generated"
                previewChrome="ecom"
                prompt={prompt}
                promptMentionables={mentionables}
                className={cn("size-full", isGenerating && "opacity-50")}
              />
            ) : !isGenerating ? (
              <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center text-white/25">
                <MediaIcon className="size-8" strokeWidth={1.25} />
                <span className="text-[10px] leading-snug">
                  {WIZARD_SHOT_PLACEHOLDER[mediaKind]}
                </span>
              </div>
            ) : null}

            {isGenerating ? (
              <LibtvMediaGeneratingState
                variant="violet"
                className="absolute inset-0 z-[2] rounded-none [&>div]:!border-0 [&>div]:![box-shadow:none]"
              />
            ) : null}

            <button
              type="button"
              aria-label={`${mediaLabel}设置`}
              title={`${mediaLabel}设置`}
              className={cn(
                "absolute bottom-2 right-2 z-[3] grid size-8 place-items-center rounded-lg border border-white/15 bg-black/70 text-zinc-100",
                "backdrop-blur-sm transition hover:border-white/30 hover:bg-white/10 hover:text-white",
                isGenerating && "opacity-80",
              )}
              onClick={(e) => {
                e.stopPropagation();
                setStudioOpen(true);
              }}
            >
              <Sparkles className="size-4" />
            </button>
          </div>

          <div className="shrink-0 space-y-0.5 px-3 py-2">
            <h3 className="truncate text-xs font-medium text-zinc-200">
              {mediaLabel}
            </h3>
            {isGenerating ? (
              <p className="truncate text-[10px] text-zinc-500">生成中…</p>
            ) : generateStatus === "failed" && draft?.failMessage ? (
              <p className="line-clamp-2 text-[10px] text-amber-300/90">
                {draft.failMessage}
              </p>
            ) : modelKey ? (
              <p className="truncate text-[10px] text-zinc-600">{modelKey}</p>
            ) : null}
          </div>
        </article>

        <Pro2ProductionWizardShotStudioModal
          open={studioOpen}
          onClose={() => setStudioOpen(false)}
          mediaKind={mediaKind}
          shotIndex={shotIndex}
          scriptHubId={scriptHubId}
          script={script}
          initialPrompt={prompt}
          initialRefImages={refImages}
          providerId={providerId}
          modelKey={modelKey}
          params={params}
          previewUrl={previewUrl}
          framePreviewUrl={framePreviewUrl}
          generateStatus={generateStatus}
          onEnqueueGenerate={handleEnqueueGenerate}
          onSave={(patch) => {
            patchDraft({
              mediaKind,
              shotIndex,
              prompt: patch.prompt,
              refImages: patch.refImages,
              providerId: patch.providerId,
              modelKey: patch.modelKey,
              params: patch.params,
              previewUrl: patch.previewUrl,
            });
          }}
        />
      </>
    );
  },
  (prev, next) =>
    prev.mediaKind === next.mediaKind &&
    prev.shotIndex === next.shotIndex &&
    prev.scriptHubId === next.scriptHubId &&
    prev.script === next.script &&
    draftVisualEqual(prev.draft, next.draft) &&
    prev.frameDraft?.previewUrl === next.frameDraft?.previewUrl,
);

export { wizardShotDraftKey };
