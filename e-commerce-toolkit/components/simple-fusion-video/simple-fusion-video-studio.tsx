"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Download, Images, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { BackgroundGenerationProvider } from "@/components/generation";
import { EcomGlobalAssetLibraryToolbarButton } from "@/components/global-asset-library/ecom-global-asset-library-toolbar-button";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";

import { SimpleFusionProgressRail } from "@/components/simple-fusion-video/simple-fusion-progress-rail";
import { SimpleFusionRefUploadSection } from "@/components/simple-fusion-video/simple-fusion-ref-upload-section";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { SimpleFusionVideoSlotHoverActions } from "@/components/simple-fusion-video/simple-fusion-video-slot-hover-actions";
import { VtonResultImageHoverActions } from "@/components/vton/vton-result-image-hover-actions";
import { EcomWorkspaceResultFrame } from "@/components/media/ecom-workspace-result-frame";
import {
  ECOM_WORKSPACE_RESULT_COLUMN_CLASS,
  ECOM_WORKSPACE_RESULT_GRID_CLASS,
  ECOM_WORKSPACE_RESULT_LABEL_CLASS,
  ecomWorkspaceResultShellClass,
} from "@/lib/ecom-workspace-result-grid";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import {
  EcomCatalogPickerDialog,
  type CatalogPickerEntry,
} from "@/components/model-shot/ecom-catalog-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { fetchStoryboardModels } from "@/lib/ecom-storyboard-api";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import {
  SIMPLE_FUSION_DEFAULT_FUSION_MODEL,
  SIMPLE_FUSION_DEFAULT_VIDEO_MODEL,
} from "@/lib/simple-fusion-model-defaults";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { SimpleFusionComposeWorkbench } from "@/components/simple-fusion-video/simple-fusion-compose-workbench";
import {
  createSimpleFusionProject,
  generateSimpleFusionModel,
  getSimpleFusionProject,
  listSimpleFusionProjects,
  patchSimpleFusionProject,
  runSimpleFusionGenerate,
  saveSimpleFusionSnapshot,
  uploadSimpleFusionMedia,
  type SimpleFusionProject,
} from "@/lib/ecom-simple-fusion-video-api";
import { resumeOrCreateEcomProject, writeEcomLastProjectId } from "@/lib/ecom-last-project";
import { fetchEcomSceneLibraryCatalog } from "@/lib/ecom-scene-library-api";
import { sceneToCatalogPickerEntry } from "@/lib/ecom-scene-library/picker";
import type { EcomSceneLibraryEntry } from "@/lib/ecom-scene-library/types";
import { PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS } from "@/lib/product-design-prompt-mention-ui";
import {
  buildSimpleFusionMentionRefs,
  buildSimpleFusionVideoMentionRefs,
} from "@/lib/simple-fusion-mention-refs";
import { resolveSimpleFusionPromptsForProject } from "@/lib/simple-fusion-resolve-prompts";
import { moduleToVariant, SIMPLE_FUSION_BGM_PRESETS } from "@/lib/simple-fusion-default-prompts";
import { cn } from "@/lib/utils";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import { mapPreviewItemsFromEntries } from "@/lib/media/ecom-image-preview";
import {
  buildSimpleFusionPreviewSlots,
  simpleFusionSlotFusionGenerating,
  simpleFusionSlotVideoGenerating,
} from "@/lib/simple-fusion-preview-slots";
import {
  simpleFusionAllClipsReady,
  simpleFusionAllFusionsReady,
} from "@/lib/simple-fusion-workflow";

const DEFAULT_MODEL_AI_PROMPT =
  "全身时尚模特，自然妆容与发型，中性灰摄影棚背景，电商 lookbook 全身照，柔和均匀光，高清无水印";

const SIMPLE_FUSION_DEFAULT_PANEL_DURATION_SEC = 6;

const MODULE_COPY: Record<
  string,
  { title: string; subtitle: string; storageKey: string; garmentMulti: boolean }
> = {
  "video-camera": {
    title: "视频运镜",
    subtitle: "融合静态图 + 图生视频 · 商业运镜展示",
    storageKey: "ecom-simple-fusion-camera",
    garmentMulti: false,
  },
  "video-mirror-selfie": {
    title: "户外对镜自拍",
    subtitle: "镜前 OOTD · 6 秒竖屏种草",
    storageKey: "ecom-simple-fusion-mirror",
    garmentMulti: false,
  },
  "video-dance-swap": {
    title: "卡点跳舞换装",
    subtitle: "2～6 套服装 · 近似卡点拼接成片",
    storageKey: "ecom-simple-fusion-dance",
    garmentMulti: true,
  },
};

export function SimpleFusionVideoStudio({ moduleId }: { moduleId: string }) {
  const copy = MODULE_COPY[moduleId] ?? MODULE_COPY["video-camera"]!;
  return (
    <BackgroundGenerationProvider>
      <SimpleFusionVideoStudioInner moduleId={moduleId} copy={copy} />
    </BackgroundGenerationProvider>
  );
}

function SimpleFusionVideoStudioInner({
  moduleId,
  copy,
}: {
  moduleId: string;
  copy: (typeof MODULE_COPY)[string];
}) {
  const router = useRouter();
  const { alert, toast, confirm } = useDialogs();
  const [project, setProject] = useState<SimpleFusionProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regeneratingLookIds, setRegeneratingLookIds] = useState<Set<string>>(() => new Set());
  /** 点击「合成卡点成片」后立即展示扫光，不等待 createMediaRenderJob 返回 */
  const [composeRenderPending, setComposeRenderPending] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );

  const [fusionDraft, setFusionDraft] = useState("");
  const [videoDraft, setVideoDraft] = useState("");
  const [negativeDraft, setNegativeDraft] = useState("");
  const [modelPrompt, setModelPrompt] = useState("");
  const [scenePrompt, setScenePrompt] = useState("");

  const [modelLibraryOpen, setModelLibraryOpen] = useState(false);
  const [sceneCatalogOpen, setSceneCatalogOpen] = useState(false);
  const [assetPicker, setAssetPicker] = useState<"model" | "scene" | "garment" | null>(null);
  const [sceneCatalog, setSceneCatalog] = useState<EcomSceneLibraryEntry[]>([]);
  const [modelGenBusy, setModelGenBusy] = useState(false);
  const [aiDialogRole, setAiDialogRole] = useState<"model" | "scene" | null>(null);
  const [aiDialogDraft, setAiDialogDraft] = useState("");

  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [videoModels, setVideoModels] = useState<StoryboardGatewayModel[]>([]);
  const [fusionModelKey, setFusionModelKey] = useState(SIMPLE_FUSION_DEFAULT_FUSION_MODEL);
  const [videoModelKey, setVideoModelKey] = useState(
    () => SIMPLE_FUSION_DEFAULT_VIDEO_MODEL[moduleToVariant(moduleId)],
  );
  const [panelDurationSec, setPanelDurationSec] = useState(
    SIMPLE_FUSION_DEFAULT_PANEL_DURATION_SEC,
  );
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [fusionPickerOpen, setFusionPickerOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const pendingPipelineStepRef = useRef<"fusion" | "video" | "fusion_then_video" | null>(null);
  const openingVideoAfterFusionRef = useRef(false);
  /** 正在编辑 Prompt 时勿被 applyProject 覆盖对应草稿 */
  const focusedPromptFieldRef = useRef<"fusion" | "video" | "negative" | null>(null);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsLoadError(null);
    try {
      const payload = await fetchStoryboardModels();
      setImageModels(payload.imageModels);
      setVideoModels(payload.videoModels);
      const variant = moduleToVariant(moduleId);
      setFusionModelKey((prev) =>
        pickBoundStoryboardModelKey(payload.imageModels, prev || SIMPLE_FUSION_DEFAULT_FUSION_MODEL),
      );
      setVideoModelKey((prev) =>
        pickBoundStoryboardModelKey(
          payload.videoModels,
          prev || SIMPLE_FUSION_DEFAULT_VIDEO_MODEL[variant],
        ),
      );
    } catch (e) {
      setModelsLoadError(e instanceof Error ? e.message : "模型列表加载失败");
    } finally {
      setModelsLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const applyProject = useCallback(
    (p: SimpleFusionProject, opts?: { skipAutoPersist?: boolean }) => {
      setProject(p);
      writeEcomLastProjectId(copy.storageKey, p.id);
      const prompts = resolveSimpleFusionPromptsForProject(p, {
        garmentMulti: copy.garmentMulti,
      });
      const focused = focusedPromptFieldRef.current;
      if (focused !== "fusion") setFusionDraft(prompts.fusion);
      if (focused !== "video") setVideoDraft(prompts.video);
      if (focused !== "negative") setNegativeDraft(prompts.negative);
      setScenePrompt(p.references.scene?.scenePrompt?.trim() ?? "");
      if (p.settings.fusionModelKey?.trim()) {
        setFusionModelKey(p.settings.fusionModelKey.trim());
      }
      if (p.settings.videoModelKey?.trim()) {
        setVideoModelKey(p.settings.videoModelKey.trim());
      }
      if (
        p.settings.panelDurationSec != null &&
        Number.isFinite(p.settings.panelDurationSec)
      ) {
        setPanelDurationSec(
          Math.min(15, Math.max(3, Math.round(p.settings.panelDurationSec))),
        );
      }

      if (opts?.skipAutoPersist) return;

      const stored = p.meta?.prompts ?? {};
      const needsFusionSync =
        p.meta?.promptsCustomized !== true &&
        (stored.fusion?.trim() !== prompts.fusion.trim() ||
          stored.negative?.trim() !== prompts.negative.trim());
      const needsVideoSync =
        p.meta?.videoPromptCustomized !== true &&
        stored.video?.trim() !== prompts.video.trim();
      if (!needsFusionSync && !needsVideoSync) return;

      void patchSimpleFusionProject(p.id, {
        meta: {
          ...p.meta,
          prompts,
          promptsCustomized: p.meta?.promptsCustomized === true,
          videoPromptCustomized: p.meta?.videoPromptCustomized === true,
        },
      })
        .then((next) => applyProject(next, { skipAutoPersist: true }))
        .catch(() => undefined);
    },
    [copy.garmentMulti, copy.storageKey],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const { project: p } = await resumeOrCreateEcomProject({
        storageKey: copy.storageKey,
        getById: getSimpleFusionProject,
        listRecentIds: async () => {
          const items = await listSimpleFusionProjects(moduleId);
          return items.map((i) => i.id);
        },
        create: () => createSimpleFusionProject(moduleId),
      });
      applyProject(p);
    } catch (e) {
      if (isEcomUnauthorizedError(e)) setNeedLogin(true);
      else await alert({ title: "加载失败", message: e instanceof Error ? e.message : "请稍后重试", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [alert, applyProject, copy.storageKey, moduleId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!project || project.phase !== "rendering") return;
    const t = setInterval(() => {
      void getSimpleFusionProject(project.id)
        .then(applyProject)
        .catch(() => undefined);
    }, 2500);
    return () => clearInterval(t);
  }, [project, applyProject]);

  useEffect(() => {
    if (project?.phase === "done" || project?.phase === "render_failed") {
      setComposeRenderPending(false);
    }
  }, [project?.phase]);

  const finalVideoUrl = project?.composeResult?.videoUrl?.trim() ?? "";
  const variant = moduleToVariant(moduleId);
  const previewSlots = useMemo(
    () => buildSimpleFusionPreviewSlots(project, { garmentMulti: copy.garmentMulti }),
    [project, copy.garmentMulti],
  );
  const fusionPreviewItems = useMemo(
    () =>
      mapPreviewItemsFromEntries(
        previewSlots
          .filter((s) => s.fusedImageUrl?.trim())
          .map((s) => ({ url: s.fusedImageUrl!, title: s.caption })),
      ),
    [previewSlots],
  );
  const { preview: imagePreview, openPreview, closePreview } =
    useEcomImagePreview(fusionPreviewItems);
  const allFusionsReady = simpleFusionAllFusionsReady(previewSlots);
  const allClipsReady = simpleFusionAllClipsReady(previewSlots);
  const composeFinalGenerating =
    composeRenderPending || project?.phase === "rendering";
  const pipelineBusy =
    busy || project?.phase === "generating" || project?.phase === "rendering";
  const fusionMentionRefs = useMemo(
    () => (project ? buildSimpleFusionMentionRefs(project.references) : []),
    [project],
  );
  const videoMentionRefs = useMemo(
    () => buildSimpleFusionVideoMentionRefs(previewSlots),
    [previewSlots],
  );

  const openSceneCatalog = useCallback(() => {
    void fetchEcomSceneLibraryCatalog().then((c) => {
      setSceneCatalog(
        c.scenes.length ? c.scenes : [...(c.platform ?? []), ...(c.user ?? [])],
      );
      setSceneCatalogOpen(true);
    });
  }, []);

  const scenePickerEntries = useMemo((): CatalogPickerEntry[] => {
    const list = sceneCatalog.length
      ? sceneCatalog
      : [];
    const filtered =
      variant === "mirror"
        ? list.filter(
            (s) =>
              SIMPLE_FUSION_MIRROR_KEYWORDS.some((k) => s.name.includes(k)) ||
              s.name.includes("镜"),
          )
        : list;
    return (filtered.length ? filtered : list).map(sceneToCatalogPickerEntry);
  }, [sceneCatalog, variant]);

  async function persistPrompts(opts?: {
    fusionCustomized?: boolean;
    videoCustomized?: boolean;
    resetDefaults?: boolean;
  }) {
    if (!project) return;
    const draftTriple = {
      fusion: fusionDraft,
      video: videoDraft,
      negative: negativeDraft,
    };
    const promptsCustomized = opts?.resetDefaults
      ? false
      : opts?.fusionCustomized ?? project.meta?.promptsCustomized === true;
    const videoPromptCustomized = opts?.resetDefaults
      ? false
      : opts?.videoCustomized ?? project.meta?.videoPromptCustomized === true;
    const p = await patchSimpleFusionProject(project.id, {
      meta: {
        ...project.meta,
        prompts: draftTriple,
        promptsCustomized,
        videoPromptCustomized,
      },
    });
    applyProject(p, { skipAutoPersist: true });
  }

  async function handleNewProject() {
    if (!project) return;
    if (
      !(await confirm({
        title: "新建项目",
        message: "将创建空白项目，当前未保存的修改可能丢失。",
      }))
    ) {
      return;
    }
    const p = await createSimpleFusionProject(moduleId);
    applyProject(p);
    toast({ title: "已新建项目", variant: "success" });
  }

  async function handleSave() {
    if (!project) return;
    setSaveBusy(true);
    try {
      await persistPrompts();
      const p = await saveSimpleFusionSnapshot(project.id);
      applyProject(p);
      toast({ title: "已保存作品", variant: "success" });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSaveBusy(false);
    }
  }

  function modelDisplayName(models: StoryboardGatewayModel[], key: string): string {
    return models.find((m) => m.modelKey === key)?.displayName?.trim() || key;
  }

  async function persistModelKeys(patch: {
    fusionModelKey?: string;
    videoModelKey?: string;
    panelDurationSec?: number;
  }) {
    if (!project) return;
    const p = await patchSimpleFusionProject(project.id, {
      settings: { ...project.settings, ...patch },
    });
    applyProject(p, { skipAutoPersist: true });
  }

  function applyOptimisticFusionPending() {
    setProject((prev) => {
      if (!prev) return prev;
      const garments = prev.references.garments ?? [];
      const prevLooks = prev.meta?.looks ?? [];
      if (garments.length === 0 && prevLooks.length === 0) return prev;
      const looks =
        prevLooks.length > 0
          ? prevLooks.map((look) => ({
              ...look,
              fusedImageUrl: undefined,
              status: "pending" as const,
              failReason: undefined,
            }))
          : garments
              .filter((g) => g.ossUrl?.trim())
              .map((g) => ({
                lookId: g.id,
                garmentId: g.id,
                status: "pending" as const,
              }));
      return {
        ...prev,
        phase: "generating",
        status: "processing",
        meta: { ...prev.meta, looks },
      };
    });
  }

  async function runPipelineStep(step: "fusion" | "video" | "all") {
    if (!project) return;
    if (step === "video" && !allFusionsReady) {
      await alert({
        title: "请先完成静态融合",
        message: "图生视频只接受融合图作为输入，请先执行步骤 ① 生成全部融合图。",
        variant: "error",
      });
      return;
    }
    const slotKeys = previewSlots.map((s) => s.key);
    if (step === "fusion" || step === "all") {
      applyOptimisticFusionPending();
    } else if (step === "video") {
      setRegeneratingLookIds(new Set(slotKeys));
    }
    setBusy(true);
    try {
      await persistPrompts();
      const p = await runSimpleFusionGenerate(project.id, step);
      applyProject(p);
      if (step === "fusion") {
        toast({ title: "融合图已生成", variant: "success" });
      } else if (step === "video") {
        toast({ title: "视频片段已生成", variant: "success" });
        if (copy.garmentMulti && simpleFusionAllClipsReady(buildSimpleFusionPreviewSlots(p, { garmentMulti: copy.garmentMulti }))) {
          toast({
            title: "可合成卡点成片",
            message: "全部片段已就绪，请执行步骤 ③。",
            variant: "success",
          });
        }
      } else {
        toast({ title: "融合与片段已完成", message: copy.garmentMulti ? "请执行步骤 ③ 合成成片。" : undefined, variant: "success" });
      }
    } catch (e) {
      await alert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
      try {
        const refreshed = await getSimpleFusionProject(project.id);
        applyProject(refreshed);
      } catch {
        /* ignore refetch errors */
      }
    } finally {
      setBusy(false);
      setRegeneratingLookIds(new Set());
    }
  }

  async function runLookGenerate(lookId: string, step: "fusion" | "video") {
    if (!project) return;
    if (step === "video") {
      const slot = previewSlots.find((s) => s.key === lookId);
      if (!slot?.fusedImageUrl?.trim()) {
        await alert({
          title: "请先融合",
          message: "该套尚未生成融合图，请先重新生成融合或执行步骤 ①。",
          variant: "error",
        });
        return;
      }
    }
    setRegeneratingLookIds((prev) => new Set(prev).add(lookId));
    if (step === "fusion") {
      setProject((prev) => {
        if (!prev?.meta?.looks?.length) return prev;
        return {
          ...prev,
          meta: {
            ...prev.meta,
            looks: prev.meta!.looks!.map((look) =>
              look.lookId === lookId
                ? {
                    ...look,
                    fusedImageUrl: undefined,
                    status: "pending" as const,
                    failReason: undefined,
                  }
                : look,
            ),
          },
        };
      });
    }
    setBusy(true);
    try {
      await persistPrompts();
      const p = await runSimpleFusionGenerate(project.id, step, { lookIds: [lookId] });
      applyProject(p);
      toast({
        title: step === "fusion" ? "融合图已更新" : "视频片段已更新",
        variant: "success",
      });
      if (
        step === "video" &&
        copy.garmentMulti &&
        p.meta?.looks?.every((l) => l.clipVideoUrl?.trim()) &&
        !p.composeResult?.videoUrl?.trim()
      ) {
        toast({
          title: "可合成卡点成片",
          message: "全部片段已就绪，请点击下方「合成卡点成片」。",
          variant: "success",
        });
      }
    } catch (e) {
      await alert({
        title: step === "fusion" ? "融合失败" : "片段生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
      try {
        applyProject(await getSimpleFusionProject(project.id));
      } catch {
        /* ignore */
      }
    } finally {
      setRegeneratingLookIds((prev) => {
        const next = new Set(prev);
        next.delete(lookId);
        return next;
      });
      setBusy(false);
    }
  }

  function downloadFusionImage(url: string, title: string) {
    void downloadMediaUrl(url, mediaDownloadFilename(title, "image", url));
  }

  function downloadClipVideo(url: string, title: string) {
    void downloadMediaUrl(url, mediaDownloadFilename(title, "video", url));
  }

  function beginPipelineWithModels(step: "fusion" | "video" | "fusion_then_video") {
    if (step === "video" && !allFusionsReady) {
      void alert({
        title: "请先完成静态融合",
        message: "图生视频只接受融合图作为输入。",
        variant: "error",
      });
      return;
    }
    pendingPipelineStepRef.current = step;
    if (step === "video") {
      setVideoPickerOpen(true);
      return;
    }
    setFusionPickerOpen(true);
  }

  if (needLogin) return <EcomLoginPrompt />;
  if (loading || !project) {
    return (
      <EcomWorkspaceLayout>
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-[#6e6e73]">
          加载中…
        </div>
      </EcomWorkspaceLayout>
    );
  }

  const sceneTextOnly =
    (project.references.scene?.scenePrompt?.trim() ?? "") && !project.references.scene?.ossUrl;

  function openAiDialog(role: "model" | "scene") {
    setAiDialogRole(role);
    if (role === "model") {
      setAiDialogDraft(modelPrompt.trim() || DEFAULT_MODEL_AI_PROMPT);
    } else {
      setAiDialogDraft(scenePrompt.trim());
    }
  }

  async function confirmAiDialog() {
    if (!project || !aiDialogRole) return;
    const prompt = aiDialogDraft.trim();
    if (!prompt) {
      await alert({ title: "请填写描述", message: "Prompt 不能为空。", variant: "error" });
      return;
    }
    if (aiDialogRole === "model") {
      setModelGenBusy(true);
      try {
        setModelPrompt(prompt);
        await generateSimpleFusionModel(project.id, prompt).then(applyProject);
        setAiDialogRole(null);
      } catch (e) {
        await alert({
          title: "模特生成失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setModelGenBusy(false);
      }
      return;
    }
    setScenePrompt(prompt);
    await patchSimpleFusionProject(project.id, {
      references: {
        ...project.references,
        scene: { scenePrompt: prompt, source: "text" },
      },
    }).then(applyProject);
    setAiDialogRole(null);
  }

  const refCardsBusy = busy || modelGenBusy;

  return (
    <>
    <EcomWorkspaceLayout>
      <EcomImagePreviewHost
        preview={imagePreview}
        galleryItems={fusionPreviewItems}
        onClose={closePreview}
      />
      <EcomModelLibraryPickerDialog
        open={modelLibraryOpen}
        onOpenChange={setModelLibraryOpen}
        onPick={async (entry) => {
          const p = await patchSimpleFusionProject(project.id, {
            references: {
              ...project.references,
              model: {
                ossUrl: entry.ossUrl,
                source: "library",
                label: entry.name?.trim() || "模特库",
              },
            },
          });
          applyProject(p);
        }}
      />
      <EcomCatalogPickerDialog
        open={sceneCatalogOpen}
        onOpenChange={setSceneCatalogOpen}
        title="场景库"
        entries={scenePickerEntries}
        loading={false}
        onPick={async (entry) => {
          const p = await patchSimpleFusionProject(project.id, {
            references: {
              ...project.references,
                scene: {
                libraryEntryId: entry.id,
                libraryEntryName: entry.name,
                scenePrompt: entry.subtitle,
                ...(entry.imageUrl?.trim()
                  ? { ossUrl: entry.imageUrl.trim(), source: "library" as const }
                  : {}),
              },
            },
          });
          applyProject(p);
        }}
      />
      <EcomAssetPickerDialog
        open={assetPicker != null}
        onOpenChange={(open) => !open && setAssetPicker(null)}
        onConfirm={async (assets) => {
          const a = assets[0];
          if (!a || !assetPicker) return;
          if (assetPicker === "model") {
            const p = await patchSimpleFusionProject(project.id, {
              references: {
                ...project.references,
                model: { ossUrl: a.ossUrl, source: "asset", label: a.title },
              },
            });
            applyProject(p);
          } else if (assetPicker === "scene") {
            const p = await patchSimpleFusionProject(project.id, {
              references: {
                ...project.references,
                scene: { ossUrl: a.ossUrl, source: "asset" },
              },
            });
            applyProject(p);
          } else {
            for (const asset of assets) {
              await uploadSimpleFusionMedia(project.id, "garment", await urlToFile(asset.ossUrl, asset.title));
            }
            const refreshed = await getSimpleFusionProject(project.id);
            applyProject(refreshed);
          }
          setAssetPicker(null);
        }}
      />

      <Dialog
        open={aiDialogRole != null}
        onOpenChange={(open) => {
          if (!open && !modelGenBusy) setAiDialogRole(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {aiDialogRole === "model" ? "AI 生成模特参考" : "AI 场景描述"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6e6e73]">
              {aiDialogRole === "model"
                ? "纯文生图生成模特参考；与服装图在后续融合步骤合成。"
                : "仅保存文字场景（可无场景参考图）；也可稍后在卡片中上传场景图覆盖。"}
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[120px] w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm leading-relaxed"
            value={aiDialogDraft}
            disabled={modelGenBusy}
            onChange={(e) => setAiDialogDraft(e.target.value)}
            placeholder={
              aiDialogRole === "model"
                ? DEFAULT_MODEL_AI_PROMPT
                : "例如：纯白无缝背景，均匀顶光，商业摄影棚…"
            }
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <EcomButtonSecondary
              type="button"
              disabled={modelGenBusy}
              onClick={() => setAiDialogRole(null)}
            >
              取消
            </EcomButtonSecondary>
            <EcomButtonPrimary
              type="button"
              disabled={modelGenBusy}
              onClick={() => void confirmAiDialog()}
            >
              {modelGenBusy
                ? "生成中…"
                : aiDialogRole === "model"
                  ? "开始生成"
                  : "保存描述"}
            </EcomButtonPrimary>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        <header className="z-20 shrink-0 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">{copy.title}</h2>
              <p className="text-[11px] text-[#6e6e73]">{copy.subtitle}</p>
            </div>
            <EcomIconToolbar guideModuleId={moduleId}>
              <EcomIconToolbarGroup label="项目">
                <EcomIconButton label="新建项目" icon={Plus} disabled={busy} onClick={() => void handleNewProject()} />
                <EcomProjectListButton
                  disabled={busy}
                  currentProjectId={project.id}
                  loadProjects={async () => listSimpleFusionProjects(moduleId)}
                  onSelectProject={(id) => void getSimpleFusionProject(id).then(applyProject)}
                  title={`${copy.title} · 项目列表`}
                  emptyHint={`还没有保存过的${copy.title}项目。`}
                />
              </EcomIconToolbarGroup>
              <EcomIconToolbarGroup label="工作流">
                <EcomIconButton label="保存作品" icon={Save} busy={saveBusy} disabled={busy || saveBusy} onClick={() => void handleSave()} />
              </EcomIconToolbarGroup>
              <EcomIconToolbarGroup label="资产与交付">
                <EcomGlobalAssetLibraryToolbarButton defaultCatalog="pose" />
                <EcomIconButton label="我的资产" icon={Images} onClick={() => router.push("/library")} />
                <EcomIconButton
                  label="预览成片"
                  icon={Download}
                  disabled={!finalVideoUrl}
                  onClick={() => finalVideoUrl && setPreviewVideo({ src: finalVideoUrl, title: copy.title })}
                />
              </EcomIconToolbarGroup>
            </EcomIconToolbar>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <div className="hidden shrink-0 md:flex">
            <SimpleFusionProgressRail
              project={project}
              previewSlots={previewSlots}
              garmentMulti={copy.garmentMulti}
            />
          </div>
        <div className="ecom-scrollbar-overlay min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <SimpleFusionRefUploadSection
            project={project}
            garmentMulti={copy.garmentMulti}
            refCardsBusy={busy}
            modelGenBusy={modelGenBusy}
            sceneTextOnly={Boolean(sceneTextOnly)}
            onProject={applyProject}
            onOpenModelLibrary={() => setModelLibraryOpen(true)}
            onOpenSceneCatalog={openSceneCatalog}
            onOpenAssetPicker={setAssetPicker}
            onOpenAiDialog={openAiDialog}
          />

          {moduleId === "video-dance-swap" ? (
            <section className="mb-4 space-y-2 rounded-xl border border-[#e8e8ed] bg-white p-4">
              <span className="text-xs font-medium text-[#1d1d1f]">卡点 BGM</span>
              <select
                className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-xs"
                value={project.settings.bgmPresetId ?? "beat-1"}
                onChange={(e) =>
                  void patchSimpleFusionProject(project.id, {
                    settings: { ...project.settings, bgmPresetId: e.target.value },
                  }).then(applyProject)
                }
              >
                {SIMPLE_FUSION_BGM_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#86868b]">
                成片为近似卡点，动作与 BGM 节拍无法 100% 对齐。
              </p>
            </section>
          ) : null}

          <section className="mb-6 space-y-4 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#1d1d1f]">① 静态融合</h3>
                <p className="mt-1 text-[10px] leading-relaxed text-[#86868b]">
                  引用上方模特 / 服装 / 场景，分段 Prompt（对齐模特试衣）。生成成功后才会进入下一步。
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] text-[#0071e3] hover:underline"
                onClick={() => {
                  if (!project) return;
                  void patchSimpleFusionProject(project.id, {
                    meta: {
                      ...project.meta,
                      promptsCustomized: false,
                      videoPromptCustomized: false,
                    },
                  }).then(applyProject);
                }}
              >
                恢复 Prompt 默认
              </button>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#6e6e73]">融合 Prompt</span>
              <ProductDesignPromptMentionTextarea
                value={fusionDraft}
                referenceImages={fusionMentionRefs}
                disabled={busy}
                minHeightClass="min-h-[5.5rem]"
                className="rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs leading-relaxed"
                onChange={setFusionDraft}
                onFocus={() => {
                  focusedPromptFieldRef.current = "fusion";
                }}
                onBlur={() => {
                  focusedPromptFieldRef.current = null;
                  void persistPrompts({ fusionCustomized: true });
                }}
                {...PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#6e6e73]">负面 Prompt</span>
              <ProductDesignPromptMentionTextarea
                value={negativeDraft}
                referenceImages={[]}
                disabled={busy}
                minHeightClass="min-h-[3rem]"
                className="rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs leading-relaxed"
                onChange={setNegativeDraft}
                onFocus={() => {
                  focusedPromptFieldRef.current = "negative";
                }}
                onBlur={() => {
                  focusedPromptFieldRef.current = null;
                  void persistPrompts({ fusionCustomized: true });
                }}
                {...PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EcomButtonPrimary
                type="button"
                size="sm"
                disabled={busy || modelsLoading}
                onClick={() => beginPipelineWithModels("fusion")}
              >
                {busy ? "融合中…" : "生成融合图"}
              </EcomButtonPrimary>
              <EcomButtonSecondary
                type="button"
                size="sm"
                disabled={busy || modelsLoading}
                className="gap-1.5"
                onClick={() => {
                  pendingPipelineStepRef.current = null;
                  setFusionPickerOpen(true);
                }}
              >
                <Cpu className="size-3.5 shrink-0 opacity-70" aria-hidden />
                {modelDisplayName(imageModels, fusionModelKey)}
              </EcomButtonSecondary>
            </div>
            <div className={ECOM_WORKSPACE_RESULT_GRID_CLASS}>
              {previewSlots.map((slot) => {
                const slotBusy = regeneratingLookIds.has(slot.key);
                const slotPipelineBusy = pipelineBusy || slotBusy;
                const fusionGenerating = simpleFusionSlotFusionGenerating(
                  slot,
                  pipelineBusy,
                  slotBusy,
                );
                const fusionFailed =
                  slot.status === "fusion_failed" ||
                  (slot.status === "failed" && !slot.clipVideoUrl?.trim());
                return (
                  <div key={`fusion-${slot.key}`} className={ECOM_WORKSPACE_RESULT_COLUMN_CLASS}>
                    <div className={ecomWorkspaceResultShellClass({ running: fusionGenerating })}>
                      <EcomWorkspaceResultFrame aspect="tryon-image" className="group/image">
                        {slot.fusedImageUrl?.trim() ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={slot.fusedImageUrl}
                              alt={slot.caption}
                              className="size-full cursor-zoom-in object-contain object-top"
                              draggable={false}
                              onClick={() =>
                                openPreview(slot.fusedImageUrl!, slot.caption, fusionPreviewItems)
                              }
                            />
                            {fusionGenerating ? (
                              <EcomMediaGeneratingBusy
                                label="融合中…"
                                background="light"
                                className="absolute inset-0 z-[2]"
                              />
                            ) : null}
                            {!fusionGenerating ? (
                              <VtonResultImageHoverActions
                                disabled={busy || slotBusy}
                                onPreview={() =>
                                  openPreview(slot.fusedImageUrl!, slot.caption, fusionPreviewItems)
                                }
                                onDownload={() =>
                                  downloadFusionImage(slot.fusedImageUrl!, slot.caption)
                                }
                                onRegenerate={
                                  !slotPipelineBusy && !fusionGenerating
                                    ? () => void runLookGenerate(slot.key, "fusion")
                                    : undefined
                                }
                              />
                            ) : null}
                          </>
                        ) : fusionGenerating ? (
                          <EcomMediaGeneratingBusy label="融合中…" background="light" />
                        ) : fusionFailed ? (
                          <span className="flex size-full min-h-[8rem] items-center justify-center px-2 text-center text-[10px] leading-snug text-[#c0392b]">
                            {slot.failReason?.trim() || "融合失败"}
                          </span>
                        ) : (
                          <span className="flex size-full min-h-[8rem] items-center justify-center px-2 text-center text-[10px] text-[#86868b]">
                            待融合
                          </span>
                        )}
                      </EcomWorkspaceResultFrame>
                    </div>
                    <p className={ECOM_WORKSPACE_RESULT_LABEL_CLASS}>{slot.caption}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            className={cn(
              "mb-6 space-y-4 rounded-xl border border-[#e8e8ed] p-4",
              allFusionsReady ? "bg-white" : "bg-[#f5f5f7]/80",
            )}
          >
            <div>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">② 图生视频</h3>
              <p className="mt-1 text-[10px] leading-relaxed text-[#86868b]">
                仅基于上一步融合图生成片段；Prompt 会自动 @融合1…（失败或未出图的不引用）。接口只传融合图 URL。
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#6e6e73]">视频 Prompt</span>
              <ProductDesignPromptMentionTextarea
                value={videoDraft}
                referenceImages={videoMentionRefs}
                disabled={busy || videoMentionRefs.length === 0}
                minHeightClass="min-h-[4.5rem]"
                className="rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs leading-relaxed disabled:bg-[#f5f5f7]"
                onChange={setVideoDraft}
                onFocus={() => {
                  focusedPromptFieldRef.current = "video";
                }}
                onBlur={() => {
                  focusedPromptFieldRef.current = null;
                  void persistPrompts({ videoCustomized: true });
                }}
                {...PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS}
              />
              {videoMentionRefs.length === 0 ? (
                <p className="text-[10px] text-[#86868b]">请先完成 ① 融合，成功出图后会自动填入 @融合 引用。</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EcomButtonPrimary
                type="button"
                size="sm"
                disabled={busy || modelsLoading || !allFusionsReady}
                onClick={() => beginPipelineWithModels("video")}
              >
                生成视频片段
              </EcomButtonPrimary>
              <EcomButtonSecondary
                type="button"
                size="sm"
                disabled={busy || modelsLoading || !allFusionsReady}
                onClick={() => beginPipelineWithModels("fusion_then_video")}
              >
                连续 ①+②
              </EcomButtonSecondary>
              <EcomButtonSecondary
                type="button"
                size="sm"
                disabled={busy || modelsLoading}
                className="gap-1.5"
                onClick={() => {
                  pendingPipelineStepRef.current = null;
                  setVideoPickerOpen(true);
                }}
              >
                <Cpu className="size-3.5 shrink-0 opacity-70" aria-hidden />
                {modelDisplayName(videoModels, videoModelKey)}
              </EcomButtonSecondary>
            </div>
            <div className={ECOM_WORKSPACE_RESULT_GRID_CLASS}>
              {previewSlots.map((slot) => {
                const slotBusy = regeneratingLookIds.has(slot.key);
                const slotPipelineBusy = pipelineBusy || slotBusy;
                const hasFusion = Boolean(slot.fusedImageUrl?.trim());
                const videoGenerating = simpleFusionSlotVideoGenerating(
                  slot,
                  pipelineBusy,
                  slotBusy,
                );
                const videoFailed = slot.status === "failed" && hasFusion;
                const videoErrorMessage =
                  videoFailed && !videoGenerating
                    ? slot.failReason?.trim() || "视频片段生成失败"
                    : null;
                const canRegenVideo =
                  hasFusion &&
                  !slotPipelineBusy &&
                  !videoGenerating &&
                  (videoFailed || Boolean(slot.clipVideoUrl?.trim()) || !slot.clipVideoUrl);
                const showClipHoverActions =
                  !videoGenerating &&
                  hasFusion &&
                  Boolean(slot.clipVideoUrl?.trim());
                const openClipPreview = () => {
                  if (!slot.clipVideoUrl?.trim()) return;
                  setPreviewVideo({ src: slot.clipVideoUrl.trim(), title: slot.caption });
                };
                return (
                  <div key={`video-${slot.key}`} className={ECOM_WORKSPACE_RESULT_COLUMN_CLASS}>
                    <div
                      className={cn(
                        "group/video relative",
                        showClipHoverActions && "group/video-hover",
                      )}
                    >
                      <EcomVideoSlot
                        src={slot.clipVideoUrl}
                        aspectRatio="9:16"
                        layout="workspace"
                        generating={videoGenerating}
                        generatingPosterUrl={slot.fusedImageUrl}
                        generatingLabel="生成中…"
                        generatingBackground="black"
                        errorMessage={videoErrorMessage}
                        emptyLabel={hasFusion ? "视频片段" : "待融合"}
                        onPreview={
                          slot.clipVideoUrl?.trim() ? openClipPreview : undefined
                        }
                      />
                      {showClipHoverActions ? (
                        <SimpleFusionVideoSlotHoverActions
                          disabled={busy || slotBusy}
                          onPreview={openClipPreview}
                          onDownload={
                            slot.clipVideoUrl?.trim()
                              ? () => downloadClipVideo(slot.clipVideoUrl!, slot.caption)
                              : undefined
                          }
                          onRegenerate={
                            canRegenVideo
                              ? () => void runLookGenerate(slot.key, "video")
                              : undefined
                          }
                        />
                      ) : null}
                    </div>
                    {videoFailed && !videoGenerating && !slot.clipVideoUrl?.trim() ? (
                      <EcomButtonSecondary
                        type="button"
                        size="sm"
                        className="w-full text-[11px]"
                        disabled={busy || slotBusy}
                        onClick={() => void runLookGenerate(slot.key, "video")}
                      >
                        重新生成片段
                      </EcomButtonSecondary>
                    ) : null}
                    <p className={ECOM_WORKSPACE_RESULT_LABEL_CLASS}>{slot.caption}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {copy.garmentMulti && project ? (
            <SimpleFusionComposeWorkbench
              project={project}
              previewSlots={previewSlots}
              finalVideoUrl={finalVideoUrl}
              composeGenerating={composeFinalGenerating}
              canEdit={allClipsReady && !busy}
              onProject={applyProject}
              onComposeStarted={() => setComposeRenderPending(true)}
              onComposeFailed={() => setComposeRenderPending(false)}
              onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
              onDownloadFinal={
                finalVideoUrl
                  ? () =>
                      void downloadMediaUrl(
                        finalVideoUrl,
                        mediaDownloadFilename(`${copy.title}-成片`, "video", finalVideoUrl),
                      )
                  : undefined
              }
            />
          ) : null}
        </div>
        </div>
      </div>

      <StoryboardModelPickerDialog
        open={fusionPickerOpen}
        onOpenChange={(open) => {
          setFusionPickerOpen(open);
          if (!open && !openingVideoAfterFusionRef.current) {
            pendingPipelineStepRef.current = null;
          }
          openingVideoAfterFusionRef.current = false;
        }}
        mode="image"
        dialogTitle="选择静态融合模型"
        dialogDescription="多图融合：模特 + 服装 + 场景参考。须支持 IMAGE / 图片编辑类模型。"
        footerHint="确认后将用于本次全部融合步骤。"
        confirmLabel="使用该模型"
        models={imageModels}
        modelsLoading={modelsLoading}
        modelsEmptyHint={modelsLoadError ?? undefined}
        onRetryLoadModels={() => void loadModels()}
        value={fusionModelKey}
        onChange={setFusionModelKey}
        onConfirm={(key) => {
          setFusionModelKey(key);
          const pending = pendingPipelineStepRef.current;
          const chainVideo = pending === "fusion_then_video";
          if (chainVideo) openingVideoAfterFusionRef.current = true;
          setFusionPickerOpen(false);
          void persistModelKeys({ fusionModelKey: key }).then(() => {
            if (pending === "fusion") {
              pendingPipelineStepRef.current = null;
              void runPipelineStep("fusion");
            } else if (chainVideo) {
              setVideoPickerOpen(true);
            } else {
              pendingPipelineStepRef.current = null;
            }
          });
        }}
      />

      <StoryboardModelPickerDialog
        open={videoPickerOpen}
        onOpenChange={(open) => {
          setVideoPickerOpen(open);
          if (!open) pendingPipelineStepRef.current = null;
        }}
        mode="video"
        videoTarget="panel"
        models={videoModels}
        modelsLoading={modelsLoading}
        modelsEmptyHint={modelsLoadError ?? undefined}
        onRetryLoadModels={() => void loadModels()}
        value={videoModelKey}
        onChange={setVideoModelKey}
        aspectRatio="9:16"
        panelDurationSec={panelDurationSec}
        onPanelDurationChange={setPanelDurationSec}
        onConfirm={(key) => {
          setVideoModelKey(key);
          setVideoPickerOpen(false);
          const pending = pendingPipelineStepRef.current;
          pendingPipelineStepRef.current = null;
          void persistModelKeys({ videoModelKey: key, panelDurationSec }).then(() => {
            if (pending === "video") void runPipelineStep("video");
            else if (pending === "fusion_then_video") void runPipelineStep("all");
          });
        }}
      />
    </EcomWorkspaceLayout>

    {previewVideo ? (
      <EcomVideoPreviewDialog
        open
        src={previewVideo.src}
        title={previewVideo.title}
        onOpenChange={(open) => {
          if (!open) setPreviewVideo(null);
        }}
      />
    ) : null}
    </>
  );
}

const SIMPLE_FUSION_MIRROR_KEYWORDS = ["落地镜", "街边", "商场", "户外", "咖啡", "镜"];

async function urlToFile(url: string, title: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], `${title || "asset"}.jpg`, { type: blob.type || "image/jpeg" });
}
