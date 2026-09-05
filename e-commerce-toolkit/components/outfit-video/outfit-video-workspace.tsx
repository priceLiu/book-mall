"use client";

import { ChevronDown, Cpu, Download, Images, Loader2, Plus, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import {
  OutfitVideoBottomDockComposer,
  OutfitVideoBottomDockThread,
} from "@/components/outfit-video/outfit-video-bottom-dock";
import { OutfitVideoMediaInput } from "@/components/outfit-video/outfit-video-media-input";
import { OutfitRefSetupPanel } from "@/components/outfit-video/outfit-ref-setup-panel";
import { OutfitSceneTable } from "@/components/outfit-video/outfit-scene-table";
import { OutfitShotProductionPanel } from "@/components/outfit-video/outfit-shot-production-panel";
import { SeedVideoRenderProgressPanel } from "@/components/seed-video/seed-video-render-progress-panel";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { OutfitVideoProject } from "@/lib/ecom-outfit-video-api";
import type { MediaDecomposeChatModel } from "@/lib/media-decompose-types";
import {
  ECOM_MEDIA_DECOMPOSE_DEFAULT_VISION_MODEL,
  pickMediaDecomposeChatModelKey,
} from "@/lib/media-decompose-model-pick";
import { OutfitSplitPromptPanel } from "@/components/outfit-video/outfit-split-prompt-panel";
import { getOutfitFixedPromptSections } from "@/lib/outfit-video-fixed-prompts";
import { OutfitSplitProgressStrip } from "@/components/outfit-video/outfit-split-progress-strip";
import { resolveOutfitBottomDockMode } from "@/lib/outfit-video-dock-workflow";
import {
  outfitSplitProgressHeadline,
  parseOutfitSplitProgress,
} from "@/lib/outfit-video-split-progress";
import type { SeedVideoRenderProgressState } from "@/lib/seed-video-render-progress";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import {
  isOutfitRefsReadyToLock,
  type OutfitGarmentMode,
  type OutfitRefMode,
  type OutfitWorkflowPhase,
} from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import { cn } from "@/lib/utils";

type Props = {
  project: OutfitVideoProject;
  phase: OutfitWorkflowPhase;
  chatModels: MediaDecomposeChatModel[];
  splitModelKey: string;
  videoModels: StoryboardGatewayModel[];
  videoModelKey: string;
  modelsLoading?: boolean;
  mediaBusy?: boolean;
  splitting?: boolean;
  refBusy?: boolean;
  generateBusy?: boolean;
  renderBusy?: boolean;
  saveBusy?: boolean;
  generatingIndices?: ReadonlySet<number>;
  renderProgress?: SeedVideoRenderProgressState | null;
  onSplitModelChange: (key: string) => void;
  onVideoModelChange: (key: string) => void;
  onRefreshModels?: () => void;
  onUploadReferenceVideo: (file: File) => Promise<void>;
  onImportReferenceUrl: (url: string) => Promise<void>;
  onAttachReferenceAsset: (assetId: string) => Promise<void>;
  onClearReferenceVideo: () => Promise<void>;
  onSplitScenes: (splitModelKey: string) => Promise<void>;
  onSceneChange: (scenes: OutfitVideoProject["sceneList"]) => Promise<void>;
  onScenePromptChange: (sceneId: string, prompt: string) => void;
  onScenePromptReset: (sceneId: string) => void;
  onDeleteScene: (index: number) => Promise<void>;
  onUploadModel: (file: File) => Promise<void>;
  onUploadClothing: (file: File) => Promise<void>;
  onUploadTopGarment: (file: File) => Promise<void>;
  onUploadBottomGarment: (file: File) => Promise<void>;
  onOutfitRefModeChange: (mode: OutfitRefMode) => void;
  onGarmentModeChange: (mode: OutfitGarmentMode) => void;
  onPickModelFromLibrary: (ossUrl: string, label?: string) => Promise<void>;
  onLockRefs: () => Promise<void>;
  onGenerateShots: (indices: number[], modelKey: string) => Promise<void>;
  onCancelGeneratingSelection?: (index: number) => void;
  onCompose: () => Promise<void>;
  onSaveSnapshot: () => Promise<void>;
  onNewProject: () => Promise<void>;
  loadProjectList: () => Promise<EcomProjectListItem[]>;
  onOpenProject: (id: string) => Promise<void>;
  onPreviewVideo: (src: string, title?: string) => void;
  onRenderProgressPanelOpenChange: (open: boolean) => void;
  onRenderProgressCollapsedChange: (collapsed: boolean) => void;
  onRenderProgressDismiss: () => void;
  splitSystemDraft: string;
  splitUserDraft: string;
  splitPromptErrors?: string[];
  splitPromptBusy?: boolean;
  onSplitSystemChange: (value: string) => void;
  onSplitUserChange: (value: string) => void;
  onResetSplitSystem: () => void;
  onResetSplitUser: () => void;
  fusionModelKey?: string;
  fusingIndices?: ReadonlySet<number>;
  onPickSceneFusionMode: (
    index: number,
    mode: "follow_reference" | "library" | "upload_ref",
    libraryEntryId?: string,
  ) => Promise<void>;
  onUploadSceneRef: (index: number, file: File) => Promise<void>;
  onFuseScene: (index: number) => Promise<void>;
  onApplySceneFusionToAll: (sourceIndex: number) => Promise<void>;
};

export function OutfitVideoWorkspace({
  project,
  phase,
  chatModels,
  splitModelKey,
  videoModels,
  videoModelKey,
  modelsLoading,
  mediaBusy,
  splitting,
  refBusy,
  generateBusy,
  renderBusy,
  saveBusy,
  generatingIndices,
  renderProgress,
  onSplitModelChange,
  onVideoModelChange,
  onRefreshModels,
  onUploadReferenceVideo,
  onImportReferenceUrl,
  onAttachReferenceAsset,
  onClearReferenceVideo,
  onSplitScenes,
  onSceneChange,
  onScenePromptChange,
  onScenePromptReset,
  onDeleteScene,
  onUploadModel,
  onUploadClothing,
  onUploadTopGarment,
  onUploadBottomGarment,
  onOutfitRefModeChange,
  onGarmentModeChange,
  onPickModelFromLibrary,
  onLockRefs,
  onGenerateShots,
  onCancelGeneratingSelection,
  onCompose,
  onSaveSnapshot,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onPreviewVideo,
  onRenderProgressPanelOpenChange,
  onRenderProgressCollapsedChange,
  onRenderProgressDismiss,
  splitSystemDraft,
  splitUserDraft,
  splitPromptErrors,
  splitPromptBusy,
  onSplitSystemChange,
  onSplitUserChange,
  onResetSplitSystem,
  onResetSplitUser,
  fusionModelKey,
  fusingIndices,
  onPickSceneFusionMode,
  onUploadSceneRef,
  onFuseScene,
  onApplySceneFusionToAll,
}: Props) {
  const router = useRouter();
  const pendingGenerateRef = useRef<number[]>([]);
  const promptSections = getOutfitFixedPromptSections();
  const [splitPromptExpanded, setSplitPromptExpanded] = useState(false);
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);
  const [splitDraftModelKey, setSplitDraftModelKey] = useState(splitModelKey);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [pickerPanelDurationSec, setPickerPanelDurationSec] = useState(8);

  useEffect(() => {
    setSplitDraftModelKey(splitModelKey);
  }, [splitModelKey]);

  const eligibleSplitModels = useMemo(
    () => chatModels.filter((m) => m.supportsVideo !== false),
    [chatModels],
  );

  useEffect(() => {
    if (eligibleSplitModels.length === 0) return;
    if (eligibleSplitModels.some((m) => m.modelKey === splitModelKey)) return;
    onSplitModelChange(
      pickMediaDecomposeChatModelKey(eligibleSplitModels, splitModelKey, "video"),
    );
  }, [eligibleSplitModels, onSplitModelChange, splitModelKey]);

  const selectedSplitModelLabel =
    eligibleSplitModels.find((m) => m.modelKey === splitModelKey)?.displayName ?? splitModelKey;

  const isStubSplitSceneList =
    project.meta?.splitSceneSource === "stub_v1" ||
    (project.meta?.splitSceneSource !== "ffmpeg_v1" &&
      project.sceneList.some((s) => s.previewImageUrl?.includes("picsum.photos")));
  const refVideo = project.references.referenceVideo;
  const splitProgress = parseOutfitSplitProgress(project.meta);
  const hasScenes = project.sceneList.length > 0;
  const outfitRefMode = project.settings.outfitRefMode ?? "need_tryon";
  const garmentMode = project.settings.garmentMode ?? "two_piece";
  const refsReadyToLock = isOutfitRefsReadyToLock(
    { outfitRefMode, garmentMode },
    project.references,
  );
  const hasDressedImage = Boolean(project.references.dressedImage?.ossUrl);
  const hasRefs = hasDressedImage;
  const finalVideoUrl = project.composeResult?.videoUrl?.trim() || "";
  const jobBusy = Boolean(mediaBusy || splitting || generateBusy || renderBusy || refBusy);

  const idleGenerateIndices = useMemo(
    () =>
      project.sceneList
        .filter((s) => !s.videoUrl?.trim() && !(generatingIndices?.has(s.index) ?? false))
        .map((s) => s.index),
    [generatingIndices, project.sceneList],
  );

  const { mode: bottomDockMode, showDock } = resolveOutfitBottomDockMode({
    phase,
    splitting,
    generateBusy,
    renderBusy,
    refsReadyToLock,
    hasDressedImage,
  });

  function openGeneratePicker(indices: number[]) {
    const unique = [...new Set(indices)].sort((a, b) => a - b);
    pendingGenerateRef.current = unique;
    if (unique.length > 0) {
      const firstShot = project.sceneList.find((s) => s.index === unique[0]);
      setPickerPanelDurationSec(firstShot?.durationSec ?? 8);
    }
    setVideoPickerOpen(true);
  }

  async function onVideoPickerConfirm(modelKey: string) {
    const indices = [...pendingGenerateRef.current];
    pendingGenerateRef.current = [];
    setVideoPickerOpen(false);
    onVideoModelChange(modelKey);
    if (indices.length === 0) return;
    await onGenerateShots(indices, modelKey);
  }

  async function handleSplitClick() {
    if (!refVideo?.ossUrl || splitting || mediaBusy) return;
    await onSplitScenes(splitModelKey);
  }

  const mainScroll = (
    <>
      <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">穿搭视频</h2>
            <p className="text-[11px] text-[#6e6e73]">
              上传参考视频，拆镜后锁定穿搭参考，逐镜动作迁移并合成竖屏成片。
            </p>
          </div>
          <EcomIconToolbar>
            <EcomIconToolbarGroup label="项目">
              <EcomIconButton
                label="新建项目"
                icon={Plus}
                disabled={jobBusy}
                onClick={() => void onNewProject()}
              />
              <EcomProjectListButton
                disabled={jobBusy}
                currentProjectId={project.id}
                loadProjects={loadProjectList}
                onSelectProject={(id) => void onOpenProject(id)}
                title="穿搭视频 · 项目列表"
                emptyHint="还没有保存过的穿搭视频项目。"
              />
            </EcomIconToolbarGroup>
            <EcomIconToolbarGroup label="工作流">
              <EcomIconButton
                label="保存作品"
                icon={Save}
                busy={saveBusy}
                disabled={!refVideo?.ossUrl || saveBusy || jobBusy}
                onClick={() => void onSaveSnapshot()}
              />
            </EcomIconToolbarGroup>
            <EcomIconToolbarGroup label="资产与交付">
              <EcomIconButton
                label="我的资产"
                icon={Images}
                onClick={() => router.push("/library")}
              />
              <EcomIconButton
                label="导出交付包"
                icon={Download}
                disabled={!finalVideoUrl}
                onClick={() => {
                  if (finalVideoUrl) onPreviewVideo(finalVideoUrl, "穿搭成片");
                }}
              />
            </EcomIconToolbarGroup>
          </EcomIconToolbar>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        <OutfitVideoMediaInput
          referenceVideo={refVideo}
          busy={mediaBusy}
          referenceVideoLocked={hasScenes}
          onUploadFile={onUploadReferenceVideo}
          onImportUrl={onImportReferenceUrl}
          onAttachAsset={onAttachReferenceAsset}
          onClear={onClearReferenceVideo}
        />

        <div className="space-y-2 rounded-xl border border-[#e8e8ed] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex min-w-0 items-center gap-1.5 text-left"
              aria-expanded={splitPromptExpanded}
              onClick={() => setSplitPromptExpanded((v) => !v)}
            >
              <span className="text-sm font-semibold text-[#1d1d1f]">拆解指令</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[#6e6e73] transition-transform",
                  splitPromptExpanded && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={splitting || modelsLoading}
                onClick={() => setSplitPickerOpen(true)}
              >
                <Cpu className="mr-1 h-3.5 w-3.5" />
                {selectedSplitModelLabel}
              </EcomButtonSecondary>
              <EcomButtonPrimary
                size="sm"
                type="button"
                disabled={!refVideo?.ossUrl || splitting || mediaBusy}
                onClick={() => void handleSplitClick()}
              >
                {splitting ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    拆解中…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    {hasScenes ? "重新拆解" : "拆解"}
                  </>
                )}
              </EcomButtonPrimary>
            </div>
          </div>

          <OutfitSplitPromptPanel
            generate={promptSections.generate}
            expanded={splitPromptExpanded}
            onToggleExpanded={() => setSplitPromptExpanded((v) => !v)}
            systemDraft={splitSystemDraft}
            userDraft={splitUserDraft}
            jsonPrefix={promptSections.split.jsonPrefix}
            runtimeAppendix={promptSections.split.runtimeAppendix}
            validationErrors={splitPromptErrors}
            promptBusy={splitPromptBusy || splitting}
            onSystemChange={onSplitSystemChange}
            onUserChange={onSplitUserChange}
            onResetSystem={onResetSplitSystem}
            onResetUser={onResetSplitUser}
          />
        </div>

        <OutfitSplitProgressStrip active={Boolean(splitting)} progress={splitProgress} />

            {hasScenes ? (
              <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
                <h2 className="text-sm font-semibold text-[#1d1d1f]">分镜表</h2>
                {isStubSplitSceneList ? (
                  <p className="rounded-lg border border-[#ffe8bf] bg-[#fffbf0] px-3 py-2 text-xs leading-relaxed text-[#8a6d3b]">
                    当前为<strong className="font-semibold">开发占位拆镜</strong>
                    ，不是从你的参考视频真实切出来的：固定 4 镜、运镜/动作为模板字段，预览图为占位图（非视频抽帧）。真实
                    FFmpeg 物理切镜与 Qwen 视频理解尚未接入；点「拆解」仅走占位逻辑。
                  </p>
                ) : null}
                <OutfitSceneTable
              scenes={project.sceneList}
              disabled={splitting || generateBusy}
              onChange={(scenes) => void onSceneChange(scenes)}
              onDelete={(index) => void onDeleteScene(index)}
            />
          </section>
        ) : null}

        {hasScenes ? (
          <OutfitRefSetupPanel
            refs={project.references}
            outfitRefMode={outfitRefMode}
            garmentMode={garmentMode}
            busy={refBusy}
            lockLabel={
              outfitRefMode === "need_tryon" ? "AI 试衣并锁定特征" : "锁定特征并进入逐镜生成"
            }
            confirmDisabled={!refsReadyToLock}
            onOutfitRefModeChange={onOutfitRefModeChange}
            onGarmentModeChange={onGarmentModeChange}
            onUploadModel={onUploadModel}
            onUploadClothing={onUploadClothing}
            onUploadTopGarment={onUploadTopGarment}
            onUploadBottomGarment={onUploadBottomGarment}
            onPickModelFromLibrary={onPickModelFromLibrary}
            onConfirm={() => void onLockRefs()}
          />
        ) : null}

        {hasScenes && hasRefs ? (
          <OutfitShotProductionPanel
            scenes={project.sceneList}
            refs={project.references}
            disabled={generateBusy || renderBusy}
            generatingIndices={generatingIndices}
            generateBusy={generateBusy}
            renderBusy={renderBusy}
            finalVideoUrl={finalVideoUrl || undefined}
            onPreviewVideo={onPreviewVideo}
            onRequestGenerate={openGeneratePicker}
            onRequestCompose={() => void onCompose()}
            onCancelGeneratingSelection={onCancelGeneratingSelection}
            onScenePromptChange={onScenePromptChange}
            onScenePromptReset={onScenePromptReset}
            fusionModelKey={fusionModelKey}
            fusingIndices={fusingIndices}
            onPickSceneFusionMode={onPickSceneFusionMode}
            onUploadSceneRef={onUploadSceneRef}
            onFuseScene={onFuseScene}
            onApplySceneFusionToAll={onApplySceneFusionToAll}
          />
        ) : null}

        {showDock ? <OutfitVideoBottomDockThread mode={bottomDockMode} /> : null}
      </div>

      <StoryboardModelPickerDialog
        open={splitPickerOpen}
        onOpenChange={setSplitPickerOpen}
        nativeOverlay
        mode="image"
        dialogTitle="选择视觉理解模型"
        dialogDescription="拆镜须支持视频理解的模型（Qwen3.8 Max / Qwen3-VL 等）。"
        footerHint="确认后将用于本次拆镜拆解。"
        confirmLabel="使用该模型"
        models={eligibleSplitModels.length ? eligibleSplitModels : chatModels}
        modelsLoading={modelsLoading}
        modelsEmptyHint="暂无可用视觉理解模型，请检查 Gateway 凭证。"
        hideTypeFilter
        onRetryLoadModels={onRefreshModels}
        value={splitDraftModelKey}
        onChange={setSplitDraftModelKey}
        onConfirm={(key) => {
          onSplitModelChange(key);
          setSplitPickerOpen(false);
        }}
      />

      <StoryboardModelPickerDialog
        open={videoPickerOpen}
        onOpenChange={setVideoPickerOpen}
        nativeOverlay
        mode="video"
        videoTarget="panel"
        models={videoModels}
        value={videoModelKey}
        onChange={onVideoModelChange}
        onConfirm={(modelKey) => void onVideoPickerConfirm(modelKey)}
        modelsLoading={modelsLoading}
        aspectRatio="9:16"
        panelDurationSec={pickerPanelDurationSec}
        onPanelDurationChange={setPickerPanelDurationSec}
      />
    </>
  );

  return (
    <>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
        <div className="ecom-scrollbar-overlay min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
          {mainScroll}
        </div>
        {showDock ? (
          <OutfitVideoBottomDockComposer
            mode={bottomDockMode}
            busy={jobBusy}
            progressHint={splitting ? outfitSplitProgressHeadline(splitProgress) : undefined}
            onSplitScenes={
              bottomDockMode === "split-ready" || (hasScenes && refVideo?.ossUrl)
                ? () => void handleSplitClick()
                : undefined
            }
            onLockRefs={
              bottomDockMode === "refs-ready" ? () => void onLockRefs() : undefined
            }
            onGenerateShots={
              bottomDockMode === "generate-ready" && idleGenerateIndices.length > 0
                ? () => openGeneratePicker(idleGenerateIndices)
                : undefined
            }
            onCompose={
              bottomDockMode === "compose-ready" && !finalVideoUrl
                ? () => void onCompose()
                : undefined
            }
          />
        ) : null}
      </div>

      <SeedVideoRenderProgressPanel
        state={renderProgress ?? null}
        onPanelOpenChange={onRenderProgressPanelOpenChange}
        onCollapsedChange={onRenderProgressCollapsedChange}
        onDismiss={onRenderProgressDismiss}
      />
    </>
  );
}
