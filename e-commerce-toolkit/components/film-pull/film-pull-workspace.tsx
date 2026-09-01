"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Cpu, Download, Images, Loader2, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  FilmPullBottomComposer,
  FilmPullBottomThread,
} from "@/components/film-pull/film-pull-bottom-dock";
import { FilmPullMediaInput } from "@/components/film-pull/film-pull-media-input";
import { FilmPullReplaceSetupPanel } from "@/components/film-pull/film-pull-replace-setup-panel";
import { FilmPullResultPanel } from "@/components/film-pull/film-pull-result-panel";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { defaultFilmPullAnalyzePrompt } from "@/lib/film-pull-default-prompts";
import {
  extractFilmPullAnalyzePatch,
  toFilmPullDisplayMarkdown,
} from "@/lib/film-pull-structured";
import type {
  FilmPullCharacterRef,
  FilmPullPhase,
  FilmPullProject,
  FilmPullShot,
} from "@/lib/film-pull-types";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  project: FilmPullProject;
  phase: FilmPullPhase;
  pendingStep?: FilmPullPhase;
  chatModels: StoryboardGatewayModel[];
  chatModelKey: string;
  videoModels: StoryboardGatewayModel[];
  videoModelKey: string;
  modelsLoading?: boolean;
  mediaBusy?: boolean;
  analyzing?: boolean;
  renderScripting?: boolean;
  streamText?: string;
  shots: FilmPullShot[];
  editedShots: FilmPullShot[] | null;
  onEditedShotsChange: (shots: FilmPullShot[] | null) => void;
  characterRefs: FilmPullCharacterRef[];
  characterDescription: string;
  onCharacterDescriptionChange: (v: string) => void;
  onChatModelChange: (key: string) => void;
  onVideoModelChange: (key: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  onImportUrl: (url: string) => Promise<void>;
  onAttachAsset: (assetId: string) => Promise<void>;
  onClearMedia: () => Promise<void>;
  onUploadCharacter: (file: File) => Promise<void>;
  onAnalyze: (prompt: string, modelKey: string) => void;
  onAbortAnalyze?: () => void;
  onSaveShots?: () => void;
  onRenderScript?: () => void;
  onBatchGenerate?: () => void;
  onFinalRender?: () => void;
  onExportZip?: () => void;
  onSaveProject?: () => void | Promise<void>;
  onRefreshModels?: () => void;
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  onPreviewVideo?: (src: string, title?: string) => void;
  saveBusy?: boolean;
  exportBusy?: boolean;
};

export function FilmPullWorkspace({
  project,
  phase,
  chatModels,
  chatModelKey,
  videoModels,
  videoModelKey,
  modelsLoading,
  mediaBusy,
  analyzing,
  renderScripting,
  streamText,
  shots,
  editedShots,
  onEditedShotsChange,
  characterRefs,
  characterDescription,
  onCharacterDescriptionChange,
  onChatModelChange,
  onVideoModelChange,
  onUploadFile,
  onImportUrl,
  onAttachAsset,
  onClearMedia,
  onUploadCharacter,
  onAnalyze,
  onAbortAnalyze,
  onSaveShots,
  onRenderScript,
  onBatchGenerate,
  onFinalRender,
  onExportZip,
  onSaveProject,
  onRefreshModels,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onPreviewVideo,
  saveBusy,
  exportBusy,
}: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(
    project.settings.lastAnalyzePrompt ?? defaultFilmPullAnalyzePrompt(),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [draftModelKey, setDraftModelKey] = useState(chatModelKey);
  const [draftVideoModelKey, setDraftVideoModelKey] = useState(videoModelKey);
  const [promptExpanded, setPromptExpanded] = useState(false);

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
    extractFilmPullAnalyzePatch(displaySource) ??
    project.analyzeResult?.structured ??
    null;
  const parseError = project.analyzeResult?.parseError;
  const markdown = toFilmPullDisplayMarkdown(displaySource, analyzing);

  const selectedModelLabel =
    eligibleModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? chatModelKey;

  const selectedVideoModelLabel =
    videoModels.find((m) => m.modelKey === videoModelKey)?.displayName ?? videoModelKey;

  const hasResult = Boolean(structured || displaySource.trim());
  const mediaLocked = analyzing || renderScripting;
  const jobBusy = analyzing || renderScripting || mediaBusy;
  const canSave = Boolean(project.media) && hasResult && !jobBusy;
  const finalUrl =
    project.renderPlan?.render?.finalVideoUrl ?? project.meta?.finalVideoUrl ?? null;

  const showPromptCard = phase === "analyze" || phase === "review";

  const mainScroll = (
    <>
      <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">专业拉片</h2>
            <p className="text-[11px] text-[#6e6e73]">
              上传视频，工业化逐镜拉片 · 审校 · 换角 · 合成成片（≤60s）。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onNewProject ? (
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={jobBusy}
                onClick={() => void onNewProject()}
              >
                新建
              </EcomButtonSecondary>
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
            <EcomButtonSecondary
              size="sm"
              type="button"
              dark
              onClick={() => router.push("/library")}
            >
              <Images className="h-3.5 w-3.5 shrink-0" />
              我的资产
            </EcomButtonSecondary>
            {onSaveProject ? (
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={!canSave || saveBusy}
                onClick={() => void onSaveProject()}
              >
                <Save className="h-3.5 w-3.5 shrink-0" />
                保存
              </EcomButtonSecondary>
            ) : null}
            {onExportZip ? (
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={!canSave || exportBusy || analyzing}
                onClick={() => void onExportZip()}
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                {exportBusy ? "打包中…" : "导出交付包"}
              </EcomButtonSecondary>
            ) : null}
          </div>
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

        {showPromptCard ? (
          <div className="space-y-2 rounded-xl border border-[#e8e8ed] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="inline-flex min-w-0 items-center gap-1.5 text-left"
                aria-expanded={promptExpanded}
                onClick={() => setPromptExpanded((v) => !v)}
              >
                <span className="text-sm font-semibold text-[#1d1d1f]">拉片指令</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#6e6e73] transition-transform",
                    promptExpanded && "rotate-180",
                  )}
                  aria-hidden
                />
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
                {analyzing && onAbortAnalyze ? (
                  <EcomButtonSecondary
                    size="sm"
                    type="button"
                    onClick={() => void onAbortAnalyze()}
                  >
                    中止
                  </EcomButtonSecondary>
                ) : null}
                {phase === "analyze" ? (
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
                ) : null}
              </div>
            </div>

            {!promptExpanded && prompt.trim() ? (
              <button
                type="button"
                className="w-full truncate rounded-lg bg-[#f5f5f7] px-3 py-2 text-left text-xs leading-relaxed text-[#6e6e73] hover:bg-[#ececee]"
                onClick={() => setPromptExpanded(true)}
              >
                {prompt.trim().replace(/\s+/g, " ").slice(0, 120)}
                {prompt.trim().length > 120 ? "…" : ""}
              </button>
            ) : null}

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
        ) : null}

        <StoryboardTaskStatus
          active={Boolean(analyzing)}
          title="AI 拉片中"
          detail="正在调用视觉理解模型，请稍候…"
          surface="content"
        />

        {(displaySource || structured) && (phase !== "output" || !finalUrl) ? (
          <div className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">拉片结果</h2>
            {parseError && !analyzing ? (
              <p className="rounded-lg border border-[#ffd6d1] bg-[#fff5f3] px-3 py-2 text-sm text-[#c0392b]">
                {parseError}
              </p>
            ) : null}
            {structured ? (
              <FilmPullResultPanel
                structured={structured}
                shots={phase === "review" ? (editedShots ?? shots) : shots}
                editable={phase === "review"}
                onShotsChange={(next) => onEditedShotsChange(next)}
              />
            ) : markdown ? (
              <StoryboardMarkdownBlock markdown={markdown} />
            ) : null}
          </div>
        ) : null}

        {phase === "replace" || phase === "output" ? (
          <FilmPullReplaceSetupPanel
            characterRefs={characterRefs}
            characterDescription={characterDescription}
            onCharacterDescriptionChange={onCharacterDescriptionChange}
            onUploadCharacter={onUploadCharacter}
            busy={jobBusy}
          />
        ) : null}

        {project.renderPlan?.shots.some((s) => s.videoUrl) ? (
          <div className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">逐镜预览</h2>
            <div className="flex gap-2 overflow-x-auto">
              {project.renderPlan!.shots
                .filter((s) => s.videoUrl)
                .map((s) => (
                  <button
                    key={s.shotNo}
                    type="button"
                    className="shrink-0 rounded-lg border border-[#e8e8ed] p-1"
                    onClick={() => onPreviewVideo?.(s.videoUrl!, `镜 ${s.shotNo}`)}
                  >
                    <video
                      src={s.videoUrl}
                      className="h-20 w-32 rounded object-cover"
                      muted
                    />
                    <p className="mt-1 text-center text-[10px]">镜 {s.shotNo}</p>
                  </button>
                ))}
            </div>
          </div>
        ) : null}

        {finalUrl ? (
          <div className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">成片</h2>
            <button
              type="button"
              onClick={() => onPreviewVideo?.(finalUrl, "合成成片")}
            >
              <video src={finalUrl} className="max-h-64 rounded-lg" controls muted />
            </button>
          </div>
        ) : phase === "output" ? (
          <div className="rounded-xl border border-[#e8e8ed] bg-white p-4">
            <p className="text-sm text-[#6e6e73]">完成逐镜出镜后，可在底部合成最终成片。</p>
          </div>
        ) : null}

        <FilmPullBottomThread phase={phase} hasResult={hasResult} />

        <StoryboardModelPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          mode="image"
          dialogTitle="选择视觉理解模型"
          dialogDescription="拉片须支持视频理解的模型（Qwen3.8 Max / Qwen3-VL 等）。"
          footerHint="确认后将用于本次拉片。"
          confirmLabel="使用该模型"
          models={eligibleModels}
          modelsLoading={modelsLoading}
          modelsEmptyHint="暂无可用视觉模型，请检查 Gateway 凭证。"
          onRetryLoadModels={onRefreshModels}
          value={draftModelKey}
          onChange={setDraftModelKey}
          onConfirm={(key) => {
            onChatModelChange(key);
            setPickerOpen(false);
          }}
        />

        <StoryboardModelPickerDialog
          open={videoPickerOpen}
          onOpenChange={setVideoPickerOpen}
          mode="video"
          videoTarget="panel"
          dialogTitle="选择出镜视频模型"
          confirmLabel="使用该模型"
          models={videoModels}
          modelsLoading={modelsLoading}
          value={draftVideoModelKey}
          onChange={setDraftVideoModelKey}
          onConfirm={(key) => {
            onVideoModelChange(key);
            setVideoPickerOpen(false);
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
      <FilmPullBottomComposer
        phase={phase}
        busy={jobBusy}
        analyzing={analyzing}
        renderScripting={renderScripting}
        videoModelLabel={selectedVideoModelLabel}
        onPickVideoModel={() => setVideoPickerOpen(true)}
        onAbortAnalyze={onAbortAnalyze}
        onSaveShots={onSaveShots}
        onRenderScript={onRenderScript}
        onBatchGenerate={onBatchGenerate}
        onFinalRender={onFinalRender}
        onExportZip={onExportZip}
      />
    </div>
  );
}
