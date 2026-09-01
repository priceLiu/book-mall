"use client";

import { Loader2, Sparkles, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { ReplicaProductBriefCard } from "@/components/media-decompose/media-decompose-replica-thread-blocks";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type {
  ReplicaSetupApi,
  ReplicaSetupCopy,
  ReplicaSetupRole,
} from "@/lib/replica-setup-api";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

const REF_TOOLBAR_BTN_CLASS = "h-7 px-2 text-[10px]";

type ImportVia = "upload" | "paste" | "drop" | "asset" | "library";

type ImportState = {
  role: ReplicaSetupRole;
  via: ImportVia;
};

function importStatusLabel(via: ImportVia): string {
  switch (via) {
    case "paste":
      return "正在粘贴…";
    case "drop":
      return "正在导入拖入图片…";
    case "asset":
      return "正在导入资产…";
    case "library":
      return "正在从模特库导入…";
    default:
      return "正在上传…";
  }
}

function importStatusTitle(via: ImportVia, role: ReplicaSetupRole): string {
  const subject = role === "model" ? "模特图" : "产品图";
  switch (via) {
    case "paste":
      return `${subject}粘贴中`;
    case "drop":
      return `${subject}拖入中`;
    case "asset":
      return `${subject}资产导入中`;
    case "library":
      return "模特库导入中";
    default:
      return `${subject}上传中`;
  }
}

function importStatusDetail(via: ImportVia): string {
  switch (via) {
    case "paste":
      return "正在处理剪贴板图片并上传到云端…";
    case "drop":
      return "正在处理拖入图片并上传到云端…";
    case "asset":
      return "正在从「我的资产」追加参考图…";
    case "library":
      return "正在从模特库追加参考图…";
    default:
      return "图片经 Gateway 上传至 OSS，请稍候…";
  }
}

type Props = {
  api: ReplicaSetupApi;
  copy: ReplicaSetupCopy;
  chatModelKey: string;
  imageModels?: StoryboardGatewayModel[];
  imageModelKey?: string;
  onImageModelChange?: (key: string) => void;
  modelsLoading?: boolean;
  onRefreshModels?: () => void;
  busy?: boolean;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

export function ReplicaSetupPanel({
  api,
  copy,
  chatModelKey,
  imageModels = [],
  imageModelKey = "",
  onImageModelChange,
  modelsLoading,
  onRefreshModels,
  busy,
  onAlert,
}: Props) {
  const { doubleConfirm } = useDialogs();
  const inputRefs = useRef<Record<ReplicaSetupRole, HTMLInputElement | null>>({
    model: null,
    product: null,
  });

  const [activeRole, setActiveRole] = useState<ReplicaSetupRole>("model");
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const progressTickRef = useRef<number | null>(null);
  const [productBriefDraft, setProductBriefDraft] = useState(() => api.readProductBrief());
  const briefDirtyRef = useRef(false);
  const [briefSaveBusy, setBriefSaveBusy] = useState(false);
  const [recognizeBusy, setRecognizeBusy] = useState(false);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [modelPromptBusy, setModelPromptBusy] = useState(false);
  const [modelGenBusy, setModelGenBusy] = useState(false);
  const [modelPromptDraft, setModelPromptDraft] = useState("");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [modelLibraryOpen, setModelLibraryOpen] = useState(false);
  const [assetPickerRole, setAssetPickerRole] = useState<ReplicaSetupRole | null>(null);
  const [imageSize, setImageSize] = useState<string | undefined>();

  const allRefs = api.listRefs();
  const modelRefs = allRefs.filter((r) => api.isModelRefId(r.id));
  const productRefs = allRefs.filter((r) => api.isProductRefId(r.id));
  const savedProductBrief = api.readProductBrief();
  const productBriefDirty = productBriefDraft.trim() !== savedProductBrief.trim();
  const actionLocked =
    busy ||
    Boolean(importState) ||
    briefSaveBusy ||
    recognizeBusy ||
    scriptBusy ||
    modelPromptBusy ||
    modelGenBusy;

  useEffect(() => {
    return () => {
      if (progressTickRef.current != null) window.clearInterval(progressTickRef.current);
    };
  }, []);

  function clearProgressTick() {
    if (progressTickRef.current != null) {
      window.clearInterval(progressTickRef.current);
      progressTickRef.current = null;
    }
  }

  function beginImportProgress(role: ReplicaSetupRole, via: ImportVia) {
    setImportState({ role, via });
    setUploadProgress(10);
    clearProgressTick();
    progressTickRef.current = window.setInterval(() => {
      setUploadProgress((p) => (p != null && p < 88 ? p + 7 : p));
    }, 180);
  }

  function finishImportProgress() {
    clearProgressTick();
    setUploadProgress(100);
    setImportState(null);
    window.setTimeout(() => setUploadProgress(null), 450);
  }

  function failImportProgress() {
    clearProgressTick();
    setUploadProgress(null);
    setImportState(null);
  }

  const supportsAssets = Boolean(api.attachRefsFromAssets);
  const supportsModelLibrary = Boolean(api.attachModelFromLibrary);
  const supportsModelAi = Boolean(api.generateModelPrompt && api.generateModelImage);
  const supportsScript = Boolean(api.generateScript);

  useEffect(() => {
    if (briefDirtyRef.current) return;
    setProductBriefDraft(api.readProductBrief());
  }, [api, savedProductBrief]);

  const refsForRole = useCallback(
    (role: ReplicaSetupRole) => (role === "model" ? modelRefs : productRefs),
    [modelRefs, productRefs],
  );

  const importFiles = useCallback(
    async (files: File[], role: ReplicaSetupRole, via: ImportVia) => {
      if (actionLocked) return;
      setActiveRole(role);
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      beginImportProgress(role, via);
      try {
        for (const file of imageFiles) {
          if (refsForRole(role).length >= api.maxPerRole) {
            await onAlert({
              title: "已达上限",
              message: `${role === "model" ? "模特" : "产品"}图最多 ${api.maxPerRole} 张`,
              variant: "error",
            });
            break;
          }
          await api.uploadRef(role, file);
        }
        finishImportProgress();
      } catch (e) {
        failImportProgress();
        await onAlert({
          title: role === "model" ? "模特图上传失败" : "产品图上传失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      }
    },
    [actionLocked, api, onAlert, refsForRole],
  );

  async function handleFiles(files: File[], role: ReplicaSetupRole, via: ImportVia = "upload") {
    await importFiles(files, role, via);
    if (inputRefs.current[role]) inputRefs.current[role]!.value = "";
  }

  const activeRoleRef = useRef(activeRole);
  activeRoleRef.current = activeRole;

  const { dropZoneProps, dragOver, pasteReady, focusZone } = useImageDropPaste({
    enabled: !actionLocked,
    multiple: true,
    onFiles: (files, via) => void handleFiles(files, activeRoleRef.current, via ?? "drop"),
    onError: (title, message) => {
      void onAlert({ title, message, variant: "error" });
    },
  });

  async function handleRemove(refId: string, title: string) {
    if (
      !(await doubleConfirm({
        title: `删除${title}`,
        message: "将从参考图列表移除此图。",
        secondTitle: "确认删除",
        secondMessage: "删除后需重新上传。本地表单不会恢复此图。",
        confirmLabel: "删除",
      }))
    ) {
      return;
    }
    try {
      await api.removeRef(refId);
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
      await api.saveProductBrief(brief);
      briefDirtyRef.current = false;
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
      const result = await api.recognizeProduct({
        mock,
        userDraft: productBriefDraft,
      });
      briefDirtyRef.current = false;
      setProductBriefDraft(result.productBrief);
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
    if (!api.generateScript) return;
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
      await api.generateScript({ productBrief: brief, modelKey: chatModelKey });
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

  async function handleAttachModelFromLibrary(entry: {
    id: string;
    name: string;
    ossUrl: string;
  }) {
    if (!api.attachModelFromLibrary || actionLocked) return;
    if (modelRefs.length >= api.maxPerRole) {
      await onAlert({
        title: "已达上限",
        message: `模特图最多 ${api.maxPerRole} 张`,
        variant: "error",
      });
      return;
    }
    try {
      beginImportProgress("model", "library");
      await api.attachModelFromLibrary(entry);
      finishImportProgress();
      setModelLibraryOpen(false);
    } catch (e) {
      failImportProgress();
      await onAlert({
        title: "模特库导入失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function handleAttachFromAssets(role: ReplicaSetupRole, assetIds: string[]) {
    if (!api.attachRefsFromAssets || actionLocked || assetIds.length === 0) return;
    const remaining = api.maxPerRole - refsForRole(role).length;
    if (remaining <= 0) {
      await onAlert({
        title: "已达上限",
        message: `${role === "model" ? "模特" : "产品"}图最多 ${api.maxPerRole} 张`,
        variant: "error",
      });
      return;
    }
    try {
      beginImportProgress(role, "asset");
      await api.attachRefsFromAssets(role, assetIds.slice(0, remaining));
      finishImportProgress();
      setAssetPickerRole(null);
    } catch (e) {
      failImportProgress();
      await onAlert({
        title: role === "model" ? "模特资产导入失败" : "产品资产导入失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function handleAiWriteModelPrompt() {
    if (!api.generateModelPrompt) return;
    setModelPromptBusy(true);
    try {
      const prompt = await api.generateModelPrompt(chatModelKey);
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
    if (!api.generateModelImage) return;
    const prompt = modelPromptDraft.trim();
    if (!prompt) {
      await onAlert({ title: "缺少 Prompt", message: "请先 AI 写模特提示词。", variant: "error" });
      return;
    }
    setModelGenBusy(true);
    setImagePickerOpen(false);
    onImageModelChange?.(modelKey);
    try {
      await api.generateModelImage({ prompt, modelKey, imageSize });
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

  function filterRefItems(role: ReplicaSetupRole) {
    return allRefs
      .filter((r) => (role === "model" ? api.isModelRefId(r.id) : api.isProductRefId(r.id)))
      .map((r) => ({
        id: r.id,
        ossUrl: r.ossUrl,
        label: r.label?.trim() || (role === "model" ? "模特" : "产品"),
      }));
  }

  const roleSections: Array<{
    role: ReplicaSetupRole;
    title: string;
    emptyHint: string;
  }> = [
    { role: "model", title: "模特图", emptyHint: copy.modelEmptyHint },
    { role: "product", title: "产品图", emptyHint: copy.productEmptyHint },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-[#1d1d1f]">{copy.panelTitle}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">{copy.panelDescription}</p>
      </div>

      <div
        {...dropZoneProps}
        className={cn(
          "space-y-2 rounded-lg outline-none transition-shadow",
          dragOver && "ring-2 ring-[var(--ecom-chrome-accent)]/30",
          pasteReady && "ring-2 ring-[#0071e3]/20",
          importState && "ring-2 ring-[#0071e3]/25",
        )}
        onMouseEnter={() => focusZone()}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            {copy.refSectionLabel}
          </span>
          <span className="text-[10px] text-[#86868b]">
            {IMAGE_UPLOAD_DROP_HINT}
            {pasteReady ? " · 粘贴至当前选中行" : ""}
          </span>
        </div>

        {roleSections.map(({ role, title, emptyHint }) => (
          <EcomRefUploadCard
            key={role}
            title={title}
            suggested={activeRole === role}
            listenPaste={false}
            items={filterRefItems(role)}
            emptyHint={emptyHint}
            busy={actionLocked}
            uploadProgress={importState?.role === role ? uploadProgress : null}
            uploadProgressLabel={
              importState?.role === role ? importStatusLabel(importState.via) : undefined
            }
            generating={role === "model" && modelGenBusy}
            generatingLabel="AI 生成模特中…"
            onUploadFiles={(files) => void handleFiles(files, role)}
            onOpenFilePicker={() => {
              setActiveRole(role);
              inputRefs.current[role]?.click();
            }}
            onOpenAssetPicker={
              supportsAssets
                ? () => {
                    setActiveRole(role);
                    setAssetPickerRole(role);
                  }
                : undefined
            }
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
              role === "model" && (supportsModelLibrary || supportsModelAi) ? (
                <>
                  {supportsModelLibrary ? (
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={actionLocked || modelRefs.length >= api.maxPerRole}
                      className={REF_TOOLBAR_BTN_CLASS}
                      onClick={() => {
                        setActiveRole("model");
                        setModelLibraryOpen(true);
                      }}
                    >
                      <UserRound className="h-3 w-3 shrink-0" />
                      模特库
                    </EcomButtonSecondary>
                  ) : null}
                  {supportsModelAi ? (
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={actionLocked || modelRefs.length >= api.maxPerRole}
                      className={REF_TOOLBAR_BTN_CLASS}
                      onClick={() => void handleAiWriteModelPrompt()}
                    >
                      {modelPromptBusy ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 shrink-0" />
                      )}
                      AI生成
                    </EcomButtonSecondary>
                  ) : null}
                </>
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
        onRecognize={() => handleRecognizeProduct(false)}
        recognizeDisabled={!productRefs.length}
        saving={briefSaveBusy}
        recognizing={recognizeBusy}
        disabled={actionLocked && !recognizeBusy}
        dirty={productBriefDirty}
      />

      {(api.mockDevEnabled?.() || supportsScript) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {api.mockDevEnabled?.() ? (
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
          {supportsScript ? (
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
          ) : null}
        </div>
      )}

      {importState ? (
        <StoryboardTaskStatus
          active
          sweep
          surface="content"
          title={importStatusTitle(importState.via, importState.role)}
          detail={importStatusDetail(importState.via)}
        />
      ) : null}

      {recognizeBusy ? (
        <StoryboardTaskStatus
          active
          sweep
          surface="content"
          title="AI 识别产品中"
          detail={
            copy.recognizeStatusDetail ??
            "视觉模型正在分析产品图，结果将写入上方产品描述…"
          }
        />
      ) : null}
      {scriptBusy ? (
        <StoryboardTaskStatus
          active
          sweep
          surface="content"
          title="脚本生成中"
          detail={copy.scriptGeneratingDetail ?? "正在生成复刻脚本…"}
        />
      ) : null}

      {supportsAssets ? (
        <EcomAssetPickerDialog
          open={assetPickerRole !== null}
          onOpenChange={(open) => {
            if (!open) setAssetPickerRole(null);
          }}
          maxSelect={
            assetPickerRole
              ? Math.max(1, api.maxPerRole - refsForRole(assetPickerRole).length)
              : 1
          }
          onConfirm={async (assets) => {
            const role = assetPickerRole;
            if (!role || assets.length === 0) return;
            await handleAttachFromAssets(
              role,
              assets.map((a) => a.id),
            );
          }}
        />
      ) : null}

      {supportsModelLibrary ? (
        <EcomModelLibraryPickerDialog
          open={modelLibraryOpen}
          onOpenChange={setModelLibraryOpen}
          onPick={async (entry) => {
            await handleAttachModelFromLibrary({
              id: entry.id,
              name: entry.name,
              ossUrl: entry.ossUrl,
            });
          }}
        />
      ) : null}

      {supportsModelAi ? (
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
          onChange={onImageModelChange ?? (() => {})}
          imageSize={imageSize}
          onImageSizeChange={setImageSize}
          lockedImageSizeLabel="3:4（竖版模特参考）"
          onConfirm={(modelKey) => void handleModelImageGenerate(modelKey)}
          confirming={modelGenBusy}
        />
      ) : null}
    </div>
  );
}
