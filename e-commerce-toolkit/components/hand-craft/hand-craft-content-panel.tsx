"use client";

import { useRouter } from "next/navigation";
import { Download, Images, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { HandCraftComposePanel } from "@/components/hand-craft/hand-craft-compose-panel";
import { HandCraftRefUploader } from "@/components/hand-craft/hand-craft-ref-uploader";
import { IpMasterPickDialog } from "@/components/ip-master/ip-master-pick-dialog";
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
import { useEcomIpWorkflowStepImageGen } from "@/lib/use-ecom-ip-workflow-step-image-gen";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import {
  downloadHandCraftExportZip,
  generateHandCraftStep,
  getHandCraftProject,
  syncHandCraftProjectPlan,
} from "@/lib/ecom-hand-craft-api";
import { linkIpMasterToHandCraft } from "@/lib/ecom-ip-master-api";
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
import { defaultImageSizeForModel } from "@/lib/storyboard-gen-params";
import {
  filterImageSizeOptionsByEcomRatio,
  imageSizeOptionsForModel,
} from "@/lib/storyboard-image-size-options";
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
  onApplyProject?: (project: HandCraftProject) => void | Promise<void>;
  streaming?: boolean;
  /** 助手点「确认生成第 N 步」时递增，携带目标步骤 */
  generateRequest?: { stepId: HandCraftStepId; token: number } | null;
  focusStepId?: HandCraftStepId | null;
  /** 槽位出图 / 拼版进行中（用于助手隐藏「确认生成」卡片） */
  onMediaBusyChange?: (busy: boolean) => void;
};

function defaultHandCraftImageSize(modelKey: string, ratio: string): string {
  const opts = filterImageSizeOptionsByEcomRatio(
    imageSizeOptionsForModel(modelKey),
    ratio,
  );
  return opts[0]?.value ?? defaultImageSizeForModel(modelKey, "9:16");
}

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
  onApplyProject,
  streaming,
  generateRequest = null,
  focusStepId = null,
  onMediaBusyChange,
}: Props) {
  const router = useRouter();
  const { alert, confirm, toast } = useDialogs();
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draftModelKey, setDraftModelKey] = useState(imageModelKey);
  const [imageSize, setImageSize] = useState(() =>
    defaultHandCraftImageSize(imageModelKey, handCraftStep(currentStepId).ratio),
  );
  const [pendingGen, setPendingGen] = useState<{
    stepId: HandCraftStepId;
    indexes: number[];
  } | null>(null);
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeBusyDetail, setComposeBusyDetail] = useState<string | null>(null);
  const [ipPickOpen, setIpPickOpen] = useState(false);
  const [ipLinkBusy, setIpLinkBusy] = useState(false);
  const handleComposeBusy = useCallback((busy: boolean, detail?: string) => {
    const nextDetail = busy
      ? detail ?? "浏览器正在排版并抓图，请勿关闭页面…"
      : null;
    setComposeBusy((prev) => (prev === busy ? prev : busy));
    setComposeBusyDetail((prev) => (prev === nextDetail ? prev : nextDetail));
  }, []);
  const {
    preview: composeImagePreview,
    openPreview: openComposeImagePreview,
    closePreview: closeComposeImagePreview,
  } = useEcomImagePreview();
  const [galleryPreview, setGalleryPreview] = useState<{
    stepId: HandCraftStepId;
    slotIndex: number;
    items: ProductDesignGalleryPreviewItem[];
    initialIndex: number;
  } | null>(null);
  const [promptFocus, setPromptFocus] = useState<{
    stepId: HandCraftStepId;
    index: number;
  } | null>(null);
  const {
    hasActiveGenJobs,
    runGenerate,
    slotGeneratingFor: slotGeneratingForJob,
  } = useEcomIpWorkflowStepImageGen({
      project,
      projectId: project.id,
      listImageSteps: HAND_CRAFT_STEPS,
      stepState,
      fetchProject: getHandCraftProject,
    generateStep: generateHandCraftStep,
    onProjectChange,
    applyProject: onApplyProject,
    imageGenConcurrencyLimit,
  });

  useEffect(() => setDraftModelKey(imageModelKey), [imageModelKey]);
  useEffect(() => {
    if (!pendingGen) return;
    const ratio = handCraftStep(pendingGen.stepId).ratio;
    setImageSize(defaultHandCraftImageSize(draftModelKey || imageModelKey, ratio));
  }, [draftModelKey, imageModelKey, pendingGen]);

  useEffect(() => {
    if (!focusStepId) return;
    const root = scrollRootRef.current;
    root
      ?.querySelector<HTMLElement>(`#${handCraftStepAnchorId(focusStepId)}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusStepId]);

  useEffect(() => {
    onMediaBusyChange?.(hasActiveGenJobs || composeBusy);
  }, [hasActiveGenJobs, composeBusy, onMediaBusyChange]);

  useEffect(() => {
    setBusy(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 project.id
  }, [project.id]);

  /** 打开/切换项目：从服务端拉最新 plan（含资产库回填），避免内存里空槽与服务端不一致 */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { project: synced } = await syncHandCraftProjectPlan(project.id);
        if (cancelled) return;
        if (onApplyProject) await onApplyProject(synced);
        else await onProjectChange();
      } catch {
        /* 网络失败时保留当前内存态 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, onApplyProject, onProjectChange]);

  const requestGenerate = useCallback(
    async (stepId: HandCraftStepId, indexes: number[]): Promise<boolean> => {
      const meta = handCraftStep(stepId);
      if (meta.kind === "compose") return false;
      if (indexes.length === 0) return false;

      const blocked = missingRequirements(project, stepId);
      if (blocked.length > 0) {
        await alert({
          title: "还不能生成",
          message: `请先完成：${blocked.join("、")}`,
          variant: "error",
        });
        return false;
      }
      if (project.references.length === 0) {
        await alert({
          title: "请先上传线稿",
          message: "本模块以手绘线稿为唯一原型，请先上传线稿再出图。",
          variant: "error",
        });
        return false;
      }
      const ok = await confirm({
        title: `生成 ${indexes.length} 张 · ${meta.label}`,
        message: `将按第 ${meta.no} 步槽位说明出图 ${indexes.length} 张，预计需要几分钟。是否继续？`,
      });
      if (!ok) return false;
      setPendingGen({ stepId, indexes });
      return true;
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
    (stepId: HandCraftStepId, index: number) =>
      slotGeneratingForJob(stepId, index, project),
    [project, slotGeneratingForJob],
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
      setGalleryPreview({ stepId, slotIndex: index, items, initialIndex });
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

  const progress = useMemo(
    () =>
      HAND_CRAFT_STEPS.reduce(
        (acc, s) => acc + doneCount(project, s.id),
        0,
      ),
    [project],
  );

  const canExport = project.references.length > 0 || progress > 0;

  const totalSlots = HAND_CRAFT_STEPS.reduce((acc, s) => acc + s.count, 0);
  const disabledAll = Boolean(streaming) || composeBusy || sketchGenBusy;
  /** 槽位区：不因其它步出图中而整页禁用；本步批量中由 stepBatchActive + 单槽状态控制 */
  const slotWorkspaceDisabled =
    Boolean(streaming) || composeBusy || sketchGenBusy;

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
                {project.title?.trim() || "手办盲盒 SOP"}
              </h2>
              <p className="text-[11px] text-[#6e6e73]">
                线稿转潮玩盲盒 IP 全案 · 10 步 · 已出 {progress}/{totalSlots} 张
                {project.meta?.workflow?.heroLockedUrl ? " · 主形象已定稿" : ""}
                {" · 成图自动入库「我的资产 · 手办盲盒 SOP」"}
              </p>
            </div>
            <EcomIconToolbar>
              <EcomIconToolbarGroup label="项目">
                {onNewProject ? (
                  <EcomIconButton
                    label="新建项目"
                    icon={Plus}
                    disabled={Boolean(busy) || Boolean(refBusy) || disabledAll}
                    onClick={() => void onNewProject()}
                  />
                ) : null}
                {loadProjectList && onOpenProject ? (
                  <EcomProjectListButton
                    disabled={Boolean(busy) || Boolean(refBusy) || disabledAll || Boolean(streaming)}
                    currentProjectId={project.id}
                    loadProjects={loadProjectList}
                    onSelectProject={onOpenProject}
                    title="手办盲盒 SOP · 项目列表"
                    emptyHint="还没有保存过的手办盲盒 SOP项目。"
                  />
                ) : null}
                {onDeleteProject ? (
                  <EcomIconButton
                    label="删除项目"
                    icon={Trash2}
                    variant="destructive"
                    disabled={Boolean(busy) || disabledAll}
                    onClick={() => void onDeleteProject()}
                  />
                ) : null}
              </EcomIconToolbarGroup>
              <EcomIconToolbarGroup label="资产与交付">
                <EcomIconButton
                  label="我的资产"
                  icon={Images}
                  disabled={Boolean(busy)}
                  onClick={() => router.push("/library")}
                />
                <EcomIconButton
                  label="导出交付包"
                  icon={Download}
                  disabled={Boolean(busy) || !canExport}
                  onClick={() => void handleExportZip()}
                />
              </EcomIconToolbarGroup>
            </EcomIconToolbar>
          </div>
        </header>

        <section className="border-b border-[#e8e8ed] px-5 py-4">
          <HandCraftRefUploader
            references={project.references}
            onUpload={onRefUpload}
            onRemove={onRefRemove}
            onAttachAssets={onAttachSketches}
            onGenerateSketch={onGenerateSketch}
            onLinkIpMaster={() => setIpPickOpen(true)}
            busy={Boolean(refBusy) || disabledAll}
            sketchGenBusy={sketchGenBusy}
            uploadProgress={uploadProgress}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-[#6e6e73]">
            成图均以线稿造型为准；第 1 步定稿的主形象会作为后续每步的参考图。
            更换主线稿会重置 10 步产出。
          </p>
        </section>

        {busy ? (
          <StoryboardTaskStatus
            active
            title={busy}
            className="mt-3"
            surface="chrome"
          />
        ) : null}

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
                  onBusyChange={handleComposeBusy}
                  onPreviewImage={(src, title) => openComposeImagePreview(src, title)}
                />
              ) : (
                <HandCraftSlotGrid
                  project={project}
                  step={step}
                  disabled={slotWorkspaceDisabled}
                  onProjectChange={onProjectChange}
                  onApplyProject={onApplyProject}
                  onGenerate={(indexes) => requestGenerate(step.id, indexes)}
                  slotGeneratingFor={(index) => slotGeneratingFor(step.id, index)}
                  openPromptIndex={
                    promptFocus?.stepId === step.id ? promptFocus.index : null
                  }
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
        active={composeBusy}
        title={composeBusyDetail?.includes("加载引用图") ? "拼版加载引用图" : "拼版抓图中"}
        detail={
          composeBusyDetail ??
          "浏览器正在排版并抓图，请勿关闭页面…"
        }
        surface="content"
      />

      {pendingGen ? (
        <StoryboardModelPickerDialog
          open
          nativeOverlay
          onOpenChange={(open) => {
            if (!open) setPendingGen(null);
          }}
          mode="image"
          dialogTitle={`生成 ${pendingGen.indexes.length} 张 · ${handCraftStep(pendingGen.stepId).label}`}
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
          imageSize={imageSize}
          onImageSizeChange={setImageSize}
          lockedImageSizeLabel={`${handCraftStep(pendingGen.stepId).ratio}（由本步版式决定）`}
          confirming={false}
          previewCount={Math.max(1, pendingGen.indexes.length)}
          onConfirm={(modelKey) => {
            const req = pendingGen;
            setPendingGen(null);
            onImageModelChange(modelKey);
            const meta = handCraftStep(req.stepId);
            runGenerate(req.stepId, req.indexes, meta.label, modelKey, imageSize);
          }}
        />
      ) : null}

      <EcomImagePreviewHost
        preview={composeImagePreview}
        onClose={closeComposeImagePreview}
        nativeOverlay
      />

      {galleryPreview?.items.length ? (
        <>
          <ProductDesignGalleryPreviewDialog
            items={galleryPreview.items}
            initialIndex={galleryPreview.initialIndex}
            open
            nativeOverlay
            onOpenChange={(open) => {
              if (!open) setGalleryPreview(null);
            }}
          />
          <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[120] flex justify-center">
            <EcomButtonSecondary
              type="button"
              className="pointer-events-auto shadow-lg"
              onClick={() => {
                setPromptFocus({
                  stepId: galleryPreview.stepId,
                  index: galleryPreview.slotIndex,
                });
                setGalleryPreview(null);
              }}
            >
              编辑 Prompt
            </EcomButtonSecondary>
          </div>
        </>
      ) : null}

      <IpMasterPickDialog
        open={ipPickOpen}
        onOpenChange={setIpPickOpen}
        busy={ipLinkBusy}
        onConfirm={async ({ ipMasterProjectId, version }) => {
          setIpLinkBusy(true);
          try {
            const hadOwnRefs = project.references.some(
              (r) => !r.id.startsWith("ip-master-"),
            );
            const next = await linkIpMasterToHandCraft(
              project.id,
              ipMasterProjectId,
              version,
            );
            if (onApplyProject) await onApplyProject(next);
            else await onProjectChange();
            setIpPickOpen(false);
            toast({
              title: "已载入 IP 母版",
              message: hadOwnRefs
                ? "基准图与 Prompt 约束已更新；若与自上传线稿并存，请以母版或线稿其一为准。"
                : "基准图与 Prompt 约束已写入本项目。",
              variant: "success",
            });
          } catch (e) {
            await alert({
              title: "载入失败",
              message: e instanceof Error ? e.message : "无法链接 IP 母版",
              variant: "error",
            });
          } finally {
            setIpLinkBusy(false);
          }
        }}
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
