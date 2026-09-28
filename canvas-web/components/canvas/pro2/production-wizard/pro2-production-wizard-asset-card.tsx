"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ImageIcon, Sparkles } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { LibtvMediaGeneratingState } from "@/components/canvas/libtv-media-generating-state";
import { MediaHoverBox } from "@/components/canvas/media-hover-box";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useCanvasStore } from "@/lib/canvas/store";
import { enqueueWizardAssetGenerate } from "@/lib/canvas/pro2-wizard-asset-generate-queue";
import { patchProductionWizardAssetDraft } from "@/lib/canvas/pro2-wizard-asset-draft-patch";
import { useWizardJobProgressStatus } from "@/lib/canvas/pro2-wizard-asset-progress";
import { markTaskMediaUrlBroken } from "@/lib/canvas/task-media-url";
import type { Pro2ProductionWizardAssetDraft } from "@/lib/canvas/pro2-production-wizard-assets";
import {
  resolveWizardAssetMentionPreviewCandidates,
  toWizardMentionHubPreviewSource,
} from "@/lib/canvas/pro2-wizard-asset-preview-url";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  defaultWizardAssetPrompt,
  WIZARD_ASSET_PLACEHOLDER,
  wizardAssetDraftKey,
  type Pro2WizardAssetKind,
} from "@/lib/canvas/pro2-production-wizard-assets";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import { pickDefaultPro2CharacterImageEngine } from "@/lib/canvas/pro2-three-view-engine";
import { pickDefaultPro2SceneImageEngine } from "@/lib/canvas/pro2-scene-batch-image";
import { cn } from "@/lib/utils";
import {
  Pro2ProductionWizardAssetStudioModal,
  resolveWizardAssetDefaultPrompt,
} from "./pro2-production-wizard-asset-studio-modal";

export type Pro2ProductionWizardAssetCardProps = {
  kind: Pro2WizardAssetKind;
  assetId: string;
  name: string;
  scriptHubId: string;
  subtitle?: string;
  script?: Pro2ProductionScript;
  draft?: Pro2ProductionWizardAssetDraft;
};

/** 刚出图时 OSS 转存未完成会短暂 404，末位候选按退避重试 */
export const WIZARD_PREVIEW_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;

function draftVisualEqual(
  a: Pro2ProductionWizardAssetDraft | undefined,
  b: Pro2ProductionWizardAssetDraft | undefined,
): boolean {
  if (a === b) return true;
  return (
    a?.previewUrl === b?.previewUrl &&
    a?.generateStatus === b?.generateStatus &&
    a?.failMessage === b?.failMessage &&
    a?.modelKey === b?.modelKey
  );
}

function resolveAssetSource(
  kind: Pro2WizardAssetKind,
  assetId: string,
  script?: Pro2ProductionScript,
) {
  if (!script) return null;
  if (kind === "character") {
    return script.characters?.find((c) => c.id === assetId) ?? null;
  }
  if (kind === "scene") {
    return script.scenes?.find((s) => s.id === assetId) ?? null;
  }
  return script.props?.find((p) => p.id === assetId) ?? null;
}

export const Pro2ProductionWizardAssetCard = memo(function Pro2ProductionWizardAssetCard({
  kind,
  assetId,
  name,
  scriptHubId,
  subtitle,
  script,
  draft,
}: Pro2ProductionWizardAssetCardProps) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId) ?? "";
  const { providers } = useUserProviders();
  const [studioOpen, setStudioOpen] = useState(false);
  const hubNodeData = useCanvasStore((s) => {
    const hub = s.nodes.find((n) => n.id === scriptHubId);
    return (hub?.data as StoryProScriptHubNodeData | undefined) ?? null;
  });
  const nodes = useCanvasStore((s) => s.nodes);

  const assetSource = useMemo(
    () => resolveAssetSource(kind, assetId, script),
    [kind, assetId, script],
  );

  const defaultPrompt = useMemo(() => {
    if (assetSource) {
      return defaultWizardAssetPrompt(kind, {
        name: assetSource.name,
        imagePrompt:
          "imagePrompt" in assetSource ? assetSource.imagePrompt : undefined,
        description:
          "description" in assetSource ? assetSource.description : undefined,
      });
    }
    return resolveWizardAssetDefaultPrompt(kind, assetId, script);
  }, [assetSource, kind, assetId, script]);

  const prompt = draft?.prompt?.trim() || defaultPrompt;
  const refImages = draft?.refImages ?? [];
  const hubPreview = useMemo(
    () => toWizardMentionHubPreviewSource(scriptHubId, hubNodeData),
    [scriptHubId, hubNodeData],
  );
  const previewCandidates = useMemo(() => {
    const resolved = resolveWizardAssetMentionPreviewCandidates(
      kind,
      assetId,
      hubNodeData?.productionWizardAssetDrafts,
      hubPreview,
    );
    const nodeCandidates: string[] = [];
    if (kind === "character") {
      for (const n of nodes) {
        if (n.type !== "story-pro2-three-view") continue;
        const d = n.data as {
          pro2RowKey?: string;
          ossUrl?: string;
          runtime?: { ossUrl?: string; ephemeralUrl?: string };
        };
        if (d.pro2RowKey !== assetId) continue;
        for (const u of [d.ossUrl, d.runtime?.ossUrl, d.runtime?.ephemeralUrl]) {
          const t = u?.trim();
          if (t?.startsWith("http") && !nodeCandidates.includes(t)) {
            nodeCandidates.push(t);
          }
        }
      }
    } else if (kind === "prop") {
      for (const n of nodes) {
        if (n.type !== "story-pro2-prop") continue;
        const d = n.data as {
          scriptStudioSourceRowKey?: string;
          ossUrl?: string;
          runtime?: { ossUrl?: string; ephemeralUrl?: string };
        };
        if (d.scriptStudioSourceRowKey !== assetId) continue;
        for (const u of [d.ossUrl, d.runtime?.ossUrl, d.runtime?.ephemeralUrl]) {
          const t = u?.trim();
          if (t?.startsWith("http") && !nodeCandidates.includes(t)) {
            nodeCandidates.push(t);
          }
        }
      }
    }
    for (const c of nodeCandidates) {
      if (!resolved.includes(c)) resolved.unshift(c);
    }
    const fallback = draft?.previewUrl?.trim();
    if (fallback && !resolved.includes(fallback)) resolved.push(fallback);
    return resolved;
  }, [assetId, draft?.previewUrl, hubNodeData, hubPreview, kind, nodes]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewCandidatesKey = previewCandidates.join("|");
  useEffect(() => {
    setPreviewIndex(0);
  }, [previewCandidatesKey]);
  const previewUrl = previewCandidates[previewIndex];
  const progressStatus = useWizardJobProgressStatus(
    wizardAssetDraftKey(kind, assetId),
  );
  const generateStatus = draft?.generateStatus ?? "idle";
  const isGenerating =
    generateStatus === "running" || progressStatus === "running";

  const defaultEngine = useMemo(() => {
    const pick =
      kind === "character"
        ? pickDefaultPro2CharacterImageEngine(providers)
        : pickDefaultPro2SceneImageEngine(providers);
    return pick ?? { providerId: "", modelKey: "", params: {} };
  }, [kind, providers]);

  const providerId = draft?.providerId ?? defaultEngine.providerId;
  const modelKey = draft?.modelKey ?? defaultEngine.modelKey;
  const params = draft?.params ?? defaultEngine.params ?? {};

  const ensureDraftBase = useCallback((): Pro2ProductionWizardAssetDraft => {
    return {
      kind,
      assetId,
      prompt,
      refImages,
      providerId,
      modelKey,
      params,
      previewUrl,
      generateStatus,
      ...draft,
    };
  }, [
    kind,
    assetId,
    prompt,
    refImages,
    providerId,
    modelKey,
    params,
    previewUrl,
    generateStatus,
    draft,
  ]);

  const patchDraft = useCallback(
    (patch: Partial<Pro2ProductionWizardAssetDraft>) => {
      patchProductionWizardAssetDraft(scriptHubId, kind, assetId, patch);
    },
    [assetId, kind, scriptHubId],
  );

  const handleEnqueueGenerate = useCallback(
    (payload: {
      settings: import("@/lib/canvas/sbv1-workspace-types").Sbv1ImageNodeData;
      prompt: string;
      refImages: typeof refImages;
      providerId: string;
      modelKey: string;
      params: Record<string, unknown>;
    }) => {
      if (!base?.trim() || !projectId.trim()) return false;
      patchDraft({
        prompt: payload.prompt.trim(),
        refImages: payload.refImages,
        providerId: payload.providerId,
        modelKey: payload.modelKey,
        params: payload.params,
      });
      return enqueueWizardAssetGenerate({
        label: name,
        scriptHubId,
        kind,
        assetId,
        base,
        projectId,
        settings: payload.settings,
        prompt: payload.prompt,
        refImages: payload.refImages,
        script,
      });
    },
    [
      assetId,
      base,
      kind,
      name,
      patchDraft,
      projectId,
      script,
      scriptHubId,
    ],
  );

  return (
    <>
      <article
        className={cn(
          "flex min-w-[260px] flex-col overflow-hidden rounded-xl border bg-white/[0.02]",
          generateStatus === "failed"
            ? "border-amber-500/25"
            : "border-white/[0.06]",
        )}
      >
        <div className="relative aspect-video w-full bg-black/40">
          {previewUrl && !isGenerating ? (
            <MediaHoverBox
              src={previewUrl}
              alt={name}
              fit="cover"
              variant="generated"
              previewChrome="ecom"
              prompt={prompt}
              className="size-full"
              errorRetryDelaysMs={
                previewIndex + 1 >= previewCandidates.length
                  ? WIZARD_PREVIEW_RETRY_DELAYS_MS
                  : undefined
              }
              onImageError={() => {
                if (previewIndex + 1 >= previewCandidates.length) {
                  for (const u of previewCandidates) markTaskMediaUrlBroken(u);
                  return;
                }
                setPreviewIndex((idx) =>
                  idx + 1 < previewCandidates.length ? idx + 1 : idx,
                );
              }}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center text-white/25">
              {!isGenerating ? (
                <>
                  <ImageIcon className="size-9" strokeWidth={1.25} />
                  <span className="text-[11px] leading-snug">
                    {WIZARD_ASSET_PLACEHOLDER[kind]}
                  </span>
                </>
              ) : null}
            </div>
          )}

          {isGenerating ? (
            <LibtvMediaGeneratingState
              variant="violet"
              className="absolute inset-0 rounded-none [&>div]:!border-0 [&>div]:![box-shadow:none]"
            />
          ) : null}

          <button
            type="button"
            aria-label="出图设置"
            title="出图设置"
            className={cn(
              "absolute bottom-2 right-2 z-[3] grid size-8 place-items-center rounded-lg border border-white/15 bg-black/70 text-zinc-100",
              "backdrop-blur-sm transition hover:border-white/30 hover:bg-white/10 hover:text-white",
              isGenerating && "opacity-80",
            )}
            onClick={() => setStudioOpen(true)}
          >
            <Sparkles className="size-4" />
          </button>
        </div>

        <div className="shrink-0 space-y-0.5 px-3 py-2.5">
          <h3 className="truncate text-sm font-medium text-zinc-100">{name}</h3>
          {subtitle ? (
            <p className="line-clamp-2 text-xs text-zinc-500">{subtitle}</p>
          ) : null}
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

      <Pro2ProductionWizardAssetStudioModal
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        kind={kind}
        assetId={assetId}
        title={name}
        scriptHubId={scriptHubId}
        script={script}
        initialPrompt={prompt}
        initialRefImages={refImages}
        providerId={providerId}
        modelKey={modelKey}
        params={params}
        previewUrl={previewUrl}
        generateStatus={generateStatus}
        onEnqueueGenerate={handleEnqueueGenerate}
        onSave={(patch) => {
          patchDraft({
            ...ensureDraftBase(),
            ...patch,
          });
        }}
      />
    </>
  );
}, (prev, next) => {
  return (
    prev.kind === next.kind &&
    prev.assetId === next.assetId &&
    prev.name === next.name &&
    prev.subtitle === next.subtitle &&
    prev.scriptHubId === next.scriptHubId &&
    prev.script === next.script &&
    draftVisualEqual(prev.draft, next.draft)
  );
});

export { wizardAssetDraftKey };
