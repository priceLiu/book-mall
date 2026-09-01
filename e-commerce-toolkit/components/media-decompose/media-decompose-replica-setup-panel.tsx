"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { ReplicaProductBriefCard } from "@/components/media-decompose/media-decompose-replica-thread-blocks";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import {
  generateMediaDecomposeReplicaModelImage,
  generateMediaDecomposeReplicaModelPrompt,
  generateMediaDecomposeReplicaScript,
  mockMediaDecomposeReplicaRecognizeProduct,
  recognizeMediaDecomposeReplicaProduct,
  removeMediaDecomposeReplicaRef,
  updateMediaDecomposeProject,
  uploadMediaDecomposeReplicaRef,
} from "@/lib/ecom-media-decompose-api";
import { updateSeedVideoProject } from "@/lib/ecom-seed-video-api";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { isMediaDecomposeMockDevUiEnabled } from "@/lib/media-decompose-mock-dev";
import {
  isReplicaModelRefId,
  isReplicaProductRefId,
  listReplicaModelRefs,
  listReplicaProductRefs,
  REPLICA_REF_MAX_PER_ROLE,
} from "@/lib/media-decompose-replica-refs";
import { readProductBrief } from "@/lib/media-decompose-replica-workflow";
import type { MediaDecomposeProject } from "@/lib/media-decompose-types";
import type { SeedVideoProject } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type UploadRole = "model" | "product";

type Props = {
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
  chatModelKey: string;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  onImageModelChange: (key: string) => void;
  modelsLoading?: boolean;
  onRefreshModels?: () => void;
  busy?: boolean;
  onProjectUpdated: (project: MediaDecomposeProject) => void;
  onSeedVideoUpdated: (seedVideo: SeedVideoProject) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

const ROLE_SECTIONS: Array<{
  role: UploadRole;
  title: string;
  emptyHint: string;
  required?: boolean;
}> = [
  {
    role: "model",
    title: "模特图",
    required: true,
    emptyHint: `上传、粘贴或拖入模特参考（可多张，最多 ${REPLICA_REF_MAX_PER_ROLE} 张）。@图片1 起为模特编号。`,
  },
  {
    role: "product",
    title: "产品图",
    required: true,
    emptyHint: `上传、粘贴或拖入产品图（可多张，最多 ${REPLICA_REF_MAX_PER_ROLE} 张）。排在模特图之后的 @图片N 为产品。`,
  },
];

export function MediaDecomposeReplicaSetupPanel({
  project,
  seedVideo,
  chatModelKey,
  imageModels,
  imageModelKey,
  onImageModelChange,
  modelsLoading,
  onRefreshModels,
  busy,
  onProjectUpdated,
  onSeedVideoUpdated,
  onAlert,
}: Props) {
  const { doubleConfirm } = useDialogs();
  const inputRefs = useRef<Record<UploadRole, HTMLInputElement | null>>({
    model: null,
    product: null,
  });

  const [activeRole, setActiveRole] = useState<UploadRole>("model");
  const [uploadingRole, setUploadingRole] = useState<UploadRole | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [productBriefDraft, setProductBriefDraft] = useState(() =>
    readProductBrief(project, seedVideo),
  );
  const briefDirtyRef = useRef(false);
  const [briefSaveBusy, setBriefSaveBusy] = useState(false);
  const [recognizeBusy, setRecognizeBusy] = useState(false);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [modelPromptBusy, setModelPromptBusy] = useState(false);
  const [modelGenBusy, setModelGenBusy] = useState(false);
  const [modelPromptDraft, setModelPromptDraft] = useState("");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imageSize, setImageSize] = useState<string | undefined>();

  const modelRefs = listReplicaModelRefs(seedVideo.references);
  const productRefs = listReplicaProductRefs(seedVideo.references);
  const savedProductBrief = readProductBrief(project, seedVideo);
  const productBriefDirty = productBriefDraft.trim() !== savedProductBrief.trim();
  const actionLocked =
    busy || Boolean(uploadingRole) || briefSaveBusy || recognizeBusy || scriptBusy || modelPromptBusy || modelGenBusy;

  useEffect(() => {
    if (briefDirtyRef.current) return;
    setProductBriefDraft(readProductBrief(project, seedVideo));
  }, [project.id, project.meta, seedVideo.id, seedVideo.meta]);

  const refsForRole = useCallback(
    (role: UploadRole) => (role === "model" ? modelRefs : productRefs),
    [modelRefs, productRefs],
  );

  const uploadFile = useCallback(
    async (file: File, role: UploadRole) => {
      if (actionLocked) return;
      if (refsForRole(role).length >= REPLICA_REF_MAX_PER_ROLE) {
        await onAlert({
          title: "已达上限",
          message: `${role === "model" ? "模特" : "产品"}图最多 ${REPLICA_REF_MAX_PER_ROLE} 张`,
          variant: "error",
        });
        return;
      }
      setUploadingRole(role);
      setUploadProgress(null);
      try {
        const { project: nextProject, seedVideo: nextSeed } =
          await uploadMediaDecomposeReplicaRef(project.id, role, file);
        onProjectUpdated(nextProject);
        onSeedVideoUpdated(nextSeed);
      } catch (e) {
        await onAlert({
          title: role === "model" ? "模特图上传失败" : "产品图上传失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setUploadingRole(null);
        setUploadProgress(null);
      }
    },
    [actionLocked, onAlert, onProjectUpdated, onSeedVideoUpdated, project.id, refsForRole],
  );

  async function handleFiles(files: File[], role: UploadRole) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      await uploadFile(file, role);
    }
    if (inputRefs.current[role]) inputRefs.current[role]!.value = "";
  }

  const activeRoleRef = useRef(activeRole);
  activeRoleRef.current = activeRole;

  const { dropZoneProps, dragOver, pasteReady, focusZone } = useImageDropPaste({
    enabled: !actionLocked,
    multiple: true,
    onFiles: (files) => void handleFiles(files, activeRoleRef.current),
    onError: (title, message) => {
      void onAlert({ title, message, variant: "error" });
    },
  });

  async function handleRemove(refId: string, title: string) {
    if (
      !(await doubleConfirm({
        title: `删除${title}`,
        message: "将从复刻参考图列表移除此图。",
        secondTitle: "确认删除",
        secondMessage: "删除后需重新上传。本地表单不会恢复此图。",
        confirmLabel: "删除",
      }))
    ) {
      return;
    }
    try {
      const { project: nextProject, seedVideo: nextSeed } =
        await removeMediaDecomposeReplicaRef(project.id, refId);
      onProjectUpdated(nextProject);
      onSeedVideoUpdated(nextSeed);
    } catch (e) {
      await onAlert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function handleSaveProductBrief() {
    const brief = productBriefDraft.trim();
    if (!brief) {
      await onAlert({ title: "内容为空", message: "请先填写产品描述。", variant: "error" });
      return;
    }
    setBriefSaveBusy(true);
    try {
      const nextProject = await updateMediaDecomposeProject(project.id, {
        meta: { ...(project.meta ?? {}), replicaProductBrief: brief },
      });
      const nextSeed = await updateSeedVideoProject(seedVideo.id, {
        meta: {
          ...(seedVideo.meta ?? {}),
          replicaProductBrief: brief,
          replicaCollectPhase: "ready",
        },
      });
      briefDirtyRef.current = false;
      onProjectUpdated(nextProject);
      onSeedVideoUpdated(nextSeed);
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBriefSaveBusy(false);
    }
  }

  async function handleRecognizeProduct(mock = false) {
    setRecognizeBusy(true);
    try {
      const result = mock
        ? await mockMediaDecomposeReplicaRecognizeProduct(project.id)
        : await recognizeMediaDecomposeReplicaProduct(project.id, chatModelKey);
      briefDirtyRef.current = false;
      setProductBriefDraft(result.productBrief);
      onProjectUpdated(result.project);
      onSeedVideoUpdated(result.seedVideo);
    } catch (e) {
      await onAlert({
        title: mock ? "Mock 识产品失败" : "识产品失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRecognizeBusy(false);
    }
  }

  async function handleGenerateScript() {
    const brief = productBriefDraft.trim();
    if (!modelRefs.length) {
      await onAlert({ title: "缺少模特图", message: "请至少上传 1 张模特图。", variant: "error" });
      return;
    }
    if (!productRefs.length) {
      await onAlert({ title: "缺少产品图", message: "请至少上传 1 张产品图。", variant: "error" });
      return;
    }
    if (!brief) {
      await onAlert({
        title: "缺少产品描述",
        message: "请先填写或 AI 识别产品描述。",
        variant: "error",
      });
      return;
    }
    setScriptBusy(true);
    try {
      const { project: nextProject, seedVideo: nextSeed } =
        await generateMediaDecomposeReplicaScript(project.id, {
          productBrief: brief,
          modelKey: chatModelKey,
        });
      onProjectUpdated(nextProject);
      onSeedVideoUpdated(nextSeed);
    } catch (e) {
      await onAlert({
        title: "脚本生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setScriptBusy(false);
    }
  }

  async function handleAiWriteModelPrompt() {
    setModelPromptBusy(true);
    try {
      const { prompt } = await generateMediaDecomposeReplicaModelPrompt(project.id, chatModelKey);
      setModelPromptDraft(prompt);
      setImagePickerOpen(true);
    } catch (e) {
      await onAlert({
        title: "写 Prompt 失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setModelPromptBusy(false);
    }
  }

  async function handleModelImageGenerate(modelKey: string) {
    const prompt = modelPromptDraft.trim();
    if (!prompt) {
      await onAlert({ title: "缺少 Prompt", message: "请先 AI 写模特提示词。", variant: "error" });
      return;
    }
    setModelGenBusy(true);
    setImagePickerOpen(false);
    onImageModelChange(modelKey);
    try {
      const { project: nextProject, seedVideo: nextSeed } =
        await generateMediaDecomposeReplicaModelImage(project.id, {
          prompt,
          modelKey,
          imageSize,
        });
      onProjectUpdated(nextProject);
      onSeedVideoUpdated(nextSeed);
      setModelPromptDraft("");
    } catch (e) {
      await onAlert({
        title: "模特图生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setModelGenBusy(false);
    }
  }

  function filterRefItems(role: UploadRole) {
    return seedVideo.references
      .filter((r) =>
        role === "model" ? isReplicaModelRefId(r.id) : isReplicaProductRefId(r.id),
      )
      .map((r) => ({ id: r.id, ossUrl: r.ossUrl, label: r.label }));
  }

  return (
    <div className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-[#1d1d1f]">一键复刻 · 素材采集</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">
          上传新模特与产品参考图，填写卖点后生成复刻脚本。参考图编号按顺序为 @图片1、@图片2…（先模特后产品）。
        </p>
      </div>

      <div
        {...dropZoneProps}
        className={cn(
          "space-y-2 rounded-lg outline-none transition-shadow",
          dragOver && "ring-2 ring-[var(--ecom-chrome-accent)]/30",
          pasteReady && "ring-2 ring-[#0071e3]/20",
        )}
        onMouseEnter={() => focusZone()}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            复刻参考图
          </span>
          <span className="text-[10px] text-[#86868b]">
            {IMAGE_UPLOAD_DROP_HINT}
            {pasteReady ? " · 粘贴至当前选中行" : ""}
          </span>
        </div>

        {ROLE_SECTIONS.map(({ role, title, emptyHint, required }) => (
          <EcomRefUploadCard
            key={role}
            title={title}
            suggested={activeRole === role}
            listenPaste={false}
            items={filterRefItems(role)}
            emptyHint={emptyHint}
            busy={actionLocked}
            uploadProgress={uploadingRole === role ? uploadProgress : null}
            generating={role === "model" && modelGenBusy}
            generatingLabel="AI 生成模特中…"
            onUploadFiles={(files) => void handleFiles(files, role)}
            onOpenFilePicker={() => {
              setActiveRole(role);
              inputRefs.current[role]?.click();
            }}
            onRemove={(id) => void handleRemove(id, title)}
            removeLabel={`删除${title}`}
            onTitleClick={() => setActiveRole(role)}
            onMouseEnterCard={() => {
              setActiveRole(role);
              focusZone();
            }}
            inputRef={(el) => {
              inputRefs.current[role] = el;
            }}
            toolbarPrefix={
              role === "model" ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  dark
                  disabled={actionLocked || modelRefs.length >= REPLICA_REF_MAX_PER_ROLE}
                  onClick={() => void handleAiWriteModelPrompt()}
                >
                  {modelPromptBusy ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                  )}
                  AI 生成模特
                </EcomButtonSecondary>
              ) : undefined
            }
          />
        ))}
      </div>

      <ReplicaProductBriefCard
        value={productBriefDraft}
        onChange={(value) => {
          briefDirtyRef.current = true;
          setProductBriefDraft(value);
        }}
        onSave={handleSaveProductBrief}
        saving={briefSaveBusy}
        recognizing={recognizeBusy}
        disabled={actionLocked && !recognizeBusy}
        dirty={productBriefDirty}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <EcomButtonSecondary
          size="sm"
          type="button"
          dark
          disabled={actionLocked || !productRefs.length}
          onClick={() => void handleRecognizeProduct(false)}
        >
          {recognizeBusy ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              识产品中…
            </>
          ) : (
            "AI 识产品"
          )}
        </EcomButtonSecondary>
        {isMediaDecomposeMockDevUiEnabled() ? (
          <EcomButtonSecondary
            size="sm"
            type="button"
            dark
            disabled={actionLocked || !productRefs.length}
            onClick={() => void handleRecognizeProduct(true)}
          >
            Mock 识产品
          </EcomButtonSecondary>
        ) : null}
        <EcomButtonPrimary
          size="sm"
          type="button"
          disabled={actionLocked}
          onClick={() => void handleGenerateScript()}
        >
          {scriptBusy ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              脚本生成中…
            </>
          ) : (
            "生成复刻脚本"
          )}
        </EcomButtonPrimary>
      </div>

      {recognizeBusy ? (
        <StoryboardTaskStatus
          active
          sweep
          surface="content"
          title="AI 识产品中"
          detail="视觉模型正在分析产品图，结果将写入上方产品描述…"
        />
      ) : null}
      {scriptBusy ? (
        <StoryboardTaskStatus
          active
          sweep
          surface="content"
          title="脚本生成中"
          detail="正在根据拆解结果与参考图匹配替换分镜…"
        />
      ) : null}

      <StoryboardModelPickerDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        mode="image"
        dialogTitle="选择 IMAGE 模型 · 生成模特参考图"
        dialogDescription="纯文生图生成新模特参考，追加到模特图列表。"
        footerHint="确认后开始生图，任务经 Gateway 记录。"
        confirmLabel="开始生成"
        models={imageModels}
        modelsLoading={modelsLoading}
        modelsEmptyHint="暂无可用 IMAGE 模型，请检查 Gateway 凭证。"
        onRetryLoadModels={onRefreshModels}
        value={imageModelKey}
        onChange={onImageModelChange}
        imageSize={imageSize}
        onImageSizeChange={setImageSize}
        lockedImageSizeLabel="3:4（竖版模特参考）"
        onConfirm={(modelKey) => void handleModelImageGenerate(modelKey)}
        confirming={modelGenBusy}
      />
    </div>
  );
}
