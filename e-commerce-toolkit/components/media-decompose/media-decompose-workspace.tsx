"use client";

import { useRouter } from "next/navigation";
import { Clapperboard, Cpu, Download, Images, Loader2, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MediaDecomposeMediaInput } from "@/components/media-decompose/media-decompose-media-input";
import { MediaDecomposeSaveDialog } from "@/components/media-decompose/media-decompose-save-dialog";
import {
  MediaDecomposeReplicaLaunch,
  MediaDecomposeReplicaPanel,
} from "@/components/media-decompose/media-decompose-replica-panel";
import { MediaDecomposeResultPanel } from "@/components/media-decompose/media-decompose-result-panel";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { defaultPromptForKind } from "@/lib/media-decompose-default-prompts";
import {
  downloadMediaDecomposeExportZip,
  saveMediaDecomposeDeliverableSnapshot,
  updateMediaDecomposeProject,
} from "@/lib/ecom-media-decompose-api";
import {
  extractMediaDecomposePatch,
  toMediaDecomposeDisplayMarkdown,
} from "@/lib/media-decompose-structured";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { MediaDecomposeChatModel, MediaDecomposeProject } from "@/lib/media-decompose-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { SeedVideoProject } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

type Props = {
  project: MediaDecomposeProject;
  chatModels: MediaDecomposeChatModel[];
  chatModelKey: string;
  modelsLoading?: boolean;
  mediaBusy?: boolean;
  decomposing?: boolean;
  streamText?: string;
  onChatModelChange: (key: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  onImportUrl: (url: string) => Promise<void>;
  onAttachAsset: (assetId: string) => Promise<void>;
  onClearMedia: () => Promise<void>;
  onDecompose: (prompt: string, modelKey: string) => Promise<void>;
  onRefreshModels?: () => void;
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  replicaSeedVideo?: SeedVideoProject | null;
  replicaBusy?: boolean;
  videoModels?: StoryboardGatewayModel[];
  videoModelKey?: string;
  onVideoModelChange?: (key: string) => void;
  onStartReplica?: () => void | Promise<void>;
  onReplicaProjectChange?: () => void | Promise<void>;
  onPreviewVideo?: (src: string, title?: string) => void;
  onAlert?: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  onProjectUpdated?: (project: MediaDecomposeProject) => void;
};

export function MediaDecomposeWorkspace({
  project,
  chatModels,
  chatModelKey,
  modelsLoading,
  mediaBusy,
  decomposing,
  streamText,
  onChatModelChange,
  onUploadFile,
  onImportUrl,
  onAttachAsset,
  onClearMedia,
  onDecompose,
  onRefreshModels,
  onNewProject,
  loadProjectList,
  onOpenProject,
  replicaSeedVideo,
  replicaBusy,
  videoModels = [],
  videoModelKey = "",
  onVideoModelChange,
  onStartReplica,
  onReplicaProjectChange,
  onPreviewVideo,
  onAlert,
  onProjectUpdated,
}: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(
    project.settings.lastPrompt ?? defaultPromptForKind(project.media?.kind),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftModelKey, setDraftModelKey] = useState(chatModelKey);

  useEffect(() => {
    setPrompt((prev) => {
      if (project.settings.lastPrompt) return project.settings.lastPrompt;
      if (!project.media) return prev;
      return defaultPromptForKind(project.media.kind);
    });
  }, [project.media?.id, project.media?.kind, project.settings.lastPrompt]);

  const eligibleModels = useMemo(() => {
    if (project.media?.kind === "video") {
      return chatModels.filter((m) => m.supportsVideo);
    }
    return chatModels;
  }, [chatModels, project.media?.kind]);

  const displaySource = streamText ?? project.result?.rawText ?? "";
  const structured =
    extractMediaDecomposePatch(displaySource) ?? project.result?.structured ?? null;
  const parseError = project.result?.parseError;
  const markdown = toMediaDecomposeDisplayMarkdown(displaySource, decomposing);

  const selectedModelLabel =
    eligibleModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? chatModelKey;

  const hasResult = Boolean(structured || displaySource.trim());
  const canSave =
    Boolean(project.media) && hasResult && !decomposing && !mediaBusy;
  const canStartReplica = Boolean(onStartReplica) && hasResult && !decomposing;
  const showReplicaPanel = Boolean(
    replicaSeedVideo && onVideoModelChange && onReplicaProjectChange && onPreviewVideo && onAlert,
  );

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  async function flushPromptSettings(): Promise<void> {
    const trimmed = prompt.trim();
    if (
      trimmed === (project.settings.lastPrompt ?? "") &&
      chatModelKey === (project.settings.chatModelKey ?? chatModelKey)
    ) {
      return;
    }
    const updated = await updateMediaDecomposeProject(project.id, {
      settings: { ...project.settings, lastPrompt: trimmed, chatModelKey },
    });
    onProjectUpdated?.(updated);
  }

  async function handleSaveDeliverable(workName: string) {
    if (!onAlert) return;
    setSaveBusy(true);
    try {
      await flushPromptSettings();
      const { project: refreshed } = await saveMediaDecomposeDeliverableSnapshot(
        project.id,
        workName,
      );
      onProjectUpdated?.(refreshed);
      setSaveDialogOpen(false);
      await onAlert({
        title: "已保存到资产库",
        message: "可在「我的资产 → 拆图拆视频」一键复用：换素材后继续拆解或复刻。",
      });
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleExportZip() {
    if (!onAlert) return;
    setExportBusy(true);
    try {
      await flushPromptSettings();
      await downloadMediaDecomposeExportZip(project.id);
    } catch (e) {
      await onAlert({
        title: "导出失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setExportBusy(false);
    }
  }

  const defaultWorkName =
    project.title?.trim() ||
    (project.media?.kind === "video" ? "视频拆解" : project.media ? "图片拆解" : "拆图拆视频");

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
      <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">拆图拆视频</h2>
          <p className="text-[11px] text-[#6e6e73]">
            上传图片或视频，反推分镜拆解或静态画面要素与生图 Prompt。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNewProject ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              dark
              disabled={mediaBusy || decomposing}
              onClick={() => void onNewProject()}
            >
              新建
            </EcomButtonSecondary>
          ) : null}
          {loadProjectList && onOpenProject ? (
            <EcomProjectListButton
              disabled={mediaBusy || decomposing}
              currentProjectId={project.id}
              loadProjects={loadProjectList}
              onSelectProject={onOpenProject}
              title="拆图拆视频 · 项目列表"
              emptyHint="还没有保存过的拆解项目。"
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
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={!canSave || saveBusy}
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save className="h-3.5 w-3.5 shrink-0" />
            保存
          </EcomButtonSecondary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={!canSave || exportBusy || decomposing}
            onClick={() => void handleExportZip()}
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            {exportBusy ? "打包中…" : "导出交付包"}
          </EcomButtonSecondary>
        </div>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
      <MediaDecomposeMediaInput
        media={project.media}
        busy={mediaBusy || decomposing}
        onUploadFile={onUploadFile}
        onImportUrl={onImportUrl}
        onAttachAsset={onAttachAsset}
        onClear={onClearMedia}
      />

      <div className="space-y-2 rounded-xl border border-[#e8e8ed] bg-white p-4">
        <label className="text-sm font-semibold text-[#1d1d1f]" htmlFor="decompose-prompt">
          拆解指令
        </label>
        <textarea
          id="decompose-prompt"
          value={prompt}
          disabled={decomposing}
          rows={10}
          className="w-full resize-y rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={decomposing}
            onClick={() => setPickerOpen(true)}
          >
            <Cpu className="mr-1 h-3.5 w-3.5" />
            {selectedModelLabel}
          </EcomButtonSecondary>
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={!project.media || !prompt.trim() || decomposing || mediaBusy}
            onClick={() => void onDecompose(prompt.trim(), chatModelKey)}
          >
            {decomposing ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                拆解中…
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                拆解
              </>
            )}
          </EcomButtonPrimary>
        </div>
      </div>

      <StoryboardTaskStatus
        active={Boolean(decomposing)}
        title="AI 拆解中"
        detail="正在调用视觉理解模型，请稍候…"
        surface="content"
      />

      {(displaySource || structured) && (
        <div className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">拆解结果</h2>
            {canStartReplica && !showReplicaPanel ? (
              <EcomButtonPrimary
                type="button"
                size="sm"
                disabled={replicaBusy || mediaBusy}
                onClick={() => void onStartReplica?.()}
              >
                {replicaBusy ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    准备中…
                  </>
                ) : (
                  <>
                    <Clapperboard className="mr-1 h-3.5 w-3.5" />
                    一键复刻
                  </>
                )}
              </EcomButtonPrimary>
            ) : null}
          </div>
          {parseError && !decomposing ? (
            <p className="rounded-lg border border-[#ffd6d1] bg-[#fff5f3] px-3 py-2 text-sm text-[#c0392b]">
              {parseError}
            </p>
          ) : null}
          {structured ? (
            <MediaDecomposeResultPanel structured={structured} />
          ) : markdown ? (
            <StoryboardMarkdownBlock markdown={markdown} />
          ) : null}
        </div>
      )}

      {showReplicaPanel ? (
        <MediaDecomposeReplicaPanel
          seedVideo={replicaSeedVideo!}
          videoModels={videoModels}
          videoModelKey={videoModelKey}
          onVideoModelChange={onVideoModelChange!}
          onSeedVideoChange={onReplicaProjectChange!}
          onPreviewVideo={onPreviewVideo!}
          onAlert={onAlert!}
        />
      ) : canStartReplica ? (
        <div className="sticky bottom-4 z-[20] shrink-0">
          <MediaDecomposeReplicaLaunch
            busy={replicaBusy || mediaBusy}
            onStart={() => void onStartReplica?.()}
          />
        </div>
      ) : null}

      <StoryboardModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="image"
        dialogTitle="选择视觉理解模型"
        dialogDescription={
          project.media?.kind === "video"
            ? "拆视频须支持视频理解的模型（Qwen3.8 Max / Qwen3-VL 等）。"
            : "选择支持图片理解的文本模型。"
        }
        footerHint="确认后将用于本次拆解。"
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
      </div>
      </div>

      <MediaDecomposeSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultWorkName={defaultWorkName}
        busy={saveBusy}
        onConfirm={handleSaveDeliverable}
      />
    </div>
  );
}
