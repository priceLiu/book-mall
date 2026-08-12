"use client";

import { useCallback, useEffect, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { ProductDesignAssistantPanel } from "@/components/product-design/product-design-assistant-panel";
import { ProductDesignContentPanel } from "@/components/product-design/product-design-content-panel";
import { ProductDesignProgressRail } from "@/components/product-design/product-design-progress-rail";
import { ProductDesignRefUploader } from "@/components/product-design/product-design-ref-uploader";
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
  ProductDesignChatMessage,
  ProductDesignProject,
  ProductDesignReference,
} from "@/lib/product-design-types";
import type { ProductDesignStepId } from "@/lib/product-design-workflow";
import { hasProductRef } from "@/lib/product-design-ref-rules";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-product-design-active-project";

export function ProductCreationStudio() {
  const { alert, doubleConfirm } = useDialogs();
  const [project, setProject] = useState<ProductDesignProject | null>(null);
  const [specs, setSpecs] = useState<EcomPlatformSpec[]>([]);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [visionModels, setVisionModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState("qwen3.5-flash");
  const [visionModelKey, setVisionModelKey] = useState("qwen3-vl-plus");
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
  const [enterDetailPageToken, setEnterDetailPageToken] = useState(0);
  const [analyzeDetailDecomposeToken, setAnalyzeDetailDecomposeToken] = useState(0);
  const [mainWorkflowChoiceToken, setMainWorkflowChoiceToken] = useState(0);
  const [mainWorkflowChoice, setMainWorkflowChoice] = useState<
    "interactive" | "reference-prompt" | null
  >(null);
  const [focusStepId, setFocusStepId] = useState<ProductDesignStepId | null>(null);
  const [assistantWide, setAssistantWide] = useState(false);

  useEffect(() => {
    if (!focusStepId) return;
    const timer = window.setTimeout(() => setFocusStepId(null), 800);
    return () => window.clearTimeout(timer);
  }, [focusStepId]);

  const applyProject = useCallback((p: ProductDesignProject) => {
    setProject(p);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
    if (p.settings.visionModelKey) setVisionModelKey(p.settings.visionModelKey);
    if (p.settings.imageModelKey) setImageModelKey(p.settings.imageModelKey);
  }, []);

  const reload = useCallback(
    async (id: string, initial?: ProductDesignProject) => {
      applyProject(initial ?? (await getProductDesignProject(id)));
    },
    [applyProject],
  );

  useEffect(() => {
    let cancelled = false;

    void fetchPlatformSpecs()
      .then((data) => {
        if (!cancelled) setSpecs(data.specs);
      })
      .catch(() => {
        /* 平台表随项目加载重试 */
      });

    void fetchProductDesignModels()
      .then((models) => {
        if (cancelled) return;
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
      })
      .catch(() => {
        /* 模型列表后台加载，不阻塞工作台 */
      });

    (async () => {
      try {
        const savedId =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PROJECT_STORAGE_KEY)
            : null;

        let projectId: string | null = null;
        let initial: ProductDesignProject | undefined;

        if (savedId) {
          try {
            const p = await getProductDesignProject(savedId);
            projectId = p.id;
            initial = p;
          } catch {
            /* 会话里 id 失效，走列表 */
          }
        }

        if (!projectId) {
          const summaries = await listProductDesignProjects();
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
  }, [alert, reload]);

  async function handleNewProject() {
    setLoading(true);
    setEmpty(false);
    try {
      const created = await createProductDesignProject({ title: "电商产品创作" });
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
          meta: { setupPhase: "style-ref" },
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
            content:
              "请选择主图制作方式：\n· 完整助手流程（Step1–9）— 平台拆解、营销方案、主图文案后出图\n· 参考图 + 自定义 Prompt（快速主图）— 跳过 Step1–4，确认 Prompt 后直接出主图",
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
  ) {
    if (!project) return;
    setRefBusy(true);
    try {
      const added: ProductDesignReference[] = assets.map((a, i) => ({
        id: `ref-${a.id.slice(-8)}-${i}`,
        label: a.title.slice(0, 40) || "资产图",
        role: "product",
        ossUrl: a.ossUrl,
      }));
      await updateProductDesignProject(project.id, {
        references: [...project.references, ...added],
        meta: { setupPhase: "style-ref" },
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

  if (needLogin) {
    return (
      <EcomLoginPrompt
        returnPath="/ecom/product-creation"
        message="使用电商产品创作需要登录。请点击下方按钮，经主站 Book 完成 SSO 后自动回到本页。"
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
          <h2 className="text-xl font-semibold text-[#1d1d1f]">电商产品创作</h2>
          <p className="max-w-md text-sm text-[#6e6e73]">
            主图 + 详情页 9 步流水线。暂无项目时点击开始，不会自动创建空项目。
          </p>
          <EcomButtonSecondary
            type="button"
            onClick={() => void handleNewProject()}
            disabled={loading}
          >
            {loading ? "创建中…" : "开始创作"}
          </EcomButtonSecondary>
        </div>
      </EcomWorkspaceLayout>
    );
  }

  const spec = specs.find((s) => s.code === project.platform) ?? null;

  return (
    <EcomWorkspaceLayout
      assistantWide={assistantWide}
      assistantHeader={
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-[#1d1d1f]">电商产品创作</h1>
              <p className="text-xs text-[#6e6e73]">
                {spec ? `${spec.label} · 主图+详情页 9 步流水线` : "主图 + 详情页 9 步流水线"}
              </p>
            </div>
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={loading || refBusy}
              onClick={() => void handleNewProject()}
            >
              新建
            </EcomButtonSecondary>
          </div>
          <div className="mt-3 space-y-3">
            <ProductDesignRefUploader
              role="product"
              required
              references={project.references}
              visionModelKey={visionModelKey}
              imageModelKey={imageModelKey}
              onUpload={handleRefUpload}
              onRemove={handleRefRemove}
              onAttachAssets={handleAttachAssets}
              busy={refBusy && uploadingRole !== "main-style"}
              uploadProgress={uploadingRole === "product" ? uploadProgress : null}
            />
            {hasProductRef(project.references) ? (
              <ProductDesignRefUploader
                role="main-style"
                references={project.references}
                visionModelKey={visionModelKey}
                imageModelKey={imageModelKey}
                onUpload={handleRefUpload}
                onRemove={handleRefRemove}
                busy={refBusy && uploadingRole !== "product"}
                uploadProgress={uploadingRole === "main-style" ? uploadProgress : null}
              />
            ) : null}
          </div>
        </>
      }
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
          onStreamingChange={setAssistantStreaming}
          onProjectChange={async () => {
            await reload(project.id);
          }}
          onRequestGenerateMainImages={() => setGenerateMainImagesToken((t) => t + 1)}
          onRequestGenerateDetailImages={() => setGenerateDetailImagesToken((t) => t + 1)}
          enterDetailPageToken={enterDetailPageToken}
          analyzeDetailDecomposeToken={analyzeDetailDecomposeToken}
          mainWorkflowChoice={mainWorkflowChoice}
          mainWorkflowChoiceToken={mainWorkflowChoiceToken}
          focusStepId={focusStepId}
          onFocusStep={(id) => setFocusStepId(id)}
        />
      }
    >
      <ProductDesignContentPanel
        project={project}
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
        refBusy={refBusy}
        onProjectChange={async () => {
          await reload(project.id);
        }}
        streaming={assistantStreaming}
        generateMainImagesToken={generateMainImagesToken}
        generateDetailImagesToken={generateDetailImagesToken}
        onEnterDetailPage={() => setEnterDetailPageToken((t) => t + 1)}
        onAnalyzeDetailDecompose={() => setAnalyzeDetailDecomposeToken((t) => t + 1)}
        onChooseMainWorkflow={(mode) => {
          setMainWorkflowChoice(mode);
          setMainWorkflowChoiceToken((t) => t + 1);
        }}
        focusStepId={focusStepId}
      />
    </EcomWorkspaceLayout>
  );
}
