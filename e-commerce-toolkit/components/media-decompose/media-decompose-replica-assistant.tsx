"use client";

import { Plus } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { EcomAssistantBottomDock } from "@/components/layout/ecom-assistant-bottom-dock";
import {
  EcomAssistantIconButton,
  ECOM_ASSISTANT_CONTROL_ICON_CLASS,
} from "@/components/layout/ecom-assistant-icon-button";
import { EcomAssistantSendButton } from "@/components/layout/ecom-assistant-send-button";
import { STORYBOARD_ASSISTANT_CHOICE_CLASS } from "@/components/storyboard/storyboard-assistant-choices";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
} from "@/lib/ecom-assistant-chat-styles";
import {
  generateMediaDecomposeReplicaModelImage,
  generateMediaDecomposeReplicaModelPrompt,
  generateMediaDecomposeReplicaScript,
  recognizeMediaDecomposeReplicaProduct,
  updateMediaDecomposeProject,
  uploadMediaDecomposeReplicaRef,
} from "@/lib/ecom-media-decompose-api";
import { updateSeedVideoProject } from "@/lib/ecom-seed-video-api";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import {
  ReplicaAttachmentTile,
  ReplicaProductBriefCard,
  ReplicaRefSlotGrid,
} from "@/components/media-decompose/media-decompose-replica-thread-blocks";
import {
  REPLICA_MODEL_REF_ID,
  REPLICA_PRODUCT_REF_ID,
} from "@/lib/media-decompose-replica-constants";
import {
  inferReplicaAssistantChoices,
  isReplicaScriptReady,
  readProductBrief,
  readReplicaPhase,
  REPLICA_CHOICE_AI_MODEL,
  REPLICA_CHOICE_AI_RECOGNIZE_PRODUCT,
  REPLICA_CHOICE_AI_WRITE_MODEL_PROMPT,
  REPLICA_CHOICE_GENERATE_SCRIPT,
  REPLICA_CHOICE_PASTE_IMAGE,
  REPLICA_CHOICE_PICK_MODEL_AND_GENERATE,
  REPLICA_CHOICE_UPLOAD_MODEL,
  REPLICA_CHOICE_UPLOAD_PRODUCT,
  replicaComposerPlaceholder,
  replicaWelcomeMessage,
  type ReplicaAssistantAttachment,
  type ReplicaAssistantMessage,
} from "@/lib/media-decompose-replica-workflow";
import type { MediaDecomposeProject } from "@/lib/media-decompose-types";
import type { SeedVideoProject } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

const WELCOME_ID = "welcome";

type ProviderProps = {
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
  children: ReactNode;
};

type ReplicaAssistantContextValue = {
  dropZoneProps: ReturnType<typeof useImageDropPaste>["dropZoneProps"];
  dragOver: boolean;
  renderComposer: () => ReactNode;
};

const ReplicaAssistantContext = createContext<ReplicaAssistantContextValue | null>(null);

function useReplicaAssistantContext() {
  const ctx = useContext(ReplicaAssistantContext);
  if (!ctx) {
    throw new Error("MediaDecomposeReplicaAssistant* must be used within MediaDecomposeReplicaAssistantProvider");
  }
  return ctx;
}

/** 复刻助手状态与 API（Provider 内共享） */
export function MediaDecomposeReplicaAssistantProvider({
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
  children,
}: ProviderProps) {
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRoleRef = useRef<"model" | "product">("model");

  const phase = readReplicaPhase(seedVideo);
  const modelRef = seedVideo.references.find((r) => r.id === REPLICA_MODEL_REF_ID);
  const productRef = seedVideo.references.find((r) => r.id === REPLICA_PRODUCT_REF_ID);
  const modelReady = Boolean(modelRef?.ossUrl?.trim());
  const productReady = Boolean(productRef?.ossUrl?.trim());
  const scriptReady = isReplicaScriptReady(seedVideo, phase);

  const [messages, setMessages] = useState<ReplicaAssistantMessage[]>(() => [
    { id: WELCOME_ID, role: "assistant", content: replicaWelcomeMessage(), createdAt: new Date().toISOString() },
  ]);
  const [input, setInput] = useState("");
  const [productBriefDraft, setProductBriefDraft] = useState(() =>
    readProductBrief(project, seedVideo),
  );
  const productBriefDirtyRef = useRef(false);
  const [briefSaveBusy, setBriefSaveBusy] = useState(false);
  const [uploadingRole, setUploadingRole] = useState<"model" | "product" | null>(null);
  const [modelPreviewUrl, setModelPreviewUrl] = useState<string | null>(null);
  const [productPreviewUrl, setProductPreviewUrl] = useState<string | null>(null);
  const [modelPromptDraft, setModelPromptDraft] = useState("");
  const [modelGenDraft, setModelGenDraft] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [modelPromptBusy, setModelPromptBusy] = useState(false);
  const [modelGenBusy, setModelGenBusy] = useState(false);
  const [recognizeBusy, setRecognizeBusy] = useState(false);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imageSize, setImageSize] = useState<string | undefined>();

  const actionLocked =
    busy ||
    uploadBusy ||
    modelPromptBusy ||
    modelGenBusy ||
    recognizeBusy ||
    scriptBusy ||
    briefSaveBusy;

  const savedProductBrief = readProductBrief(project, seedVideo);
  const productBriefDirty =
    productBriefDraft.trim() !== savedProductBrief.trim();

  useEffect(() => {
    if (productBriefDirtyRef.current) return;
    setProductBriefDraft(readProductBrief(project, seedVideo));
  }, [project.id, project.meta, seedVideo.id, seedVideo.meta]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, modelGenDraft, modelReady, productReady, scriptReady, modelGenBusy, scriptBusy, recognizeBusy, productBriefDraft]);

  const appendUser = useCallback(
    (content: string, attachments?: ReplicaAssistantAttachment[]) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content,
          createdAt: new Date().toISOString(),
          attachments,
        },
      ]);
    },
    [],
  );

  const patchUserMessage = useCallback(
    (id: string, patch: Partial<ReplicaAssistantMessage>) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    [],
  );

  const appendAssistant = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, []);

  const canIngestImage = !scriptReady && (!modelReady || !productReady) && !actionLocked;

  const resolveUploadRole = useCallback((): "model" | "product" | null => {
    if (!modelReady) return "model";
    if (!productReady) return "product";
    return null;
  }, [modelReady, productReady]);

  const ingestImageFile = useCallback(
    async (file: File, source: "upload" | "paste" | "drop") => {
      const role = resolveUploadRole();
      if (!role) {
        await onAlert({
          title: source === "upload" ? "无法上传" : "无法接受图片",
          message: "模特图与产品图均已就绪，请生成复刻脚本。",
        });
        return;
      }
      const label =
        source === "upload"
          ? role === "model"
            ? "上传模特图"
            : "上传产品图"
          : source === "paste"
            ? "粘贴图片"
            : "拖入图片";
      const attachmentLabel = role === "model" ? "模特 @图片1" : "产品 @图片2";
      const previewUrl = URL.createObjectURL(file);
      const msgId = `user-${Date.now()}`;
      if (role === "model") setModelPreviewUrl(previewUrl);
      else setProductPreviewUrl(previewUrl);
      setUploadingRole(role);
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          role: "user" as const,
          content: label,
          createdAt: new Date().toISOString(),
          attachments: [
            { url: previewUrl, kind: role, label: attachmentLabel, status: "uploading" },
          ],
        },
      ]);
      setUploadBusy(true);
      try {
        const { project: nextProject, seedVideo: nextSeed } =
          await uploadMediaDecomposeReplicaRef(project.id, role, file);
        onProjectUpdated(nextProject);
        onSeedVideoUpdated(nextSeed);
        const refId = role === "model" ? REPLICA_MODEL_REF_ID : REPLICA_PRODUCT_REF_ID;
        const ossUrl = nextSeed.references.find((r) => r.id === refId)?.ossUrl?.trim() ?? "";
        patchUserMessage(msgId, {
          attachments: ossUrl
            ? [{ url: ossUrl, kind: role, label: attachmentLabel, status: "done" }]
            : undefined,
        });
        if (role === "model") {
          setModelPreviewUrl(null);
        } else {
          setProductPreviewUrl(null);
        }
        appendAssistant(
          role === "model"
            ? "模特图已就绪。请上传、粘贴或拖入 **产品图**（@图片2）。"
            : "产品图已就绪。可 AI 识产品或补充描述，然后生成复刻脚本。",
        );
        setModelGenDraft(false);
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        if (role === "model") setModelPreviewUrl(null);
        else setProductPreviewUrl(null);
        await onAlert({
          title: role === "model" ? "模特图上传失败" : "产品图上传失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        URL.revokeObjectURL(previewUrl);
        setUploadingRole(null);
        setUploadBusy(false);
      }
    },
    [
      appendAssistant,
      onAlert,
      onProjectUpdated,
      onSeedVideoUpdated,
      patchUserMessage,
      project.id,
      resolveUploadRole,
    ],
  );

  const { dropZoneProps, dragOver, pasteReady, focusZone } = useImageDropPaste({
    enabled: canIngestImage,
    onFiles: (files, via) => {
      const file = files.find((f) => f.type.startsWith("image/"));
      if (file) void ingestImageFile(file, via === "drop" ? "drop" : "paste");
    },
    onError: (title, message) => {
      void onAlert({ title, message, variant: "error" });
    },
  });

  const handleUpload = useCallback(
    async (role: "model" | "product", file: File) => {
      uploadRoleRef.current = role;
      await ingestImageFile(file, "upload");
    },
    [ingestImageFile],
  );

  async function handleAiWriteModelPrompt() {
    setModelPromptBusy(true);
    try {
      const { prompt } = await generateMediaDecomposeReplicaModelPrompt(project.id, chatModelKey);
      setModelPromptDraft(prompt);
      setInput(prompt);
      appendAssistant("已根据拆解结果写好模特生图 Prompt，请确认或编辑后点「选择模型并生成」。");
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

  async function handleSaveProductBrief() {
    const brief = productBriefDraft.trim();
    if (!brief) {
      await onAlert({
        title: "内容为空",
        message: "请先填写或 AI 识别产品描述后再保存。",
        variant: "error",
      });
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
      productBriefDirtyRef.current = false;
      onProjectUpdated(nextProject);
      onSeedVideoUpdated(nextSeed);
      appendAssistant("产品描述已保存。");
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

  async function handleRecognizeProduct() {
    setRecognizeBusy(true);
    try {
      const { project: nextProject, seedVideo: nextSeed, productBrief: brief } =
        await recognizeMediaDecomposeReplicaProduct(project.id, {
          userDraft: productBriefDraft,
        });
      productBriefDirtyRef.current = false;
      setProductBriefDraft(brief);
      onProjectUpdated(nextProject);
      onSeedVideoUpdated(nextSeed);
      appendAssistant("产品描述已识别并写入上方卡片。确认无误后保存，再点「生成复刻脚本」。");
    } catch (e) {
      await onAlert({
        title: "识产品失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRecognizeBusy(false);
    }
  }

  async function handleGenerateScript(briefOverride?: string) {
    const brief = (briefOverride ?? productBriefDraft).trim();
    if (!brief) {
      await onAlert({
        title: "缺少产品描述",
        message: "请先在上方产品描述卡片 AI 识产品或手动填写。",
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
      appendUser("生成复刻脚本");
      appendAssistant("复刻脚本已生成。请在本页下方「方案② · 精细成片」编辑分镜、增删镜头并生成视频。");
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

  async function handleModelImageGenerate(modelKey: string) {
    const prompt = (modelPromptDraft || input).trim();
    if (!prompt) {
      await onAlert({ title: "缺少 Prompt", message: "请先填写或 AI 生成模特 Prompt。", variant: "error" });
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
      const modelUrl =
        nextSeed.references.find((r) => r.id === REPLICA_MODEL_REF_ID)?.ossUrl?.trim() ?? "";
      appendUser(
        "AI 生成模特图",
        modelUrl ? [{ url: modelUrl, kind: "model", label: "模特 @图片1", status: "done" }] : undefined,
      );
      appendAssistant("模特图已生成。请上传或粘贴 **产品图**（@图片2）。");
      setModelGenDraft(false);
      setModelPromptDraft("");
      setInput("");
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

  async function handleChoice(choice: string) {
    if (choice === REPLICA_CHOICE_UPLOAD_MODEL) {
      uploadRoleRef.current = "model";
      fileInputRef.current?.click();
      return;
    }
    if (choice === REPLICA_CHOICE_UPLOAD_PRODUCT) {
      uploadRoleRef.current = "product";
      fileInputRef.current?.click();
      return;
    }
    if (choice === REPLICA_CHOICE_PASTE_IMAGE) {
      focusZone();
      return;
    }
    if (choice === REPLICA_CHOICE_AI_MODEL) {
      setModelGenDraft(true);
      appendUser(choice);
      appendAssistant(
        "请编辑 Prompt，或点「AI 写模特提示词」自动根据拆解结果生成，然后点「选择模型并生成」。",
      );
      return;
    }
    if (choice === REPLICA_CHOICE_AI_WRITE_MODEL_PROMPT) {
      appendUser(choice);
      await handleAiWriteModelPrompt();
      return;
    }
    if (choice === REPLICA_CHOICE_PICK_MODEL_AND_GENERATE) {
      setModelPromptDraft((modelPromptDraft || input).trim());
      setImagePickerOpen(true);
      return;
    }
    if (choice === REPLICA_CHOICE_AI_RECOGNIZE_PRODUCT) {
      appendUser(choice);
      await handleRecognizeProduct();
      return;
    }
    if (choice === REPLICA_CHOICE_GENERATE_SCRIPT) {
      appendUser(choice);
      await handleGenerateScript();
      return;
    }
  }

  async function handleSendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || actionLocked || scriptReady) return;

    appendUser(trimmed);

    if (modelGenDraft && !modelReady) {
      setModelPromptDraft(trimmed);
      appendAssistant("Prompt 已更新。点「选择模型并生成」挑选 IMAGE 模型并出图。");
      setInput("");
      return;
    }

    if (modelReady && !productReady) {
      appendAssistant("请先上传或粘贴产品图。");
      setInput("");
      return;
    }

    if (modelReady && productReady) {
      productBriefDirtyRef.current = true;
      setProductBriefDraft(trimmed);
      appendAssistant("已写入上方产品描述卡片。确认后点「保存」或「生成复刻脚本」。");
      setInput("");
      return;
    }
  }

  const choices = useMemo(
    () =>
      inferReplicaAssistantChoices({
        phase,
        modelReady,
        productReady,
        scriptReady,
        modelGenDraft,
        productBrief: productBriefDraft,
        modelPromptDraft: modelPromptDraft || input,
      }),
    [phase, modelReady, productReady, scriptReady, modelGenDraft, productBriefDraft, modelPromptDraft, input],
  );

  const renderMessageAttachments = (attachments: ReplicaAssistantAttachment[]) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a, index) => (
        <ReplicaAttachmentTile
          key={`${a.url}-${index}`}
          url={a.url}
          label={a.label}
          status={a.status}
        />
      ))}
    </div>
  );

  const renderComposer = () => (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleUpload(uploadRoleRef.current, file);
        }}
      />
      <div className="flex min-w-0 flex-1 items-end gap-2">
        <EcomAssistantIconButton
          variant="muted"
          title={
            !canIngestImage
              ? "当前不可上传图片"
              : !modelReady
                ? "上传模特图"
                : "上传产品图"
          }
          disabled={!canIngestImage}
          className="mb-0.5"
          onClick={() => {
            const role = resolveUploadRole();
            if (!role) return;
            uploadRoleRef.current = role;
            fileInputRef.current?.click();
          }}
        >
          <Plus className={ECOM_ASSISTANT_CONTROL_ICON_CLASS} />
        </EcomAssistantIconButton>
        <textarea
          className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
          rows={1}
          placeholder={replicaComposerPlaceholder({
            modelReady,
            productReady,
            scriptReady,
            modelGenDraft,
            pasteReady: canIngestImage && pasteReady,
          })}
          value={input}
          disabled={actionLocked || scriptReady}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSendText(input);
            }
          }}
        />
        <EcomAssistantSendButton
          disabled={actionLocked || scriptReady || !input.trim()}
          busy={scriptBusy}
          onClick={() => void handleSendText(input)}
        />
      </div>
    </>
  );

  const contextValue = useMemo(
    () => ({ dropZoneProps, dragOver, renderComposer }),
    [dropZoneProps, dragOver, renderComposer],
  );

  return (
    <ReplicaAssistantContext.Provider value={contextValue}>
      <ReplicaAssistantRuntime
        threadEndRef={threadEndRef}
        messages={messages}
        choices={choices}
        actionLocked={actionLocked}
        modelGenBusy={modelGenBusy}
        scriptBusy={scriptBusy}
        recognizeBusy={recognizeBusy}
        handleChoice={handleChoice}
        renderMessageAttachments={renderMessageAttachments}
        modelUrl={modelRef?.ossUrl}
        productUrl={productRef?.ossUrl}
        modelPreviewUrl={modelPreviewUrl}
        productPreviewUrl={productPreviewUrl}
        uploadingRole={uploadingRole}
        modelReady={modelReady}
        productReady={productReady}
        scriptReady={scriptReady}
        productBriefDraft={productBriefDraft}
        onProductBriefDraftChange={(value) => {
          productBriefDirtyRef.current = true;
          setProductBriefDraft(value);
        }}
        onSaveProductBrief={handleSaveProductBrief}
        onRecognizeProduct={handleRecognizeProduct}
        briefSaveBusy={briefSaveBusy}
        productBriefDirty={productBriefDirty}
        imageModels={imageModels}
        imageModelKey={imageModelKey}
        onImageModelChange={onImageModelChange}
        modelsLoading={modelsLoading}
        onRefreshModels={onRefreshModels}
        imagePickerOpen={imagePickerOpen}
        setImagePickerOpen={setImagePickerOpen}
        imageSize={imageSize}
        setImageSize={setImageSize}
        handleModelImageGenerate={handleModelImageGenerate}
        dropZoneProps={dropZoneProps}
        dragOver={dragOver}
      >
        {children}
      </ReplicaAssistantRuntime>
    </ReplicaAssistantContext.Provider>
  );
}

/** 内部：向 Thread 注入运行时 props，避免 Context 过大 */
const ReplicaThreadContext = createContext<{
  threadEndRef: React.RefObject<HTMLDivElement | null>;
  messages: ReplicaAssistantMessage[];
  choices: string[];
  actionLocked: boolean;
  modelGenBusy: boolean;
  scriptBusy: boolean;
  recognizeBusy: boolean;
  handleChoice: (choice: string) => void | Promise<void>;
  renderMessageAttachments: (attachments: ReplicaAssistantAttachment[]) => ReactNode;
  modelUrl?: string;
  productUrl?: string;
  modelPreviewUrl?: string | null;
  productPreviewUrl?: string | null;
  uploadingRole?: "model" | "product" | null;
  modelReady: boolean;
  productReady: boolean;
  scriptReady: boolean;
  productBriefDraft: string;
  onProductBriefDraftChange: (value: string) => void;
  onSaveProductBrief: () => void | Promise<void>;
  onRecognizeProduct: () => void | Promise<void>;
  briefSaveBusy: boolean;
  productBriefDirty: boolean;
} | null>(null);

function useReplicaThread() {
  const ctx = useContext(ReplicaThreadContext);
  if (!ctx) throw new Error("MediaDecomposeReplicaAssistantThread requires Provider");
  return ctx;
}

type RuntimeProps = {
  threadEndRef: React.RefObject<HTMLDivElement | null>;
  messages: ReplicaAssistantMessage[];
  choices: string[];
  actionLocked: boolean;
  modelGenBusy: boolean;
  scriptBusy: boolean;
  recognizeBusy: boolean;
  handleChoice: (choice: string) => void | Promise<void>;
  renderMessageAttachments: (attachments: ReplicaAssistantAttachment[]) => ReactNode;
  modelUrl?: string;
  productUrl?: string;
  modelPreviewUrl?: string | null;
  productPreviewUrl?: string | null;
  uploadingRole?: "model" | "product" | null;
  modelReady: boolean;
  productReady: boolean;
  scriptReady: boolean;
  productBriefDraft: string;
  onProductBriefDraftChange: (value: string) => void;
  onSaveProductBrief: () => void | Promise<void>;
  onRecognizeProduct: () => void | Promise<void>;
  briefSaveBusy: boolean;
  productBriefDirty: boolean;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  onImageModelChange: (key: string) => void;
  modelsLoading?: boolean;
  onRefreshModels?: () => void;
  imagePickerOpen: boolean;
  setImagePickerOpen: (open: boolean) => void;
  imageSize: string | undefined;
  setImageSize: (size: string | undefined) => void;
  handleModelImageGenerate: (modelKey: string) => void | Promise<void>;
  dropZoneProps: ReturnType<typeof useImageDropPaste>["dropZoneProps"];
  dragOver: boolean;
  children: ReactNode;
};

function ReplicaAssistantRuntime({
  threadEndRef,
  messages,
  choices,
  actionLocked,
  modelGenBusy,
  scriptBusy,
  recognizeBusy,
  handleChoice,
  renderMessageAttachments,
  modelUrl,
  productUrl,
  modelPreviewUrl,
  productPreviewUrl,
  uploadingRole,
  modelReady,
  productReady,
  scriptReady,
  productBriefDraft,
  onProductBriefDraftChange,
  onSaveProductBrief,
  onRecognizeProduct,
  briefSaveBusy,
  productBriefDirty,
  imageModels,
  imageModelKey,
  onImageModelChange,
  modelsLoading,
  onRefreshModels,
  imagePickerOpen,
  setImagePickerOpen,
  imageSize,
  setImageSize,
  handleModelImageGenerate,
  dropZoneProps,
  dragOver,
  children,
}: RuntimeProps) {
  const threadCtx = useMemo(
    () => ({
      threadEndRef,
      messages,
      choices,
      actionLocked,
      modelGenBusy,
      scriptBusy,
      recognizeBusy,
      handleChoice,
      renderMessageAttachments,
      modelUrl,
      productUrl,
      modelPreviewUrl,
      productPreviewUrl,
      uploadingRole,
      modelReady,
      productReady,
      scriptReady,
      productBriefDraft,
      onProductBriefDraftChange,
      onSaveProductBrief,
      onRecognizeProduct,
      briefSaveBusy,
      productBriefDirty,
    }),
    [
      threadEndRef,
      messages,
      choices,
      actionLocked,
      modelGenBusy,
      scriptBusy,
      recognizeBusy,
      handleChoice,
      renderMessageAttachments,
      modelUrl,
      productUrl,
      modelPreviewUrl,
      productPreviewUrl,
      uploadingRole,
      modelReady,
      productReady,
      scriptReady,
      productBriefDraft,
      onProductBriefDraftChange,
      onSaveProductBrief,
      onRecognizeProduct,
      briefSaveBusy,
      productBriefDirty,
    ],
  );

  return (
    <ReplicaThreadContext.Provider value={threadCtx}>
      <div
        {...dropZoneProps}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none",
          dragOver && "ring-2 ring-inset ring-[var(--ecom-chrome-accent)]/40",
        )}
        data-ecom-replica-drop-zone
      >
        {children}
      </div>
      <StoryboardModelPickerDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        mode="image"
        dialogTitle="选择 IMAGE 模型 · 生成模特参考图"
        dialogDescription="纯文生图生成新模特参考，写入 @图片1；请选 Gateway 已登记的 IMAGE 模型。"
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
    </ReplicaThreadContext.Provider>
  );
}

/** 内容区：参考图占位、对话、产品描述卡、快捷选项、任务状态 */
export function MediaDecomposeReplicaAssistantThread() {
  const {
    threadEndRef,
    messages,
    choices,
    actionLocked,
    modelGenBusy,
    scriptBusy,
    recognizeBusy,
    handleChoice,
    renderMessageAttachments,
    modelUrl,
    productUrl,
    modelPreviewUrl,
    productPreviewUrl,
    uploadingRole,
    productReady,
    scriptReady,
    productBriefDraft,
    onProductBriefDraftChange,
    onSaveProductBrief,
    onRecognizeProduct,
    briefSaveBusy,
    productBriefDirty,
  } = useReplicaThread();

  return (
    <section className="space-y-3" aria-label="复刻对话">
      <ReplicaRefSlotGrid
        modelUrl={modelUrl}
        productUrl={productUrl}
        modelPreviewUrl={modelPreviewUrl ?? undefined}
        productPreviewUrl={productPreviewUrl ?? undefined}
        uploadingRole={uploadingRole}
        modelGenerating={modelGenBusy}
      />

      <div className="space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex w-full", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
                m.role === "user" ? ECOM_ASSISTANT_USER_BUBBLE_CLASS : ECOM_ASSISTANT_BUBBLE_CLASS,
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.attachments?.length ? renderMessageAttachments(m.attachments) : null}
            </div>
          </div>
        ))}

        {productReady && !scriptReady ? (
          <ReplicaProductBriefCard
            value={productBriefDraft}
            onChange={onProductBriefDraftChange}
            onSave={onSaveProductBrief}
            onRecognize={onRecognizeProduct}
            recognizeDisabled={!productReady}
            saving={briefSaveBusy}
            recognizing={recognizeBusy}
            disabled={actionLocked && !recognizeBusy}
            dirty={productBriefDirty}
          />
        ) : null}

        {choices.length > 0 && !actionLocked ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {choices.map((c) => (
              <button
                key={c}
                type="button"
                className={STORYBOARD_ASSISTANT_CHOICE_CLASS}
                onClick={() => void handleChoice(c)}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {recognizeBusy ? (
        <StoryboardTaskStatus
          active
          sweep
          surface="content"
          title="AI 识产品中"
          detail="视觉模型正在分析产品图，识别结果将写入上方产品描述卡片…"
        />
      ) : null}
      {modelGenBusy ? (
        <StoryboardTaskStatus
          active
          sweep
          surface="content"
          title="模特图 AI 生成中"
          detail="Gateway 图像任务进行中，完成后写入 @图片1。"
        />
      ) : null}
      {scriptBusy ? (
        <StoryboardTaskStatus
          active
          sweep
          surface="content"
          title="脚本生成中"
          detail="正在根据拆解结果匹配替换分镜…"
        />
      ) : null}

      <div ref={threadEndRef as React.RefObject<HTMLDivElement>} className="h-px shrink-0" aria-hidden />
    </section>
  );
}

/** 底栏：仅聊天输入框（Cursor 底部 Composer） */
export function MediaDecomposeReplicaAssistantComposer() {
  const { renderComposer } = useReplicaAssistantContext();
  return <EcomAssistantBottomDock composer={renderComposer()} />;
}
