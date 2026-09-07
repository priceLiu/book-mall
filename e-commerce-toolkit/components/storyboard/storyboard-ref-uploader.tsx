"use client";

import { Sparkles, UserRound } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import {
  StoryboardRefGenerateDialog,
  type StoryboardRefGenRole,
} from "@/components/storyboard/storyboard-ref-generate-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { StoryboardGatewayModel, StoryboardReference } from "@/lib/storyboard-types";
import type { StoryboardUploadRole } from "@/lib/storyboard-workflow";
import { cn } from "@/lib/utils";

type Props = {
  references: StoryboardReference[];
  onUpload: (
    file: File,
    opts: { label: string; role: StoryboardReference["role"] },
  ) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  onAttachAssets?: (
    assetIds: string[],
    role: StoryboardReference["role"],
  ) => Promise<void>;
  onAttachModelFromLibrary?: (entry: {
    id: string;
    name: string;
    ossUrl: string;
  }) => Promise<void>;
  onGenerateRef?: (
    role: StoryboardRefGenRole,
    opts: { prompt: string; modelKey: string },
  ) => Promise<void>;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  modelsLoading?: boolean;
  modelsLoadError?: string | null;
  onRetryLoadModels?: () => void | Promise<void>;
  imageGenPickerOpen?: boolean;
  genBusyRole?: StoryboardReference["role"] | null;
  busy?: boolean;
  uploadingRole?: StoryboardReference["role"] | null;
  uploadProgress?: number | null;
  activeRole?: StoryboardUploadRole;
  onActiveRoleChange?: (role: StoryboardUploadRole) => void;
  characterTitle?: string;
};

const ROLE_SECTIONS: Array<{
  role: StoryboardUploadRole;
  title: string;
  refRole: StoryboardReference["role"];
  emptyHint: string;
  aiGenerate?: boolean;
}> = [
  {
    role: "product",
    title: "产品图",
    refRole: "product",
    emptyHint: "上传或粘贴产品图后，助手将自动检测并进入七维参数采集。",
  },
  {
    role: "character",
    title: "模特图",
    refRole: "character",
    aiGenerate: true,
    emptyHint: "拖放 / 粘贴 / 模特库 / 我的资产，或 AI 生成模特参考图。",
  },
  {
    role: "scene",
    title: "场景图",
    refRole: "scene",
    aiGenerate: true,
    emptyHint: "可选。拖放 / 粘贴 / 我的资产，或 AI 生成场景参考图。",
  },
];

function StoryboardRefOverlays({
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
  pickerRole: StoryboardReference["role"] | null;
  setPickerRole: (role: StoryboardReference["role"] | null) => void;
  onAttachAssets?: (assetIds: string[], role: StoryboardReference["role"]) => Promise<void>;
  modelPickerOpen: boolean;
  setModelPickerOpen: (open: boolean) => void;
  onAttachModelFromLibrary?: (entry: {
    id: string;
    name: string;
    ossUrl: string;
  }) => Promise<void>;
  genRole: StoryboardRefGenRole | null;
  closeGenFlow: () => void;
  genModelKey: string;
  genModelDisplayName: string;
  imageModels: StoryboardGatewayModel[];
  modelsLoading: boolean;
  modelsLoadError?: string | null;
  onRetryLoadModels?: () => void | Promise<void>;
  genBusyRole: StoryboardReference["role"] | null;
  onGenerateRef?: (
    role: StoryboardRefGenRole,
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
            const role = pickerRole ?? "product";
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
        <StoryboardRefGenerateDialog
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

export function StoryboardRefUploader({
  references,
  onUpload,
  onRemove,
  onAttachAssets,
  onAttachModelFromLibrary,
  onGenerateRef,
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
  activeRole = "product",
  onActiveRoleChange,
  characterTitle = "模特图",
}: Props) {
  const inputRefs = useRef<Record<StoryboardUploadRole, HTMLInputElement | null>>({
    product: null,
    character: null,
    scene: null,
  });
  const [pickerRole, setPickerRole] = useState<StoryboardReference["role"] | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [genRole, setGenRole] = useState<StoryboardRefGenRole | null>(null);
  const [genModelKey, setGenModelKey] = useState(imageModelKey);

  const genModelDisplayName = useMemo(
    () => imageModels.find((m) => m.modelKey === genModelKey)?.displayName ?? genModelKey,
    [genModelKey, imageModels],
  );

  const sections = useMemo(
    () =>
      ROLE_SECTIONS.map((section) =>
        section.role === "character" ? { ...section, title: characterTitle } : section,
      ),
    [characterTitle],
  );

  function openGenDialog(role: StoryboardRefGenRole) {
    setGenModelKey(imageModelKey);
    setGenRole(role);
  }

  function closeGenFlow() {
    setGenRole(null);
  }

  const uploadFile = useCallback(
    async (file: File, role: StoryboardReference["role"]) => {
      if (busy || genBusyRole) return;
      const section = sections.find((s) => s.refRole === role);
      const label =
        file.name.replace(/\.[^.]+$/, "").slice(0, 20) || section?.title || "参考图";
      await onUpload(file, { label, role });
    },
    [busy, genBusyRole, onUpload, sections],
  );

  async function handleFiles(files: File[], role: StoryboardReference["role"]) {
    if (!files.length || busy || genBusyRole) return;
    for (const file of files) {
      await uploadFile(file, role);
    }
    const section = sections.find((s) => s.refRole === role);
    if (section && inputRefs.current[section.role]) {
      inputRefs.current[section.role]!.value = "";
    }
  }

  const activeRefRole = sections.find((s) => s.role === activeRole)?.refRole ?? "product";
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

  function refsFor(role: StoryboardReference["role"]) {
    return references.filter((r) => r.role === role);
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

        {sections.map(({ role, title, refRole, emptyHint, aiGenerate }) => {
          const items = refsFor(refRole);
          const isGenerating = genBusyRole === refRole;
          return (
            <EcomRefUploadCard
              key={role}
              title={title}
              suggested={activeRole === role}
              listenPaste={false}
              multiple={false}
              items={items.map((r) => ({ id: r.id, ossUrl: r.ossUrl, label: r.label }))}
              emptyHint={emptyHint}
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
                  {refRole === "character" && onAttachModelFromLibrary ? (
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
                  {aiGenerate && onGenerateRef ? (
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={disabled}
                      className="h-7 px-2 text-[10px]"
                      onClick={() => {
                        onActiveRoleChange?.(role);
                        openGenDialog(refRole as StoryboardRefGenRole);
                      }}
                    >
                      <Sparkles className="h-3 w-3 shrink-0" />
                      AI生成
                    </EcomButtonSecondary>
                  ) : null}
                </>
              }
            />
          );
        })}
      </div>

      <StoryboardRefOverlays
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
