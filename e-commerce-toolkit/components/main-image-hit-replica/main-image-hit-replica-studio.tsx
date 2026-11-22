"use client";

import { useCallback, useEffect, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { MainImageHitReplicaConfigSidebar } from "@/components/main-image-hit-replica/main-image-hit-replica-config-sidebar";
import { MainImageHitReplicaContentPanel } from "@/components/main-image-hit-replica/main-image-hit-replica-content-panel";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  createMainImageHitReplicaProject,
  getMainImageHitReplicaProject,
  listMainImageHitReplicaSummaries,
  removeMainImageHitReplicaRef,
  replicateMainImageHit,
  updateMainImageHitReplicaProject,
  uploadMainImageHitReplicaRef,
} from "@/lib/ecom-main-image-hit-replica-api";
import { fetchStoryboardModels } from "@/lib/ecom-storyboard-api";
import { readEcomLastProjectId, writeEcomLastProjectId } from "@/lib/ecom-last-project";
import type { MainImageHitReplicaProject } from "@/lib/main-image-hit-replica-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import { hitReplicaBuildImageGenSize } from "@/lib/main-image-hit-replica-settings";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const STORAGE_KEY = "ecom-main-image-hit-replica-active-project";
const DEFAULT_IMAGE_MODEL = "wan2.7-image";
const RETURN_PATH = "/ecom/main-image-hit-replica";

export function MainImageHitReplicaStudio() {
  const { alert, doubleConfirm, toast } = useDialogs();
  const [project, setProject] = useState<MainImageHitReplicaProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [replicating, setReplicating] = useState(false);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModelKey, setImageModelKey] = useState(DEFAULT_IMAGE_MODEL);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async (id: string) => {
    const p = await getMainImageHitReplicaProject(id);
    setProject(p);
    if (p.settings.imageModelKey) setImageModelKey(p.settings.imageModelKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const models = await fetchStoryboardModels();
        if (cancelled) return;
        const images = models.imageModels;
        setImageModels(images);
        setImageModelKey(
          pickBoundStoryboardModelKey(images, DEFAULT_IMAGE_MODEL) ?? DEFAULT_IMAGE_MODEL,
        );

        const lastId = readEcomLastProjectId(STORAGE_KEY);
        const summaries = await listMainImageHitReplicaSummaries();
        const id = lastId && summaries.some((s) => s.id === lastId) ? lastId : summaries[0]?.id;
        if (!id) {
          setEmpty(true);
          return;
        }
        await reload(id);
        writeEcomLastProjectId(STORAGE_KEY, id);
      } catch (e) {
        if (isEcomUnauthorizedError(e)) {
          setNeedLogin(true);
        } else {
          const msg = e instanceof Error ? e.message : "加载失败";
          setLoadError(msg);
          setEmpty(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const handleNewProject = async () => {
    setLoadError(null);
    try {
      const p = await createMainImageHitReplicaProject();
      setProject(p);
      setEmpty(false);
      writeEcomLastProjectId(STORAGE_KEY, p.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "创建失败";
      setLoadError(msg);
      await alert({
        title: "无法开始",
        message: msg.includes("EcomMainImageHitReplicaProject")
          ? "Book 服务 Prisma 未更新。请在 book-mall 执行 pnpm db:generate 后重启 pnpm dev:all。"
          : msg,
        variant: "error",
      });
    }
  };

  const handleReplicate = async () => {
    if (!project) return;
    if (project.references.filter((r) => r.role === "reference").length === 0) {
      await alert({
        title: "无法复刻",
        message: "请先在中栏上传至少 1 张参考图。",
        variant: "error",
      });
      return;
    }
    setReplicating(true);
    try {
      await updateMainImageHitReplicaProject(project.id, {
        settings: { imageModelKey },
      });
      const result = await replicateMainImageHit(project.id, { modelKey: imageModelKey });
      setProject(result.project);
      if (result.failures.length > 0) {
        await alert({
          title: "部分失败",
          message: `成功 ${result.generated} 张；失败 ${result.failures.length} 张。`,
          variant: "error",
        });
      } else {
        toast({ title: "复刻完成", message: `共 ${result.generated} 张`, variant: "success" });
      }
    } catch (e) {
      await alert({
        title: "复刻失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setReplicating(false);
    }
  };

  const busyAll = refBusy || replicating || project?.status === "generating";

  if (needLogin) {
    return <EcomLoginPrompt returnPath={RETURN_PATH} message="使用爆款图复刻需要登录。" />;
  }

  if (loading && !project) {
    return <ProductCreationStudioSkeleton />;
  }

  if (empty || !project) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-[#1d1d1f]">爆款图复刻</h2>
          <p className="max-w-md text-sm text-[#6e6e73]">
            上传爆款参考图，替换自家产品，一键生成同款结构主图/海报。
          </p>
          {loadError ? (
            <p className="max-w-md text-xs text-red-600">{loadError}</p>
          ) : null}
          <EcomButtonSecondary type="button" onClick={() => void handleNewProject()} disabled={loading}>
            开始创作
          </EcomButtonSecondary>
        </div>
      </EcomWorkspaceLayout>
    );
  }

  const ratio = project.settings.imageRatio;

  return (
    <>
      <EcomWorkspaceLayout
        assistant={
          <MainImageHitReplicaConfigSidebar
            project={project}
            disabled={refBusy}
            replicating={replicating || project.status === "generating"}
            imageModels={imageModels}
            imageModelKey={imageModelKey}
            onProjectChange={() => reload(project.id)}
            onOpenModelPicker={() => setModelPickerOpen(true)}
          />
        }
        assistantFooter={
          <div className="px-4 py-3">
            <EcomButtonPrimary
              type="button"
              className="w-full"
              disabled={Boolean(busyAll)}
              onClick={() => void handleReplicate()}
            >
              {replicating || project.status === "generating" ? "复刻进行中…" : "一键复刻爆款图"}
            </EcomButtonPrimary>
          </div>
        }
      >
        <MainImageHitReplicaContentPanel
          project={project}
          ratio={ratio}
          refBusy={refBusy}
          replicating={replicating || project.status === "generating"}
          onUpload={async (file, role) => {
            setRefBusy(true);
            try {
              const p = await uploadMainImageHitReplicaRef(project.id, file, { role });
              setProject(p);
            } catch (e) {
              await alert({
                title: "上传失败",
                message: e instanceof Error ? e.message : "无法上传",
                variant: "error",
              });
            } finally {
              setRefBusy(false);
            }
          }}
          onSaveReferences={async (references) => {
            const p = await updateMainImageHitReplicaProject(project.id, { references });
            setProject(p);
          }}
          onRemoveRef={(refId, role) => {
            void (async () => {
              const ok = await doubleConfirm({
                title: role === "reference" ? "删除参考图" : "删除产品图",
                message: "确定移除这张图片？",
                secondTitle: "不可恢复",
                secondMessage: "移除后需重新上传。",
                confirmLabel: "删除",
              });
              if (!ok) return;
              const p = await removeMainImageHitReplicaRef(project.id, refId);
              setProject(p);
            })();
          }}
        />
      </EcomWorkspaceLayout>

      <StoryboardModelPickerDialog
        open={modelPickerOpen}
        onOpenChange={setModelPickerOpen}
        mode="image"
        models={imageModels}
        value={imageModelKey}
        onChange={setImageModelKey}
        onConfirm={(modelKey) => {
          void (async () => {
            setImageModelKey(modelKey);
            const imageGenSize = hitReplicaBuildImageGenSize(
              project.settings.imageRatio,
              project.settings.outputResolution ?? "2K",
            );
            const p = await updateMainImageHitReplicaProject(project.id, {
              settings: { imageModelKey: modelKey, imageGenSize },
            });
            setProject(p);
          })();
        }}
      />
    </>
  );
}