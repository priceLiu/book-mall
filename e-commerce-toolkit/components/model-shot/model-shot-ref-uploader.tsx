"use client";

import { Sparkles, UserRound } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { ModelShotRefGenerateDialog } from "@/components/model-shot/model-shot-ref-generate-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { ModelShotReference, ModelShotReferenceRole } from "@/lib/model-shot-types";
import { modelRefLabel } from "@/lib/model-shot-workflow";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

export type ModelShotUploadRole = ModelShotReferenceRole;

type Props = {
  references: ModelShotReference[];
  onUpload: (
    file: File,
    opts: { label: string; role: ModelShotReferenceRole },
  ) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  onAttachAssets?: (assetIds: string[], role: ModelShotReferenceRole) => Promise<void>;
  onAttachModelFromLibrary?: (entry: {
    id: string;
    name: string;
    ossUrl: string;
  }) => Promise<void>;
  onGenerateRef?: (
    role: Exclude<ModelShotReferenceRole, "garment">,
    opts: { prompt: string; modelKey: string },
  ) => Promise<void>;
  onSkipScene?: () => Promise<void>;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  modelsLoading?: boolean;
  modelsLoadError?: string | null;
  onRetryLoadModels?: () => void | Promise<void>;
  /** 姿势批量生图模型弹层打开时禁用粘贴热区，避免与 Radix 焦点管理冲突 */
  imageGenPickerOpen?: boolean;
  genBusyRole?: ModelShotReferenceRole | null;
  busy?: boolean;
  uploadingRole?: ModelShotReferenceRole | null;
  uploadProgress?: number | null;
  activeRole?: ModelShotUploadRole;
  onActiveRoleChange?: (role: ModelShotUploadRole) => void;
};

const ROLE_SECTIONS: Array<{
  role: ModelShotUploadRole;
  title: string;
  refRole: ModelShotReferenceRole;
  emptyHint: string;
  required?: boolean;
  aiGenerate?: boolean;
}> = [
  {
    role: "garment",
    title: "服装图",
    refRole: "garment",
    required: true,
    emptyHint: "上传或粘贴服装实拍/款式图（必填），助手将据此采集模特与姿势方案。",
  },
  {
    role: "model",
    title: "模特图",
    refRole: "model",
    aiGenerate: true,
    emptyHint: "拖放 / 粘贴 / 模特库 / 我的资产，或 AI 生成模特参考图。",
  },
  {
    role: "scene",
    title: "场景图",
    refRole: "scene",
    aiGenerate: true,
    emptyHint: "可选。拖放 / 粘贴 / 我的资产，或 AI 生成场景参考图；也可跳过，由模型自由发挥背景。",
  },
  {
    role: "prop",
    title: "道具图",
    refRole: "prop",
    aiGenerate: true,
    emptyHint: "可选。拖放 / 粘贴 / 我的资产，或 AI 生成道具参考图。",
  },
];

function ModelShotRefOverlays({
  pickerRole,
  setPickerRole,
  onAttachAssets,
  modelPickerOpen,
  setModelPickerOpen,
  onAttachModelFromLibrary,
  genRole,
  closeGenFlow,
  genModelKey,
  genModelDisplayName,
  imageModels,
  modelsLoading,
  modelsLoadError,
  onRetryLoadModels,
  genBusyRole,
  onGenerateRef,
}: {
  pickerRole: ModelShotReferenceRole | null;
  setPickerRole: (role: ModelShotReferenceRole | null) => void;
  onAttachAssets?: (assetIds: string[], role: ModelShotReferenceRole) => Promise<void>;
  modelPickerOpen: boolean;
  setModelPickerOpen: (open: boolean) => void;
  onAttachModelFromLibrary?: (entry: {
    id: string;
    name: string;
    ossUrl: string;
  }) => Promise<void>;
  genRole: Exclude<ModelShotReferenceRole, "garment"> | null;
  closeGenFlow: () => void;
  genModelKey: string;
  genModelDisplayName: string;
  imageModels: StoryboardGatewayModel[];
  modelsLoading: boolean;
  modelsLoadError?: string | null;
  onRetryLoadModels?: () => void | Promise<void>;
  genBusyRole: ModelShotReferenceRole | null;
  onGenerateRef?: (
    role: Exclude<ModelShotReferenceRole, "garment">,
    opts: { prompt: string; modelKey: string },
  ) => Promise<void>;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {onAttachAssets ? (
        <EcomAssetPickerDialog
          open={pickerRole !== null}
          onOpenChange={(open) => {
            if (!open) setPickerRole(null);
          }}
          maxSelect={1}
          onConfirm={async (assets) => {
            const role = pickerRole ?? "garment";
            setPickerRole(null);
            if (assets.length) {
              await onAttachAssets(
                assets.map((a) => a.id),
                role,
              );
            }
          }}
        />
      ) : null}

      {onAttachModelFromLibrary ? (
        <EcomModelLibraryPickerDialog
          open={modelPickerOpen}
          onOpenChange={setModelPickerOpen}
          onPick={async (entry) => {
            await onAttachModelFromLibrary(entry);
            setModelPickerOpen(false);
          }}
        />
      ) : null}

      {genRole && onGenerateRef ? (
        <ModelShotRefGenerateDialog
          open
          onClose={closeGenFlow}
          role={genRole}
          modelKey={genModelKey}
          modelDisplayName={genModelDisplayName}
          imageModels={imageModels}
          modelsLoading={modelsLoading}
          modelsEmptyHint={modelsLoadError ?? undefined}
          onRetryLoadModels={onRetryLoadModels}
          onConfirm={async (opts) => {
            const role = genRole;
            closeGenFlow();
            if (role) await onGenerateRef(role, opts);
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}

export function ModelShotRefUploader({
  references,
  onUpload,
  onRemove,
  onAttachAssets,
  onAttachModelFromLibrary,
  onGenerateRef,
  onSkipScene,
  imageModels,
  imageModelKey,
  modelsLoading = false,
  modelsLoadError,
  onRetryLoadModels,
  imageGenPickerOpen = false,
  genBusyRole = null,
  busy,
  uploadingRole = null,
  uploadProgress = null,
  activeRole = "garment",
  onActiveRoleChange,
}: Props) {
  const inputRefs = useRef<Record<ModelShotUploadRole, HTMLInputElement | null>>({
    garment: null,
    model: null,
    scene: null,
    prop: null,
  });
  const [pickerRole, setPickerRole] = useState<ModelShotReferenceRole | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [genRole, setGenRole] = useState<Exclude<ModelShotReferenceRole, "garment"> | null>(
    null,
  );
  const [genModelKey, setGenModelKey] = useState(imageModelKey);

  const genModelDisplayName = useMemo(
    () => imageModels.find((m) => m.modelKey === genModelKey)?.displayName ?? genModelKey,
    [genModelKey, imageModels],
  );

  function openGenDialog(role: Exclude<ModelShotReferenceRole, "garment">) {
    setGenModelKey(imageModelKey);
    setGenRole(role);
  }

  function closeGenFlow() {
    setGenRole(null);
  }

  const uploadFile = useCallback(
    async (file: File, role: ModelShotReferenceRole) => {
      if (busy || genBusyRole) return;
      const section = ROLE_SECTIONS.find((s) => s.refRole === role);
      const label =
        file.name.replace(/\.[^.]+$/, "").slice(0, 20) || section?.title || "参考图";
      await onUpload(file, { label, role });
    },
    [busy, genBusyRole, onUpload],
  );

  async function handleFiles(files: File[], role: ModelShotReferenceRole) {
    if (!files.length || busy || genBusyRole) return;
    for (const file of files) {
      await uploadFile(file, role);
    }
    const section = ROLE_SECTIONS.find((s) => s.refRole === role);
    if (section && inputRefs.current[section.role]) {
      inputRefs.current[section.role]!.value = "";
    }
  }

  const activeRefRole =
    ROLE_SECTIONS.find((s) => s.role === activeRole)?.refRole ?? "garment";
  const activeRefRoleRef = useRef(activeRefRole);
  activeRefRoleRef.current = activeRefRole;

  const {
    pasteReady: sectionPasteReady,
    dropZoneProps: sectionPasteProps,
    focusZone: focusSectionPaste,
  } = useImageDropPaste({
    enabled: !busy && !genBusyRole && !genRole && !modelPickerOpen && !imageGenPickerOpen,
    multiple: false,
    listenPaste: true,
    onFiles: (files) => void handleFiles(files, activeRefRoleRef.current),
  });

  function refFor(role: ModelShotReferenceRole) {
    return references.find((r) => r.role === role);
  }

  const disabled = Boolean(busy || genBusyRole);
  const pasteSuspended = imageGenPickerOpen;

  return (
    <>
      <div
        ref={pasteSuspended ? undefined : sectionPasteProps.ref}
        tabIndex={pasteSuspended ? undefined : -1}
        className={cn(
          "space-y-2 rounded-lg outline-none focus:outline-none focus-visible:ring-0",
          pasteSuspended && "pointer-events-none opacity-60",
        )}
        {...(pasteSuspended
          ? {}
          : {
              onFocus: sectionPasteProps.onFocus,
              onBlur: sectionPasteProps.onBlur,
              onDragOver: sectionPasteProps.onDragOver,
              onDragLeave: sectionPasteProps.onDragLeave,
              onDrop: sectionPasteProps.onDrop,
            })}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            素材图
          </span>
          <span className="text-[10px] text-[#86868b]">
            {IMAGE_UPLOAD_DROP_HINT}
            {sectionPasteReady ? " · 粘贴至当前选中项" : ""}
          </span>
        </div>

        {ROLE_SECTIONS.map(({ role, title, refRole, emptyHint, required, aiGenerate }) => {
          const ref = refFor(refRole);
          const isGenerating = genBusyRole === refRole;
          const skipped = ref?.source === "none";
          const aiDesc =
            ref?.source === "ai-generate" && ref.description ? ref.description : null;
          return (
            <div key={role}>
              <EcomRefUploadCard
                title={required ? `${title} *` : title}
                suggested={activeRole === role}
                listenPaste={false}
                multiple={false}
                items={
                  ref?.ossUrl
                    ? [
                        {
                          id: ref.id,
                          ossUrl: ref.ossUrl,
                          label: modelRefLabel(ref),
                        },
                      ]
                    : []
                }
                emptyHint={
                  skipped
                    ? refRole === "prop"
                      ? "不需要道具，出图时不带入道具参考。"
                      : "已跳过场景，出图时由模型自由发挥背景。"
                    : aiDesc
                      ? undefined
                      : emptyHint
                }
                busy={disabled || pasteSuspended}
                generating={isGenerating}
                generatingLabel="AI 生成中…"
                uploadProgress={uploadingRole === refRole ? uploadProgress : null}
                onUploadFiles={(files) => void handleFiles(files, refRole)}
                onOpenFilePicker={() => {
                  onActiveRoleChange?.(role);
                  inputRefs.current[role]?.click();
                }}
                onOpenAssetPicker={
                  onAttachAssets
                    ? () => {
                        onActiveRoleChange?.(role);
                        setPickerRole(refRole);
                      }
                    : undefined
                }
                onRemove={onRemove}
                removeLabel={`删除${title}`}
                onTitleClick={() => onActiveRoleChange?.(role)}
                onMouseEnterCard={
                  pasteSuspended
                    ? undefined
                    : () => {
                        onActiveRoleChange?.(role);
                        focusSectionPaste();
                      }
                }
                inputRef={(el) => {
                  inputRefs.current[role] = el;
                }}
                toolbarPrefix={
                  <>
                    {refRole === "model" && onAttachModelFromLibrary ? (
                      <EcomButtonSecondary
                        size="sm"
                        type="button"
                        disabled={disabled}
                        className="h-7 px-2 text-[10px]"
                        onClick={() => {
                          onActiveRoleChange?.(role);
                          setModelPickerOpen(true);
                        }}
                      >
                        <UserRound className="h-3 w-3 shrink-0" />
                        模特库
                      </EcomButtonSecondary>
                    ) : null}
                    {refRole === "scene" && onSkipScene && !ref?.ossUrl && !skipped ? (
                      <EcomButtonSecondary
                        size="sm"
                        type="button"
                        disabled={disabled}
                        className="h-7 px-2 text-[10px]"
                        onClick={() => {
                          onActiveRoleChange?.(role);
                          void onSkipScene();
                        }}
                      >
                        跳过
                      </EcomButtonSecondary>
                    ) : null}
                    {aiGenerate && onGenerateRef ? (
                      <EcomButtonSecondary
                        size="sm"
                        type="button"
                        disabled={disabled}
                        className="h-7 px-2 text-[10px]"
                        onClick={() => {
                          onActiveRoleChange?.(role);
                          openGenDialog(refRole as Exclude<ModelShotReferenceRole, "garment">);
                        }}
                      >
                        <Sparkles className="h-3 w-3 shrink-0" />
                        AI生成
                      </EcomButtonSecondary>
                    ) : null}
                  </>
                }
              />
              {aiDesc ? (
                <p className="mt-1 line-clamp-2 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[10px] leading-relaxed text-[#424245]">
                  Prompt：{aiDesc}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <ModelShotRefOverlays
        pickerRole={pickerRole}
        setPickerRole={setPickerRole}
        onAttachAssets={onAttachAssets}
        modelPickerOpen={modelPickerOpen}
        setModelPickerOpen={setModelPickerOpen}
        onAttachModelFromLibrary={onAttachModelFromLibrary}
        genRole={genRole}
        closeGenFlow={closeGenFlow}
        genModelKey={genModelKey}
        genModelDisplayName={genModelDisplayName}
        imageModels={imageModels}
        modelsLoading={modelsLoading}
        modelsLoadError={modelsLoadError}
        onRetryLoadModels={onRetryLoadModels}
        genBusyRole={genBusyRole}
        onGenerateRef={onGenerateRef}
      />
    </>
  );
}

/** @deprecated 使用 ModelShotRefUploader */
export const ModelShotRefSection = ModelShotRefUploader;
