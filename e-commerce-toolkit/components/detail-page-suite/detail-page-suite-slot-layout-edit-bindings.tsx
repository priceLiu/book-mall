"use client";

import type { EcomCopyLayoutReferenceImage } from "@/components/copy-layout/ecom-copy-layout-studio-dialog";
import {
  DetailPageSuiteSlotPromptEditDialog,
  type DetailPageSuiteSlotPromptSaveExtras,
} from "@/components/detail-page-suite/detail-page-suite-slot-prompt-edit-dialog";
import type { DetailPageSuiteProjectModuleKey } from "@/lib/ecom-detail-page-suite-compose-api";
import { composeDetailPageSuiteSlot } from "@/lib/ecom-detail-page-suite-compose-api";
import { composeEcomCopyOverlay } from "@/lib/ecom-copy-overlay-compose-api";
import type { EcomDetailPageRatio } from "@/lib/detail-page-suite-platform-ratio";
import { resolveDetailPageDisplayRatio } from "@/lib/detail-page-suite-platform-ratio";
import {
  patchSuiteModulesSlotPrompt,
  resolveSuiteSlotExportWidthPx,
  type DetailPageSuiteSlotPromptEditState,
} from "@/lib/detail-page-suite-slot-layout-edit";
import { buildDetailPageSuiteCopyLayoutReferenceImages } from "@/lib/ecom-copy-layout-reference-images";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

type Props = {
  projectModule: DetailPageSuiteProjectModuleKey;
  project: DetailPageSuiteProject;
  promptEdit: DetailPageSuiteSlotPromptEditState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectChange: (project: DetailPageSuiteProject) => void;
  updateProject: (
    projectId: string,
    patch: { suite: DetailPageSuiteProject["suite"] },
  ) => Promise<DetailPageSuiteProject>;
  referenceImages?: EcomCopyLayoutReferenceImage[];
  shootingRequirement?: string;
  saving?: boolean;
  composing?: boolean;
  rewriteBusy?: boolean;
  onRewrite?: () => void;
  onRegenerateImage?: (prompt: string) => void | Promise<void>;
  promptRefUploadBusy?: boolean;
  onUploadPromptRef?: (file: File) => void;
  displayRatio?: EcomDetailPageRatio;
  onAfterSave?: () => void;
  toast: (opts: { title: string; variant?: "success" }) => void;
  alert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

/** 详情页套图系 · 全屏排版编辑（与爆款共用 EcomCopyLayoutStudioDialog 壳） */
export function DetailPageSuiteSlotLayoutEditBindings({
  projectModule,
  project,
  promptEdit,
  open,
  onOpenChange,
  onProjectChange,
  updateProject,
  referenceImages = [],
  shootingRequirement,
  saving = false,
  composing = false,
  rewriteBusy = false,
  onRewrite,
  onRegenerateImage,
  promptRefUploadBusy,
  onUploadPromptRef,
  displayRatio: displayRatioProp,
  onAfterSave,
  toast,
  alert,
}: Props) {
  const displayRatio =
    displayRatioProp ??
    resolveDetailPageDisplayRatio(project.brief?.platformCode, project.settings.imageRatio);
  const exportWidthPx = resolveSuiteSlotExportWidthPx(project);
  const layoutReferenceImages =
    referenceImages.length > 0
      ? referenceImages
      : buildDetailPageSuiteCopyLayoutReferenceImages(project.references);

  const persistModules = async (
    prompt: string,
    extras?: DetailPageSuiteSlotPromptSaveExtras,
    close = true,
  ) => {
    const modules = patchSuiteModulesSlotPrompt(project.suite.modules, promptEdit, prompt, extras);
    const updated = await updateProject(project.id, { suite: { ...project.suite, modules } });
    onProjectChange(updated);
    if (close) onOpenChange(false);
    onAfterSave?.();
    return updated;
  };

  return (
    <DetailPageSuiteSlotPromptEditDialog
      open={open}
      onOpenChange={onOpenChange}
      title={promptEdit.label}
      shootingRequirement={shootingRequirement}
      prompt={promptEdit.prompt}
      slotCopy={promptEdit.slotCopy ?? ""}
      slotCopyAi={promptEdit.slotCopyAi ?? ""}
      showSlotCopyField
      baseImageUrl={promptEdit.baseImageUrl ?? null}
      copyOverlay={promptEdit.copyOverlay ?? null}
      layoutComposedPreviewUrl={promptEdit.layoutComposedPreviewUrl ?? null}
      exportWidthPx={exportWidthPx}
      displayRatio={displayRatio}
      saving={saving}
      composing={composing}
      rewriteBusy={rewriteBusy}
      referenceImages={layoutReferenceImages}
      promptRefUrls={promptEdit.promptRefUrls ?? []}
      promptRefUploadBusy={promptRefUploadBusy}
      onUploadPromptRef={onUploadPromptRef}
      onRewrite={onRewrite}
      onRegenerateImage={onRegenerateImage}
      onSave={async (prompt, extras) => {
        await persistModules(prompt, extras, false);
        toast({ variant: "success", title: "已保存草稿" });
      }}
      onPreview={async (_prompt, extras) => {
        const baseUrl = promptEdit.baseImageUrl?.trim();
        if (!baseUrl || !extras.copyOverlay) {
          throw new Error("请先出无字底图并填写模块文案");
        }
        const { url } = await composeEcomCopyOverlay({
          baseImageUrl: baseUrl,
          overlay: extras.copyOverlay,
          exportWidthPx,
          syncText: extras.slotCopy,
        });
        return { previewUrl: url };
      }}
      onConfirmCompose={async (prompt, extras) => {
        const baseUrl = promptEdit.baseImageUrl?.trim();
        if (!baseUrl || !extras.copyOverlay) {
          throw new Error("请先出无字底图并填写模块文案");
        }
        await persistModules(prompt, extras, false);
        const result = await composeDetailPageSuiteSlot(projectModule, project.id, {
          moduleId: promptEdit.moduleId,
          slotKey: promptEdit.slotKey,
          baseImageUrl: baseUrl,
          overlay: extras.copyOverlay,
          slotCopy: extras.slotCopy,
        });
        onProjectChange(result.project);
        onOpenChange(false);
        toast({ variant: "success", title: "已合成并保存" });
      }}
    />
  );
}