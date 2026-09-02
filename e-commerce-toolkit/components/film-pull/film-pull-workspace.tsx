"use client";

import { ChevronDown, Clapperboard, Cpu, Download, Images, Loader2, Plus, Save, Sparkles, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FilmPullReplicaIdleComposer,
  FilmPullReplicaIdleThread,
} from "@/components/film-pull/film-pull-bottom-dock";
import { FilmPullMediaInput } from "@/components/film-pull/film-pull-media-input";
import { FilmPullProductionWorkspace } from "@/components/film-pull/film-pull-production-workspace";
import { ReplicaSetupPanel } from "@/components/replica/replica-setup-panel";
import { FilmPullResultPanel } from "@/components/film-pull/film-pull-result-panel";
import { MediaDecomposeReplicaLaunch } from "@/components/media-decompose/media-decompose-replica-panel";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomIconButton, EcomShareIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  autoFilmPullRefMatch,
  assembleFilmPullProductionScript,
  confirmFilmPullProductionScript,
  saveFilmPullProductionPlan,
} from "@/lib/ecom-film-pull-api";
import {
  buildMentionCatalogFromFilmPullRefs,
  mentionCatalogSignature,
  syncFilmPullProductionShotsAfterRefChange,
} from "@/lib/ecom-mention-catalog-sync";
import { defaultFilmPullAnalyzePrompt } from "@/lib/film-pull-default-prompts";
import { isFilmPullMockDevUiEnabled } from "@/lib/film-pull-mock-dev";
import {
  filmPullBottomDockHint,
  filmPullThreadWelcome,
  hasFilmPullAnalyze,
  isFilmPullReplicaStarted,
  resolveFilmPullBottomDockMode,
  resolveFilmPullV2Phase,
  FILM_PULL_SCRIPT_PREP_STEP_LABELS,
} from "@/lib/film-pull-production-workflow";
import {
  buildProductionPlanPatch,
  syncRefMatchWithProductionShots,
} from "@/lib/film-pull-production-script-utils";
import { listFilmPullModelRefs, listFilmPullProductRefs } from "@/lib/film-pull-refs";
import {
  extractFilmPullAnalyzePatch,
  toFilmPullDisplayMarkdown,
} from "@/lib/film-pull-structured";
import type { FilmPullProject } from "@/lib/film-pull-types";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import {
  createFilmPullRefSetupApi,
  FILM_PULL_REF_SETUP_COPY,
} from "@/lib/replica-setup-api";
import { cn } from "@/lib/utils";

type Props = {
  project: FilmPullProject;
  chatModels: StoryboardGatewayModel[];
  chatModelKey: string;
  modelsLoading?: boolean;
  mediaBusy?: boolean;
  analyzing?: boolean;
  streamText?: string;
  onChatModelChange: (key: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  onImportUrl: (url: string) => Promise<void>;
  onAttachAsset: (assetId: string) => Promise<void>;
  onClearMedia: () => Promise<void>;
  onAnalyze: (prompt: string, modelKey: string) => void;
  onMockAnalyze?: (prompt: string) => Promise<void>;
  onAbortAnalyze?: () => void;
  onExportZip?: () => void;
  onSaveProject?: () => void | Promise<void>;
  onRefreshModels?: () => void;
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  onProjectUpdated?: (project: FilmPullProject) => void;
  onAlert?: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  replicaBusy?: boolean;
  videoModels?: StoryboardGatewayModel[];
  videoModelKey?: string;
  onVideoModelChange?: (key: string) => void;
  onStartReplica?: () => void | Promise<void>;
  imageModels?: StoryboardGatewayModel[];
  imageModelKey?: string;
  onImageModelChange?: (key: string) => void;
  onPreviewVideo?: (src: string, title?: string) => void;
  saveBusy?: boolean;
  exportBusy?: boolean;
  onShareWorkflow?: () => void;
};

export function FilmPullWorkspace({
  project,
  chatModels,
  chatModelKey,
  modelsLoading,
  mediaBusy,
  analyzing,
  streamText,
  onChatModelChange,
  onUploadFile,
  onImportUrl,
  onAttachAsset,
  onClearMedia,
  onAnalyze,
  onMockAnalyze,
  onAbortAnalyze,
  onExportZip,
  onSaveProject,
  onRefreshModels,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onProjectUpdated,
  onAlert,
  replicaBusy,
  videoModels = [],
  videoModelKey = "",
  onVideoModelChange,
  onStartReplica,
  imageModels = [],
  imageModelKey = "",
  onImageModelChange,
  onPreviewVideo,
  saveBusy,
  exportBusy,
  onShareWorkflow,
}: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(
    project.settings.lastAnalyzePrompt ?? defaultFilmPullAnalyzePrompt(),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftModelKey, setDraftModelKey] = useState(chatModelKey);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [scriptPrepBusy, setScriptPrepBusy] = useState(false);
  const [scriptPrepStep, setScriptPrepStep] = useState(0);
  const [scriptPrepError, setScriptPrepError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt((prev) => {
      if (project.settings.lastAnalyzePrompt) return project.settings.lastAnalyzePrompt;
      return prev || defaultFilmPullAnalyzePrompt();
    });
  }, [project.id, project.settings.lastAnalyzePrompt]);

  const eligibleModels = useMemo(
    () => chatModels.filter((m) => m.supportsVideo === true),
    [chatModels],
  );

  const displaySource = streamText ?? project.analyzeResult?.rawText ?? "";
  const structured =
    project.analyzeResult?.structured ??
    extractFilmPullAnalyzePatch(displaySource) ??
    null;
  const parseError = project.analyzeResult?.parseError;
  const markdown = toFilmPullDisplayMarkdown(displaySource, analyzing);

  const selectedModelLabel =
    eligibleModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? chatModelKey;

  const hasResult = Boolean(structured || displaySource.trim());
  const hasAnalyze = hasFilmPullAnalyze(project);
  const phase = resolveFilmPullV2Phase(project);
  const mediaLocked = analyzing;
  const jobBusy = analyzing || mediaBusy || scriptPrepBusy;
  const canSave = Boolean(project.media) && hasResult && !jobBusy;
  const canStartReplica = Boolean(onStartReplica) && hasAnalyze && !analyzing;
  const replicaStarted = isFilmPullReplicaStarted(project);

  const bottomDockMode = resolveFilmPullBottomDockMode(project, hasAnalyze);
  const modelRefCount = listFilmPullModelRefs(project.characterRefs).length;
  const productRefCount = listFilmPullProductRefs(project.characterRefs).length;
  const refsReadyForMatch = modelRefCount > 0 && productRefCount > 0;
  const hasProductionPlan = Boolean(project.productionPlan?.shots.length);
  const showProductionWorkspace =
    replicaStarted &&
    refsReadyForMatch &&
    Boolean(onProjectUpdated && onAlert && onVideoModelChange && onImageModelChange && onPreviewVideo);

  const refSetupApi = useMemo(() => {
    if (!onProjectUpdated) return null;
    return createFilmPullRefSetupApi({
      projectId: project.id,
      getProject: () => project,
      onProjectUpdated: (p) => onProjectUpdated(p),
    });
  }, [onProjectUpdated, project]);

  const showRefPanel =
    replicaStarted && Boolean(refSetupApi) && onAlert && onProjectUpdated;

  const prevRefCatalogRef = useRef<ReturnType<typeof buildMentionCatalogFromFilmPullRefs> | null>(
    null,
  );
  const refSyncBusyRef = useRef(false);

  useEffect(() => {
    prevRefCatalogRef.current = buildMentionCatalogFromFilmPullRefs(project.characterRefs);
  }, [project.id]);

  useEffect(() => {
    if (!onProjectUpdated || !project.productionPlan?.shots.length) {
      prevRefCatalogRef.current = buildMentionCatalogFromFilmPullRefs(project.characterRefs);
      return;
    }
    const newCatalog = buildMentionCatalogFromFilmPullRefs(project.characterRefs);
    const oldCatalog = prevRefCatalogRef.current;
    prevRefCatalogRef.current = newCatalog;
    if (!oldCatalog || refSyncBusyRef.current) return;
    if (mentionCatalogSignature(oldCatalog) === mentionCatalogSignature(newCatalog)) return;

    const syncedShots = syncFilmPullProductionShotsAfterRefChange(
      project.productionPlan.shots,
      oldCatalog,
      newCatalog,
    );
    if (JSON.stringify(syncedShots) === JSON.stringify(project.productionPlan.shots)) return;

    refSyncBusyRef.current = true;
    const productionPlan = buildProductionPlanPatch(project.productionPlan, syncedShots);
    const refMatch = syncRefMatchWithProductionShots(project.refMatch, syncedShots);
    void saveFilmPullProductionPlan(project.id, productionPlan, { refMatch })
      .then((updated) => onProjectUpdated(updated))
      .finally(() => {
        refSyncBusyRef.current = false;
      });
  }, [
    onProjectUpdated,
    project.characterRefs,
    project.id,
    project.productionPlan,
    project.refMatch,
  ]);

  const runScriptPrep = useCallback(async () => {
    if (!onProjectUpdated || !onAlert) return;
    if (analyzing || !hasAnalyze) return;
    setScriptPrepBusy(true);
    setScriptPrepError(null);
    setScriptPrepStep(1);
    try {
      let current = project;
      if (!current.refMatch?.shots.length) {
        setScriptPrepStep(2);
        current = await autoFilmPullRefMatch(project.id, isFilmPullMockDevUiEnabled());
        onProjectUpdated(current);
      }
      if (!current.productionPlan?.shots.length) {
        setScriptPrepStep(3);
        setScriptPrepStep(4);
        current = await assembleFilmPullProductionScript(
          project.id,
          isFilmPullMockDevUiEnabled(),
        );
        onProjectUpdated(current);
      }
      if (current.productionPlan?.shots.length && !current.meta?.productionScriptConfirmedAt) {
        current = await confirmFilmPullProductionScript(project.id);
        onProjectUpdated(current);
      }
      setScriptPrepStep(FILM_PULL_SCRIPT_PREP_STEP_LABELS.length);
    } catch (e) {
      const message = e instanceof Error ? e.message : "请稍后重试";
      setScriptPrepError(message);
      await onAlert({
        title: "制作脚本生成失败",
        message,
        variant: "error",
      });
    } finally {
      setScriptPrepBusy(false);
    }
  }, [analyzing, hasAnalyze, onAlert, onProjectUpdated, project]);

  useEffect(() => {
    setScriptPrepError(null);
  }, [modelRefCount, productRefCount, project.id]);

  useEffect(() => {
    if (!onProjectUpdated || !onAlert || !replicaStarted || !refsReadyForMatch) return;
    if (analyzing || !hasAnalyze) return;
    if (scriptPrepBusy || scriptPrepError || hasProductionPlan) return;
    void runScriptPrep();
  }, [
    analyzing,
    hasAnalyze,
    hasProductionPlan,
    onAlert,
    onProjectUpdated,
    refsReadyForMatch,
    replicaStarted,
    runScriptPrep,
    scriptPrepBusy,
    scriptPrepError,
  ]);

  const showBottomDock = !showProductionWorkspace;

  const mainScroll = (
    <>
      <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">专业拉片</h2>
            <p className="text-[11px] text-[#6e6e73]">上传视频 → 拉片 → 一键复刻 → 制作成片</p>
          </div>
          <EcomIconToolbar>
            <EcomIconToolbarGroup label="项目">
              {onNewProject ? (
                <EcomIconButton
                  label="新建项目"
                  icon={Plus}
                  disabled={jobBusy}
                  onClick={() => void onNewProject()}
                />
              ) : null}
              {loadProjectList && onOpenProject ? (
                <EcomProjectListButton
                  disabled={jobBusy}
                  currentProjectId={project.id}
                  loadProjects={loadProjectList}
                  onSelectProject={onOpenProject}
                  title="专业拉片 · 项目列表"
                  emptyHint="还没有保存过的拉片项目。"
                />
              ) : null}
            </EcomIconToolbarGroup>
            <EcomIconToolbarGroup label="工作流">
              {onSaveProject ? (
                <EcomIconButton
                  label="保存工作流"
                  icon={Save}
                  busy={saveBusy}
                  disabled={!canSave || saveBusy}
                  onClick={() => void onSaveProject()}
                />
              ) : null}
            </EcomIconToolbarGroup>
            <EcomIconToolbarGroup label="资产与交付">
              <EcomIconButton label="我的资产" icon={Images} onClick={() => router.push("/library")} />
              {onExportZip ? (
                <EcomIconButton
                  label={exportBusy ? "打包中…" : "导出交付包"}
                  icon={Download}
                  busy={exportBusy}
                  disabled={!canSave || exportBusy || analyzing}
                  onClick={() => void onExportZip()}
                />
              ) : null}
            </EcomIconToolbarGroup>
            {onShareWorkflow ? (
              <EcomIconToolbarGroup label="分享">
                <EcomShareIconButton disabled={analyzing} onClick={onShareWorkflow} />
              </EcomIconToolbarGroup>
            ) : null}
          </EcomIconToolbar>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        <FilmPullMediaInput
          media={project.media}
          busy={mediaBusy}
          locked={mediaLocked}
          onUploadFile={onUploadFile}
          onImportUrl={onImportUrl}
          onAttachAsset={onAttachAsset}
          onClear={onClearMedia}
        />

        <div className="space-y-2 rounded-xl border border-[#e8e8ed] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex min-w-0 items-center gap-1.5 text-left"
              aria-expanded={promptExpanded}
              onClick={() => setPromptExpanded((v) => !v)}
            >
              <span className="text-sm font-semibold text-[#1d1d1f]">拉片指令</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#6e6e73] transition-transform", promptExpanded && "rotate-180")} />
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={analyzing}
                onClick={() => setPickerOpen(true)}
              >
                <Cpu className="mr-1 h-3.5 w-3.5" />
                {selectedModelLabel}
              </EcomButtonSecondary>
              <EcomButtonPrimary
                size="sm"
                type="button"
                disabled={!project.media?.ossUrl || !prompt.trim() || analyzing || mediaBusy}
                onClick={() => onAnalyze(prompt.trim(), chatModelKey)}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    拉片中…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    拉片
                  </>
                )}
              </EcomButtonPrimary>
              {analyzing && onAbortAnalyze ? (
                <EcomButtonSecondary size="sm" type="button" onClick={() => void onAbortAnalyze()}>
                  <Square className="mr-1 h-3.5 w-3.5" />
                  中止
                </EcomButtonSecondary>
              ) : null}
              {isFilmPullMockDevUiEnabled() && onMockAnalyze ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={!project.media?.ossUrl || analyzing || mediaBusy}
                  title="开发：跳过 Gateway，写入 mock 拉片结果"
                  onClick={() => void onMockAnalyze(prompt.trim())}
                >
                  {analyzing ? "Mock…" : "Mock 拉片"}
                </EcomButtonSecondary>
              ) : null}
            </div>
          </div>
          {promptExpanded ? (
            <textarea
              id="film-pull-prompt"
              value={prompt}
              disabled={analyzing}
              rows={10}
              className="w-full resize-y rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
              onChange={(e) => setPrompt(e.target.value)}
            />
          ) : null}
        </div>

        <StoryboardTaskStatus active={Boolean(analyzing)} title="AI 拉片中" detail="正在调用视觉理解模型，请稍候…" surface="content" />

        {(displaySource || structured) && (
          <div className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#1d1d1f]">拉片结果</h2>
              {canStartReplica && phase === "replica_idle" ? (
                <EcomIconButton
                  label={replicaBusy ? "复刻中…" : "一键复刻"}
                  icon={Clapperboard}
                  variant="accent"
                  busy={replicaBusy}
                  disabled={replicaBusy || mediaBusy}
                  onClick={() => void onStartReplica?.()}
                />
              ) : null}
            </div>
            {parseError && !analyzing ? (
              <p className="rounded-lg border border-[#ffd6d1] bg-[#fff5f3] px-3 py-2 text-sm text-[#c0392b]">{parseError}</p>
            ) : null}
            {structured ? <FilmPullResultPanel structured={structured} /> : markdown ? <StoryboardMarkdownBlock markdown={markdown} /> : null}
          </div>
        )}

        {showRefPanel && refSetupApi ? (
          <ReplicaSetupPanel
            api={refSetupApi}
            copy={FILM_PULL_REF_SETUP_COPY}
            chatModelKey={chatModelKey}
            busy={replicaBusy || mediaBusy || scriptPrepBusy}
            variant={showProductionWorkspace ? "refs-only" : "full"}
            onAlert={onAlert!}
          />
        ) : null}

        {showProductionWorkspace ? (
          <FilmPullProductionWorkspace
            project={project}
            imageModels={imageModels}
            imageModelKey={imageModelKey}
            videoModels={videoModels}
            videoModelKey={videoModelKey}
            onImageModelChange={onImageModelChange!}
            onVideoModelChange={onVideoModelChange!}
            modelsLoading={modelsLoading}
            onRefreshModels={onRefreshModels}
            busy={replicaBusy || mediaBusy}
            prepBusy={scriptPrepBusy}
            prepStep={scriptPrepStep}
            prepError={scriptPrepError}
            onRetryPrep={() => void runScriptPrep()}
            onProjectUpdated={(p) => onProjectUpdated?.(p)}
            onPreviewVideo={onPreviewVideo!}
            onAlert={onAlert!}
          />
        ) : canStartReplica && phase === "replica_idle" ? (
          <div className="shrink-0" data-ecom-no-assistant-collapse>
            <MediaDecomposeReplicaLaunch busy={replicaBusy || mediaBusy} onStart={() => void onStartReplica?.()} />
          </div>
        ) : null}

        {showBottomDock ? <FilmPullReplicaIdleThread mode={bottomDockMode} welcome={filmPullThreadWelcome(bottomDockMode)} /> : null}

        <StoryboardModelPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          nativeOverlay
          mode="image"
          dialogTitle="选择视觉理解模型"
          dialogDescription="拉片须支持视频理解的模型。"
          footerHint="确认后将用于本次拉片。"
          confirmLabel="使用该模型"
          models={eligibleModels}
          modelsLoading={modelsLoading}
          modelsEmptyHint="暂无可用视觉模型。"
          onRetryLoadModels={onRefreshModels}
          value={draftModelKey}
          onChange={setDraftModelKey}
          onConfirm={(key) => {
            onChatModelChange(key);
            setPickerOpen(false);
          }}
        />
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="ecom-scrollbar-overlay min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
        {mainScroll}
      </div>
      {showBottomDock ? (
        <FilmPullReplicaIdleComposer
          mode={bottomDockMode}
          busy={replicaBusy || mediaBusy}
          hint={filmPullBottomDockHint(bottomDockMode)}
          onStartReplica={canStartReplica && phase === "replica_idle" ? () => void onStartReplica?.() : undefined}
        />
      ) : null}
    </div>
  );
}
