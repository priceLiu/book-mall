"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { useEcomStudioAssistantCollapse } from "@/lib/ecom-assistant-collapse";
import { ProductDesignAssistantPanel } from "@/components/product-design/product-design-assistant-panel";
import { ProductDesignContentPanel } from "@/components/product-design/product-design-content-panel";
import { ProductDesignProgressRail } from "@/components/product-design/product-design-progress-rail";
import { ProductDesignSourceProjectDialog } from "@/components/product-design/product-design-source-project-dialog";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  createProductDesignProject,
  fetchPlatformSpecs,
  fetchProductDesignModels,
  getProductDesignProject,
  listProductDesignProjects,
  removeProductDesignRef,
  updateProductDesignProject,
  uploadProductDesignRef,
} from "@/lib/ecom-product-design-api";
import type {
  EcomPlatformSpec,
  EcomProjectModule,
  ProductDesignChatMessage,
  ProductDesignProject,
  ProductDesignReference,
  ProductDesignReferenceRole,
  ProductDesignStrategyImport,
} from "@/lib/product-design-types";
import { getMaxRefsForRoleClient } from "@/lib/product-design-ref-rules";
import type { DetailWorkflowPath, ProductDesignStepId } from "@/lib/product-design-workflow";
import {
  DETAIL_INTERACTIVE_CHOICE,
  DETAIL_REF_PROMPT_WORKFLOW_CHOICE,
  INTERACTIVE_WORKFLOW_CHOICE,
  MAIN_REF_PROMPT_WORKFLOW_CHOICE,
} from "@/lib/product-design-workflow";
import { ECOM_DEFAULT_CHAT_MODEL_KEY } from "@/lib/ecom-assistant-models";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

/** 两个入口各自记住自己的活跃项目，避免互相抢占 */
function projectStorageKey(module: EcomProjectModule): string {
  return `ecom-product-design-active-project:${module}`;
}

const ENTRY_COPY: Record<
  EcomProjectModule,
  { title: string; path: string; blurb: string; newTitle: string }
> = {
  "main-image": {
    title: "电商产品主图创作",
    path: "/ecom/product-creation",
    blurb: "卖点策略 + 主图文案与配图。暂无项目时点击开始，不会自动创建空项目。",
    newTitle: "电商产品主图创作",
  },
  "detail-page": {
    title: "电商产品详情页创作",
    path: "/ecom/detail-page-creation",
    blurb:
      "详情页架构 + 分屏文案与配图。可从已完成的主图项目导入策略，也可从头开始。",
    newTitle: "电商产品详情页创作",
  },
};

type StudioProps = {
  /** 产线入口：决定新建项目的 module，建成后不可切换 */
  module: EcomProjectModule;
};

export function ProductCreationStudio({ module }: StudioProps) {
  const entry = ENTRY_COPY[module];
  const router = useRouter();
  const { alert, confirm, doubleConfirm } = useDialogs();
  const [project, setProject] = useState<ProductDesignProject | null>(null);
  const [specs, setSpecs] = useState<EcomPlatformSpec[]>([]);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [visionModels, setVisionModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [chatModelKey, setChatModelKey] = useState(ECOM_DEFAULT_CHAT_MODEL_KEY);
  const [visionModelKey, setVisionModelKey] = useState("qwen3.8-max");
  const [imageModelKey, setImageModelKey] = useState("wan2.7-image");
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [uploadingRole, setUploadingRole] = useState<ProductDesignReference["role"] | null>(
    null,
  );
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [generateMainImagesToken, setGenerateMainImagesToken] = useState(0);
  const [generateDetailImagesToken, setGenerateDetailImagesToken] = useState(0);
  const [startStep1Token, setStartStep1Token] = useState(0);
  const [startDetailOutlineToken, setStartDetailOutlineToken] = useState(0);
  const [regenerateMarketingPlansToken, setRegenerateMarketingPlansToken] = useState(0);
  const [focusStepId, setFocusStepId] = useState<ProductDesignStepId | null>(null);
  const [assistantWide, setAssistantWide] = useState(false);
  const { assistantCollapsed, setAssistantCollapsed, handleMainBlankPointerDown } =
    useEcomStudioAssistantCollapse(assistantStreaming);
  const [importPickerOpen, setImportPickerOpen] = useState(false);

  useEffect(() => {
    if (!focusStepId) return;
    const timer = window.setTimeout(() => setFocusStepId(null), 800);
    return () => window.clearTimeout(timer);
  }, [focusStepId]);

  const applyProject = useCallback(
    (p: ProductDesignProject) => {
      setProject(p);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(projectStorageKey(module), p.id);
      }
      if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
      if (p.settings.visionModelKey) setVisionModelKey(p.settings.visionModelKey);
      if (p.settings.imageModelKey) setImageModelKey(p.settings.imageModelKey);
    },
    [module],
  );

  const reload = useCallback(
    async (id: string, initial?: ProductDesignProject) => {
      applyProject(initial ?? (await getProductDesignProject(id)));
    },
    [applyProject],
  );

  const loadModels = useCallback(async (opts?: { force?: boolean }) => {
    setModelsLoading(true);
    try {
      const models = await fetchProductDesignModels({ force: opts?.force });
      setChatModels(models.chatModels);
      setVisionModels(models.visionModels);
      setImageModels(models.imageModels);
      setChatModelKey((prev) => pickBoundStoryboardModelKey(models.chatModels, prev));
      setVisionModelKey((prev) =>
        pickBoundStoryboardModelKey(
          models.visionModels.length ? models.visionModels : models.chatModels,
          prev,
        ),
      );
      setImageModelKey((prev) => pickBoundStoryboardModelKey(models.imageModels, prev));
      if (
        models.imageModels.length === 0 &&
        models.visionModels.length === 0 &&
        models.chatModels.length === 0
      ) {
        setModelsLoadError("Gateway 未返回可用模型，请检查凭证或平台 IMAGE 模型上架。");
      } else {
        setModelsLoadError(null);
      }
    } catch (e) {
      setModelsLoadError(e instanceof Error ? e.message : "模型列表加载失败");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchPlatformSpecs()
      .then((data) => {
        if (!cancelled) setSpecs(data.specs);
      })
      .catch(() => {
        /* 平台表随项目加载重试 */
      });

    void loadModels();

    (async () => {
      try {
        const savedId =
          typeof window !== "undefined"
            ? sessionStorage.getItem(projectStorageKey(module))
            : null;

        let projectId: string | null = null;
        let initial: ProductDesignProject | undefined;

        if (savedId) {
          try {
            const p = await getProductDesignProject(savedId);
            // 旧项目 module 为 product-creation，归主图入口
            const track = p.module === "detail-page" ? "detail-page" : "main-image";
            if (track === module) {
              projectId = p.id;
              initial = p;
            }
          } catch {
            /* 会话里 id 失效，走列表 */
          }
        }

        if (!projectId) {
          const summaries = await listProductDesignProjects(module);
          if (summaries.length > 0) {
            projectId = summaries[0]!.id;
          }
        }

        if (cancelled) return;

        if (!projectId) {
          setEmpty(true);
          return;
        }

        await reload(projectId, initial);
      } catch (e) {
        if (cancelled) return;
        if (isEcomUnauthorizedError(e)) {
          setNeedLogin(true);
        } else {
          await alert({
            title: "加载失败",
            message: e instanceof Error ? e.message : "无法初始化工作台",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [alert, loadModels, module, reload]);

  async function handleNewProject(importFrom?: ProductDesignStrategyImport) {
    setLoading(true);
    setEmpty(false);
    try {
      const created = await createProductDesignProject({
        module,
        title: entry.newTitle,
        importFrom,
      });
      await reload(created.id, created);
    } catch (e) {
      await alert({
        title: "新建失败",
        message: e instanceof Error ? e.message : "无法创建项目",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const loadProjectList = useCallback(async () => {
    const items = await listProductDesignProjects(module);
    return items.map((p) => {
      const platformLabel = specs.find((s) => s.code === p.platform)?.label ?? p.platform;
      const trackLabel = module === "detail-page" ? "详情页" : "主图";
      const countHint =
        p.mainImageCount != null && module === "main-image"
          ? ` · 主图 ${p.mainImageCount} 张`
          : "";
      return {
        id: p.id,
        title: p.productName ?? p.title ?? "未命名项目",
        updatedAt: p.updatedAt,
        subtitle: `${platformLabel} · ${trackLabel}${countHint}`,
        thumbnailUrl: p.thumbnailUrl,
      };
    });
  }, [module, specs]);

  async function handleOpenProject(id: string) {
    if (project?.id === id) return;
    if (assistantStreaming) {
      await alert({
        title: "请稍候",
        message: "请等待助手完成当前输出后再切换项目。",
        variant: "error",
      });
      return;
    }
    setLoading(true);
    try {
      await reload(id);
      setEmpty(false);
    } catch (e) {
      await alert({
        title: "打开失败",
        message: e instanceof Error ? e.message : "无法打开项目",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  /** 主图出图完成后引导进入详情页产线：新建详情页项目并搬运 Step0–3 策略 */
  async function handleContinueToDetailPages() {
    if (!project) return;
    const ok = await confirm({
      title: "继续制作详情页",
      message:
        "将新建一个详情页项目，并把本项目的信息采集、平台拆解、营销方案与购买理由（Step0–3）连同产品图一起带过去，主图成品会作为详情页风格参考。带过去的内容之后仍可修改。",
      confirmLabel: "带入并前往",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const created = await createProductDesignProject({
        module: "detail-page",
        title: ENTRY_COPY["detail-page"].newTitle,
        importFrom: {
          projectId: project.id,
          productRefs: true,
          mainImagesAsStyleRefs: true,
        },
      });
      if (typeof window !== "undefined") {
        sessionStorage.setItem(projectStorageKey("detail-page"), created.id);
      }
      router.push(ENTRY_COPY["detail-page"].path);
    } catch (e) {
      setLoading(false);
      await alert({
        title: "创建失败",
        message: e instanceof Error ? e.message : "无法创建详情页项目",
        variant: "error",
      });
    }
  }

  async function appendSetupChat(
    userText: string,
    assistantText: string,
    patch?: Parameters<typeof updateProductDesignProject>[1],
  ) {
    if (!project) return;
    const now = new Date().toISOString();
    const ts = Date.now();
    const nextHistory: ProductDesignChatMessage[] = [
      ...(project.chatHistory.length ? project.chatHistory : []),
      { id: `user-${ts}`, role: "user", content: userText, createdAt: now },
      {
        id: `assistant-${ts + 1}`,
        role: "assistant",
        content: assistantText,
        createdAt: now,
      },
    ];
    await updateProductDesignProject(project.id, { ...patch, chatHistory: nextHistory });
    await reload(project.id);
  }

  async function handleChooseDetailWorkflow(mode: DetailWorkflowPath) {
    if (!project) return;
    const isInteractive = mode === "interactive";
    const userText = isInteractive
      ? DETAIL_INTERACTIVE_CHOICE
      : DETAIL_REF_PROMPT_WORKFLOW_CHOICE;
    const assistantText = isInteractive
      ? "已进入 Step7 详情页架构规划，助手即将开始输出…"
      : "请在中间工作区确认详情屏数、编辑 Prompt，上传参考图（可选）后开始出详情图。";
    await appendSetupChat(userText, assistantText, {
      meta: { detailWorkflowPath: mode },
      settings: {
        detailPageGenMode: isInteractive ? "copy" : "reference-prompt",
      },
    });
    if (isInteractive) {
      setStartDetailOutlineToken((t) => t + 1);
      setFocusStepId("detail-outline");
    } else {
      setFocusStepId("detail-image");
    }
  }

  async function handleRefUpload(
    file: File,
    opts: { label: string; role: ProductDesignReference["role"] },
  ) {
    if (!project) return;
    setRefBusy(true);
    setUploadingRole(opts.role);
    setUploadProgress(10);
    const tick = window.setInterval(() => {
      setUploadProgress((p) => (p != null && p < 88 ? p + 7 : p));
    }, 180);
    try {
      await uploadProductDesignRef(project.id, file, opts);
      setUploadProgress(100);
      if (opts.role === "product") {
        await updateProductDesignProject(project.id, {
          meta: {
            setupPhase: "workflow-choice",
            mainWorkflowPath: null,
            briefInferMode: null,
            platformConfirmed: false,
            mainCountConfirmed: false,
            countsConfirmed: false,
          },
        });
      } else if (opts.role === "main-style") {
        const now = new Date().toISOString();
        const ts = Date.now();
        const nextHistory: ProductDesignChatMessage[] = [
          ...(project.chatHistory.length ? project.chatHistory : []),
          {
            id: `user-${ts}`,
            role: "user",
            content: "已上传主图风格参考",
            createdAt: now,
          },
          {
            id: `assistant-${ts + 1}`,
            role: "assistant",
            content: `已上传主图风格参考。请点选下方主图制作方式：\n· ${INTERACTIVE_WORKFLOW_CHOICE}\n· ${MAIN_REF_PROMPT_WORKFLOW_CHOICE}`,
            createdAt: now,
          },
        ];
        await updateProductDesignProject(project.id, {
          meta: { setupPhase: "workflow-choice", styleRefDone: true },
          chatHistory: nextHistory,
        });
      }
      await reload(project.id);
    } catch (e) {
      await alert({
        title: "上传失败",
        message: e instanceof Error ? e.message : "无法上传参考图",
        variant: "error",
      });
    } finally {
      window.clearInterval(tick);
      setRefBusy(false);
      setUploadingRole(null);
      window.setTimeout(() => setUploadProgress(null), 450);
    }
  }

  async function handleAttachAssets(
    assets: Array<{ id: string; ossUrl: string; title: string }>,
    role: ProductDesignReferenceRole,
  ) {
    if (!project) return;
    setRefBusy(true);
    try {
      const maxCount = getMaxRefsForRoleClient(role, {
        visionModelKey: project.settings?.visionModelKey,
        imageModelKey: project.settings?.imageModelKey,
      });
      const existing = project.references.filter((r) => r.role === role);
      const remaining = Math.max(0, maxCount - existing.length);
      const picked = assets.slice(0, remaining);
      if (picked.length === 0) return;
      const added: ProductDesignReference[] = picked.map((a, i) => ({
        id: `ref-${a.id.slice(-8)}-${i}`,
        label: a.title.slice(0, 40) || "资产图",
        role,
        ossUrl: a.ossUrl,
      }));
      await updateProductDesignProject(project.id, {
        references: [...project.references, ...added],
        meta: { setupPhase: "workflow-choice" },
      });
      await reload(project.id);
    } catch (e) {
      await alert({
        title: "添加失败",
        message: e instanceof Error ? e.message : "无法从资产添加参考图",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }

  async function handleRefRemove(refId: string) {
    if (!project) return;
    const ok = await doubleConfirm({
      title: "删除参考图",
      message: "确定从本项目移除这张参考图？",
      secondTitle: "不可恢复",
      secondMessage: "删除后需重新上传，是否继续？",
      confirmLabel: "删除",
    });
    if (!ok) return;
    setRefBusy(true);
    try {
      await removeProductDesignRef(project.id, refId);
      await reload(project.id);
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "无法删除参考图",
        variant: "error",
      });
    } finally {
      setRefBusy(false);
    }
  }

  const importDialog =
    module === "detail-page" ? (
      <ProductDesignSourceProjectDialog
        open={importPickerOpen}
        onOpenChange={setImportPickerOpen}
        specs={specs}
        onConfirm={async (input) => {
          setImportPickerOpen(false);
          await handleNewProject(input);
        }}
      />
    ) : null;

  if (needLogin) {
    return (
      <EcomLoginPrompt
        returnPath={entry.path}
        message={`使用${entry.title}需要登录。请点击下方按钮，经主站 Book 完成 SSO 后自动回到本页。`}
      />
    );
  }

  if (loading && !project) {
    return <ProductCreationStudioSkeleton />;
  }

  if (empty || !project) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-[#1d1d1f]">{entry.title}</h2>
          <p className="max-w-md text-sm text-[#6e6e73]">{entry.blurb}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <EcomButtonSecondary
              type="button"
              onClick={() => void handleNewProject()}
              disabled={loading}
            >
              {loading ? "创建中…" : "开始创作"}
            </EcomButtonSecondary>
            {module === "detail-page" ? (
              <EcomButtonSecondary
                type="button"
                onClick={() => setImportPickerOpen(true)}
                disabled={loading}
              >
                从已有主图项目导入
              </EcomButtonSecondary>
            ) : null}
          </div>
        </div>
        {importDialog}
      </EcomWorkspaceLayout>
    );
  }

  const spec = specs.find((s) => s.code === project.platform) ?? null;

  return (
    <EcomWorkspaceLayout
      assistantWide={assistantWide}
      assistantCollapsed={assistantCollapsed}
      onMainBlankPointerDown={handleMainBlankPointerDown}
      progress={
        <ProductDesignProgressRail
          project={project}
          onStepClick={(id) => setFocusStepId(id)}
        />
      }
      assistant={
        <ProductDesignAssistantPanel
          key={project.id}
          project={project}
          specs={specs}
          chatModels={chatModels}
          chatModelKey={chatModelKey}
          visionModelKey={visionModelKey}
          composerWide={assistantWide}
          onComposerWideChange={setAssistantWide}
          collapsed={assistantCollapsed}
          onCollapsedChange={setAssistantCollapsed}
          onStreamingChange={setAssistantStreaming}
          onProjectChange={async () => {
            await reload(project.id);
          }}
          onRequestGenerateMainImages={() => setGenerateMainImagesToken((t) => t + 1)}
          onRequestGenerateDetailImages={() => setGenerateDetailImagesToken((t) => t + 1)}
          startStep1Token={startStep1Token}
          startDetailOutlineToken={startDetailOutlineToken}
          regenerateMarketingPlansToken={regenerateMarketingPlansToken}
          focusStepId={focusStepId}
          onFocusStep={(id) => setFocusStepId(id)}
          onChooseDetailWorkflow={(mode) => void handleChooseDetailWorkflow(mode)}
          onBriefComplete={() => setStartStep1Token((t) => t + 1)}
          onRegenerateMarketingPlans={() => setRegenerateMarketingPlansToken((t) => t + 1)}
        />
      }
    >
      <ProductDesignContentPanel
        project={project}
        specs={specs}
        spec={spec}
        visionModels={visionModels}
        visionModelKey={visionModelKey}
        onVisionModelChange={(key) => {
          setVisionModelKey(key);
          updateProductDesignProject(project.id, {
            settings: { visionModelKey: key },
          }).catch(() => undefined);
        }}
        imageModels={imageModels}
        imageModelKey={imageModelKey}
        onImageModelChange={(key) => {
          setImageModelKey(key);
          updateProductDesignProject(project.id, {
            settings: { imageModelKey: key },
          }).catch(() => undefined);
        }}
        onRefUpload={handleRefUpload}
        onRefRemove={handleRefRemove}
        onAttachAssets={handleAttachAssets}
        refBusy={refBusy}
        uploadingRole={uploadingRole}
        uploadProgress={uploadProgress}
        onNewProject={() => void handleNewProject()}
        loadProjectList={loadProjectList}
        onOpenProject={(id) => void handleOpenProject(id)}
        onImportFromMainProject={
          module === "detail-page" ? () => setImportPickerOpen(true) : undefined
        }
        onContinueToDetailPages={
          module === "main-image" ? () => void handleContinueToDetailPages() : undefined
        }
        onProjectChange={async () => {
          await reload(project.id);
        }}
        streaming={assistantStreaming}
        generateMainImagesToken={generateMainImagesToken}
        generateDetailImagesToken={generateDetailImagesToken}
        onBriefComplete={() => setStartStep1Token((t) => t + 1)}
        onChooseDetailWorkflow={(mode) => void handleChooseDetailWorkflow(mode)}
        onRegenerateMarketingPlans={() => setRegenerateMarketingPlansToken((t) => t + 1)}
        focusStepId={focusStepId}
        modelsLoading={modelsLoading}
        modelsLoadError={modelsLoadError}
        onRefreshModels={() => loadModels({ force: true })}
      />
      {importDialog}
    </EcomWorkspaceLayout>
  );
}
