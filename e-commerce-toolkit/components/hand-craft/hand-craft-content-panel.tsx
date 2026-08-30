"use client";

import { useRouter } from "next/navigation";
import { Download, Images, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { HandCraftComposePanel } from "@/components/hand-craft/hand-craft-compose-panel";
import { HandCraftRefUploader } from "@/components/hand-craft/hand-craft-ref-uploader";
import { HandCraftSaveDialog } from "@/components/hand-craft/hand-craft-save-dialog";
import { HandCraftSlotGrid } from "@/components/hand-craft/hand-craft-slot-grid";
import {
  EcomImagePreviewHost,
  useEcomImagePreview,
} from "@/components/media";
import {
  ProductDesignGalleryPreviewDialog,
  type ProductDesignGalleryPreviewItem,
} from "@/components/product-design/product-design-gallery-preview-dialog";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  downloadHandCraftExportZip,
  generateHandCraftStep,
  getHandCraftProject,
  saveHandCraftWorkflow,
} from "@/lib/ecom-hand-craft-api";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { HandCraftProject, HandCraftStepId } from "@/lib/hand-craft-types";
import {
  doneCount,
  handCraftStep,
  HAND_CRAFT_STEPS,
  missingRequirements,
  stepState,
} from "@/lib/hand-craft-workflow";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

export function handCraftStepAnchorId(stepId: HandCraftStepId): string {
  return `hand-craft-step-${stepId}`;
}

type Props = {
  project: HandCraftProject;
  currentStepId: HandCraftStepId;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  onImageModelChange: (key: string) => void;
  modelsLoading?: boolean;
  modelsLoadError?: string | null;
  onRefreshModels?: () => void | Promise<void>;
  imageGenConcurrencyLimit?: number;
  onRefUpload: (file: File) => Promise<void>;
  onRefRemove: (refId: string) => void | Promise<void>;
  onAttachSketches?: (assetIds: string[]) => Promise<void>;
  onGenerateSketch?: (prompt: string) => Promise<void>;
  refBusy?: boolean;
  sketchGenBusy?: boolean;
  uploadProgress?: number | null;
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  onDeleteProject?: () => void | Promise<void>;
  onProjectChange: () => void | Promise<void>;
  streaming?: boolean;
  /** 助手点「确认生成第 N 步」时递增，携带目标步骤 */
  generateRequest?: { stepId: HandCraftStepId; token: number } | null;
  focusStepId?: HandCraftStepId | null;
};

export function HandCraftContentPanel({
  project,
  currentStepId,
  imageModels,
  imageModelKey,
  onImageModelChange,
  modelsLoading = false,
  modelsLoadError = null,
  onRefreshModels,
  imageGenConcurrencyLimit = 1,
  onRefUpload,
  onRefRemove,
  onAttachSketches,
  onGenerateSketch,
  refBusy,
  sketchGenBusy = false,
  uploadProgress = null,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onDeleteProject,
  onProjectChange,
  streaming,
  generateRequest = null,
  focusStepId = null,
}: Props) {
  const router = useRouter();
  const { alert, confirm } = useDialogs();
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draftModelKey, setDraftModelKey] = useState(imageModelKey);
  const [pendingGen, setPendingGen] = useState<{
    stepId: HandCraftStepId;
    indexes: number[];
  } | null>(null);
  const [generating, setGenerating] = useState<{
    stepId: HandCraftStepId;
    indexes: number[];
  } | null>(null);
  const [composeBusy, setComposeBusy] = useState(false);
  const {
    preview: composeImagePreview,
    openPreview: openComposeImagePreview,
    closePreview: closeComposeImagePreview,
  } = useEcomImagePreview();
  const [galleryPreview, setGalleryPreview] = useState<{
    items: ProductDesignGalleryPreviewItem[];
    initialIndex: number;
  } | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const genPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setDraftModelKey(imageModelKey), [imageModelKey]);

  useEffect(
    () => () => {
      if (genPollRef.current) clearInterval(genPollRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!focusStepId) return;
    const root = scrollRootRef.current;
    root
      ?.querySelector<HTMLElement>(`#${handCraftStepAnchorId(focusStepId)}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusStepId]);

  const stopGenPoll = useCallback(() => {
    if (genPollRef.current) {
      clearInterval(genPollRef.current);
      genPollRef.current = null;
    }
  }, []);

  /** 出图期间 2.5s 轮询：单张成图即时上墙，不必等整批返回 */
  const startGenPoll = useCallback(
    (stepId: HandCraftStepId, indexes: number[]) => {
      stopGenPoll();
      genPollRef.current = setInterval(() => {
        void getHandCraftProject(project.id)
          .then((refreshed) => {
            void onProjectChange();
            const slots = stepState(refreshed, stepId).slots;
            if (slots.length === 0) return;
            const pending = indexes.filter(
              (i) => !slots.find((s) => s.index === i)?.imageUrl,
            );
            if (pending.length === 0) stopGenPoll();
          })
          .catch(() => undefined);
      }, 2500);
    },
    [onProjectChange, project.id, stopGenPoll],
  );

  useEffect(() => {
    if (generating) return;
    for (const step of HAND_CRAFT_STEPS) {
      if (step.kind === "compose") continue;
      const state = stepState(project, step.id);
      if (state.status !== "generating") continue;
      const pending = state.slots.filter((s) => !s.imageUrl).map((s) => s.index);
      if (pending.length === 0) continue;
      setGenerating({ stepId: step.id, indexes: pending });
      setBusy(`${step.label} 生成中…`);
      startGenPoll(step.id, pending);
      break;
    }
  }, [generating, project, project.id, startGenPoll]);

  const runGenerate = useCallback(
    async (stepId: HandCraftStepId, indexes: number[], modelKey: string) => {
      const meta = handCraftStep(stepId);
      setGenerating({ stepId, indexes });
      setBusy(
        indexes.length === 1
          ? `${meta.label} 第 ${indexes[0]} 张生成中`
          : `${meta.label} 生成中（共 ${indexes.length} 张）`,
      );
      startGenPoll(stepId, indexes);

      let generated = 0;
      const failures: Array<{ index: number; message: string }> = [];
      try {
        const result = await generateHandCraftStep({
          projectId: project.id,
          stepId,
          indexes,
          modelKey,
          concurrency: Math.max(1, Math.min(5, imageGenConcurrencyLimit)),
        });
        generated = result.generated;
        failures.push(...result.failures);
      } catch (e) {
        for (const index of indexes) {
          failures.push({
            index,
            message: e instanceof Error ? e.message : "生成失败",
          });
        }
      } finally {
        stopGenPoll();
        setGenerating(null);
        setBusy(null);
        await onProjectChange();
      }

      if (failures.length > 0) {
        await alert({
          title:
            generated > 0
              ? `${generated} 张已生成，${failures.length} 张失败`
              : `${meta.label}生成失败`,
          message: failures.map((f) => `第 ${f.index} 张：${f.message}`).join("\n"),
          variant: "error",
        });
      }
    },
    [
      alert,
      imageGenConcurrencyLimit,
      onProjectChange,
      project.id,
      startGenPoll,
      stopGenPoll,
    ],
  );

  const requestGenerate = useCallback(
    async (stepId: HandCraftStepId, indexes: number[]) => {
      const meta = handCraftStep(stepId);
      if (meta.kind === "compose") return;
      if (indexes.length === 0) return;

      const blocked = missingRequirements(project, stepId);
      if (blocked.length > 0) {
        await alert({
          title: "还不能生成",
          message: `请先完成：${blocked.join("、")}`,
          variant: "error",
        });
        return;
      }
      if (project.references.length === 0) {
        await alert({
          title: "请先上传线稿",
          message: "本模块以手绘线稿为唯一原型，请先上传线稿再出图。",
          variant: "error",
        });
        return;
      }
      const ok = await confirm({
        title: `生成 ${indexes.length} 张 · ${meta.label}`,
        message: `将按第 ${meta.no} 步槽位说明出图 ${indexes.length} 张，预计需要几分钟。是否继续？`,
      });
      if (!ok) return;
      setPendingGen({ stepId, indexes });
    },
    [alert, confirm, project],
  );

  // 助手确认后：generate 步出图；compose 步滚到区块并触发 html2canvas 拼版
  const genTokenRef = useRef(generateRequest?.token ?? 0);
  useEffect(() => {
    if (!generateRequest || generateRequest.token === genTokenRef.current) return;
    genTokenRef.current = generateRequest.token;
    const meta = handCraftStep(generateRequest.stepId);
    scrollRootRef.current
      ?.querySelector<HTMLElement>(`#${handCraftStepAnchorId(generateRequest.stepId)}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (meta.kind === "compose") return;
    const state = stepState(project, generateRequest.stepId);
    const pending = state.slots.filter((s) => !s.imageUrl).map((s) => s.index);
    const indexes =
      pending.length > 0
        ? pending
        : state.slots.length > 0
          ? state.slots.map((s) => s.index)
          : Array.from({ length: meta.count }, (_, i) => i + 1);
    void requestGenerate(generateRequest.stepId, indexes);
  }, [generateRequest, project, requestGenerate]);

  const slotGeneratingFor = useCallback(
    (stepId: HandCraftStepId, index: number) => {
      if (!generating || generating.stepId !== stepId) return false;
      return generating.indexes.includes(index);
    },
    [generating],
  );

  const openStepPreview = useCallback(
    (stepId: HandCraftStepId, index: number) => {
      const meta = handCraftStep(stepId);
      const state = stepState(project, stepId);
      const items: ProductDesignGalleryPreviewItem[] = state.slots
        .filter((s) => s.imageUrl)
        .map((s) => ({
          url: s.imageUrl!,
          title: `${meta.label} ${s.index} · ${s.title}`,
          ratio: meta.ratio,
          downloadFilename: `${meta.label}-${s.index}-${s.title.slice(0, 12)}.png`,
        }));
      if (items.length === 0) return;
      const at = state.slots.find((s) => s.index === index)?.imageUrl;
      const initialIndex = Math.max(
        0,
        items.findIndex((i) => i.url === at),
      );
      setGalleryPreview({ items, initialIndex });
    },
    [project],
  );

  async function handleExportZip() {
    setBusy("正在打包交付包…");
    try {
      await downloadHandCraftExportZip(project.id);
    } catch (e) {
      await alert({
        title: "导出失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveWorkflow(ipName: string) {
    setBusy("正在保存到资产库…");
    try {
      const snapshot = await saveHandCraftWorkflow(project.id, ipName);
      setSaveDialogOpen(false);
      await alert({
        title: "已保存到资产库",
        message: `「${snapshot.title}」已保存。可在「我的资产 · 手伴创作」一键复用。`,
      });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  const progress = useMemo(
    () =>
      HAND_CRAFT_STEPS.reduce(
        (acc, s) => acc + doneCount(project, s.id),
        0,
      ),
    [project],
  );

  const defaultSaveIpName = project.title?.trim() || "手伴IP";
  const canSave = project.references.length > 0 || progress > 0;

  const totalSlots = HAND_CRAFT_STEPS.reduce((acc, s) => acc + s.count, 0);
  const disabledAll = Boolean(streaming) || Boolean(generating) || composeBusy || sketchGenBusy;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div
        ref={scrollRootRef}
        className="ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]"
      >
        <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">
                {project.title?.trim() || "手伴创作"}
              </h2>
              <p className="text-[11px] text-[#6e6e73]">
                线稿转潮玩盲盒 IP 全案 · 10 步 · 已出 {progress}/{totalSlots} 张
                {project.meta?.workflow?.heroLockedUrl ? " · 主形象已定稿" : ""}
                {" · 成图自动入库「我的资产 · 手伴创作」"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onNewProject ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  dark
                  disabled={Boolean(busy) || Boolean(refBusy) || disabledAll}
                  onClick={() => void onNewProject()}
                >
                  新建
                </EcomButtonSecondary>
              ) : null}
              {loadProjectList && onOpenProject ? (
                <EcomProjectListButton
                  disabled={Boolean(busy) || Boolean(refBusy) || disabledAll || Boolean(streaming)}
                  currentProjectId={project.id}
                  loadProjects={loadProjectList}
                  onSelectProject={onOpenProject}
                  title="手伴创作 · 项目列表"
                  emptyHint="还没有保存过的手伴创作项目。"
                />
              ) : null}
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={Boolean(busy)}
                onClick={() => router.push("/library")}
              >
                <Images className="h-3.5 w-3.5 shrink-0" />
                我的资产
              </EcomButtonSecondary>
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={Boolean(busy) || !canSave || disabledAll}
                onClick={() => setSaveDialogOpen(true)}
              >
                <Save className="h-3.5 w-3.5 shrink-0" />
                保存
              </EcomButtonSecondary>
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={Boolean(busy) || progress === 0}
                onClick={() => void handleExportZip()}
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                导出交付包
              </EcomButtonSecondary>
              {onDeleteProject ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  dark
                  disabled={Boolean(busy) || disabledAll}
                  onClick={() => void onDeleteProject()}
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  删除项目
                </EcomButtonSecondary>
              ) : null}
            </div>
          </div>
        </header>

        <section className="border-b border-[#e8e8ed] px-5 py-4">
          <HandCraftRefUploader
            references={project.references}
            onUpload={onRefUpload}
            onRemove={onRefRemove}
            onAttachAssets={onAttachSketches}
            onGenerateSketch={onGenerateSketch}
            busy={Boolean(refBusy) || disabledAll}
            sketchGenBusy={sketchGenBusy}
            uploadProgress={uploadProgress}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-[#6e6e73]">
            成图均以线稿造型为准；第 1 步定稿的主形象会作为后续每步的参考图。
            更换主线稿会重置 10 步产出。
          </p>
        </section>

        <StoryboardTaskStatus
          active={Boolean(busy) || sketchGenBusy}
          title={sketchGenBusy ? "AI 生成线稿中" : busy ?? ""}
          className="mt-3"
          surface="chrome"
        />

        <div className="space-y-4 px-5 py-4">
          {HAND_CRAFT_STEPS.map((step) => (
            <div
              key={step.id}
              className={cn(
                "rounded-xl",
                step.id === currentStepId &&
                  "ring-1 ring-[var(--ecom-chrome-accent)] ring-offset-2",
              )}
            >
              {step.kind === "compose" ? (
                <HandCraftComposePanel
                  project={project}
                  step={step}
                  disabled={disabledAll}
                  onProjectChange={onProjectChange}
                  composeRequest={
                    generateRequest?.stepId === step.id ? generateRequest : null
                  }
                  onBusyChange={setComposeBusy}
                  onPreviewImage={(src, title) => openComposeImagePreview(src, title)}
                />
              ) : (
                <HandCraftSlotGrid
                  project={project}
                  step={step}
                  disabled={disabledAll}
                  onProjectChange={onProjectChange}
                  onGenerate={(indexes) => void requestGenerate(step.id, indexes)}
                  slotGeneratingFor={(index) => slotGeneratingFor(step.id, index)}
                  onPreview={(index) => openStepPreview(step.id, index)}
                  onDownload={(index) => {
                    const slot = stepState(project, step.id).slots.find(
                      (s) => s.index === index,
                    );
                    if (!slot?.imageUrl) return;
                    downloadImageFile(
                      slot.imageUrl,
                      `${step.label}-${index}-${slot.title.slice(0, 12)}.png`,
                    );
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <StoryboardTaskStatus
        active={Boolean(generating) || composeBusy}
        title={composeBusy ? "拼版抓图中" : "AI 出图中"}
        detail={
          composeBusy
            ? "浏览器正在排版并抓图，请勿关闭页面…"
            : busy ?? "正在调用 Gateway 生图模型，请稍候…"
        }
        surface="content"
      />

      <StoryboardModelPickerDialog
        open={Boolean(pendingGen)}
        onOpenChange={(open) => {
          if (!open) setPendingGen(null);
        }}
        mode="image"
        dialogTitle={
          pendingGen
            ? `生成 ${pendingGen.indexes.length} 张 · ${handCraftStep(pendingGen.stepId).label}`
            : undefined
        }
        dialogDescription="仅列出支持参考图的生图模型：本模块要靠主形象参考图锁定五官与配饰。"
        footerHint="选好模型后开始出图。"
        models={imageModels}
        modelsLoading={modelsLoading}
        modelsEmptyHint={
          modelsLoadError ??
          "暂无支持参考图的生图模型。平台代付用户请联系管理员在 Gateway 上架 IMAGE 模型；自付用户请先在 Gateway 绑定厂商凭证。"
        }
        onRetryLoadModels={onRefreshModels}
        value={draftModelKey}
        onChange={setDraftModelKey}
        lockedImageSizeLabel={
          pendingGen
            ? `${handCraftStep(pendingGen.stepId).ratio}（由本步版式决定）`
            : undefined
        }
        confirming={Boolean(generating)}
        onConfirm={(modelKey) => {
          const req = pendingGen;
          if (!req) return;
          setPendingGen(null);
          onImageModelChange(modelKey);
          void runGenerate(req.stepId, req.indexes, modelKey);
        }}
      />

      <EcomImagePreviewHost
        preview={composeImagePreview}
        onClose={closeComposeImagePreview}
      />

      <ProductDesignGalleryPreviewDialog
        items={galleryPreview?.items ?? []}
        initialIndex={galleryPreview?.initialIndex ?? 0}
        open={Boolean(galleryPreview?.items.length)}
        onOpenChange={(open) => {
          if (!open) setGalleryPreview(null);
        }}
      />

      <HandCraftSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultIpName={defaultSaveIpName}
        busy={Boolean(busy)}
        onConfirm={handleSaveWorkflow}
      />
    </div>
  );
}

function downloadImageFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w\u4e00-\u9fff.-]+/g, "_");
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
