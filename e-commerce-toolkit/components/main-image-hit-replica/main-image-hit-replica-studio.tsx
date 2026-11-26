"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { MainImageHitReplicaAssistantFooter } from "@/components/main-image-hit-replica/main-image-hit-replica-assistant-footer";
import { MainImageHitReplicaConfigSidebar } from "@/components/main-image-hit-replica/main-image-hit-replica-config-sidebar";
import { MainImageHitReplicaContentPanel } from "@/components/main-image-hit-replica/main-image-hit-replica-content-panel";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { EcomChatModelPickerDialog } from "@/components/storyboard/ecom-chat-model-picker-dialog";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
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
import {
  filterHitReplicaVisionChatModels,
  HIT_REPLICA_DEFAULT_VISION_MODEL,
  pickHitReplicaVisionModelKey,
} from "@/lib/main-image-hit-replica-vision-model";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import { hitReplicaBuildImageGenSize } from "@/lib/main-image-hit-replica-settings";
import { useEcomRefUploadProgress } from "@/lib/ecom-ref-upload-ui";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const STORAGE_KEY = "ecom-main-image-hit-replica-active-project";
const DEFAULT_IMAGE_MODEL = "wan2.7-image";
const RETURN_PATH = "/ecom/main-image-hit-replica";
const POLL_MS = 1500;

export function MainImageHitReplicaStudio() {
  const { alert, doubleConfirm, toast } = useDialogs();
  const [project, setProject] = useState<MainImageHitReplicaProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [replicating, setReplicating] = useState(false);
  const [batchBusyDone, setBatchBusyDone] = useState<number | undefined>();
  const batchStartLenRef = useRef(0);
  const batchRefCountRef = useRef(0);
  const { uploadingSlot, uploadProgress, runWithUploadProgress } = useEcomRefUploadProgress();
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [visionModels, setVisionModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModelKey, setImageModelKey] = useState(DEFAULT_IMAGE_MODEL);
  const [visionModelKey, setVisionModelKey] = useState(HIT_REPLICA_DEFAULT_VISION_MODEL);
  const [imageModelPickerOpen, setImageModelPickerOpen] = useState(false);
  const [visionModelPickerOpen, setVisionModelPickerOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async (id: string) => {
    const p = await getMainImageHitReplicaProject(id);
    setProject((prev) => {
      if (!prev) return p;
      const start = batchStartLenRef.current;
      if (
        replicating &&
        batchRefCountRef.current > 0 &&
        p.output.results.length < start + batchRefCountRef.current &&
        prev.output.results.length >= start + batchRefCountRef.current
      ) {
        return { ...p, output: prev.output, status: p.status === "draft" ? prev.status : p.status };
      }
      return p;
    });
    if (replicating && batchRefCountRef.current > 0) {
      const tail = p.output.results.slice(batchStartLenRef.current);
      const pending = tail.filter((r) => r.status === "generating").length;
      setBatchBusyDone(batchRefCountRef.current - pending);
    }
    return p;
  }, [replicating]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const models = await fetchStoryboardModels();
        if (cancelled) return;
        const images = models.imageModels;
        const visions = filterHitReplicaVisionChatModels(models.chatModels);
        setImageModels(images);
        setVisionModels(visions);
        setImageModelKey(
          pickBoundStoryboardModelKey(images, DEFAULT_IMAGE_MODEL) ?? DEFAULT_IMAGE_MODEL,
        );
        setVisionModelKey(
          pickHitReplicaVisionModelKey({
            models: visions,
            preferred: HIT_REPLICA_DEFAULT_VISION_MODEL,
          }),
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
    const refImages = project.references.filter((r) => r.role === "reference");
    if (refImages.length === 0) {
      await alert({
        title: "无法复刻",
        message: "请先在中栏上传至少 1 张参考图。",
        variant: "error",
      });
      return;
    }

    const baseLen = project.output.results.length;
    batchStartLenRef.current = baseLen;
    batchRefCountRef.current = refImages.length;
    setBatchBusyDone(0);

    const pendingSlots = refImages.map((ref, i) => ({
      id: crypto.randomUUID(),
      index: baseLen + i + 1,
      sourceRefId: ref.id,
      prompt: "",
      status: "generating" as const,
    }));
    setProject({
      ...project,
      status: "generating",
      output: { results: [...project.output.results, ...pendingSlots] },
    });

    setReplicating(true);
    const pollTimer = window.setInterval(() => {
      void reload(project.id);
    }, POLL_MS);

    try {
      await updateMainImageHitReplicaProject(project.id, {
        settings: { imageModelKey, visionModelKey },
      });
      const result = await replicateMainImageHit(project.id, {
        modelKey: imageModelKey,
        visionModelKey,
        pendingSlots,
      });
      setProject(result.project);
      setBatchBusyDone(refImages.length);
      if (result.failures.length > 0) {
        await alert({
          title: "部分失败",
          message: `成功 ${result.generated} 张；失败 ${result.failures.length} 张。`,
          variant: "error",
        });
      } else {
        toast({ title: "复刻完成", message: `本批共 ${result.generated} 张`, variant: "success" });
      }
    } catch (e) {
      await reload(project.id);
      await alert({
        title: "复刻失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      window.clearInterval(pollTimer);
      setReplicating(false);
      setBatchBusyDone(undefined);
    }
  };

  const genBusy = replicating || project?.status === "generating";
  const refCount = project?.references.filter((r) => r.role === "reference").length ?? 0;

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
          <h2 className="text-xl font-semibold text-[var(--ecom-ink)]">爆款图复刻</h2>
          <p className="max-w-md text-sm text-[var(--ecom-muted)]">
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
            replicating={genBusy}
            onProjectChange={() => void reload(project.id)}
          />
        }
        assistantFooter={
          <MainImageHitReplicaAssistantFooter
            refCount={refCount}
            busy={genBusy}
            busyDone={batchBusyDone}
            visionModels={visionModels}
            visionModelKey={visionModelKey}
            imageModels={imageModels}
            imageModelKey={imageModelKey}
            onOpenVisionPicker={() => setVisionModelPickerOpen(true)}
            onOpenImagePicker={() => setImageModelPickerOpen(true)}
            onReplicate={() => void handleReplicate()}
          />
        }
      >
        <MainImageHitReplicaContentPanel
          project={project}
          ratio={ratio}
          uploadingRole={
            uploadingSlot === "product" || uploadingSlot === "reference"
              ? uploadingSlot
              : null
          }
          uploadProgress={uploadProgress}
          replicating={genBusy}
          onUpload={async (file, role) => {
            await runWithUploadProgress(role, async () => {
              try {
                const p = await uploadMainImageHitReplicaRef(project.id, file, { role });
                setProject(p);
              } catch (e) {
                await alert({
                  title: "上传失败",
                  message: e instanceof Error ? e.message : "无法上传",
                  variant: "error",
                });
              }
            });
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
        open={imageModelPickerOpen}
        onOpenChange={setImageModelPickerOpen}
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

      <EcomChatModelPickerDialog
        open={visionModelPickerOpen}
        onOpenChange={setVisionModelPickerOpen}
        dialogTitle="选择拆解模型"
        dialogDescription="选择支持图片理解的 Gateway 模型，用于分析参考图并撰写生图 Prompt。推荐 Qwen3.8 Max。"
        confirmLabel="确定"
        footerHint="确认后一键复刻将使用该模型拆解参考图。"
        models={visionModels}
        value={visionModelKey}
        onChange={setVisionModelKey}
        onConfirm={(modelKey) => {
          void (async () => {
            setVisionModelKey(modelKey);
            const p = await updateMainImageHitReplicaProject(project.id, {
              settings: { visionModelKey: modelKey },
            });
            setProject(p);
          })();
        }}
      />
    </>
  );
}