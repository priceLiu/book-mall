"use client";

import { useMemo, useRef } from "react";
import { Sparkles, UserRound } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomRefUploadCard, type EcomRefUploadItem } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  buildRefPreviewItems,
  ECOM_REF_CARD_ACTION_BTN,
  useEcomRefUploadProgress,
} from "@/lib/ecom-ref-upload-ui";
import {
  clearSimpleFusionRefSlot,
  getSimpleFusionProject,
  removeSimpleFusionGarment,
  uploadSimpleFusionMedia,
  type SimpleFusionProject,
} from "@/lib/ecom-simple-fusion-video-api";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";

type Props = {
  project: SimpleFusionProject;
  garmentMulti: boolean;
  refCardsBusy: boolean;
  modelGenBusy: boolean;
  sceneTextOnly: boolean;
  onProject: (p: SimpleFusionProject) => void;
  onOpenModelLibrary: () => void;
  onOpenSceneCatalog: () => void;
  onOpenAssetPicker: (slot: "model" | "scene" | "garment") => void;
  onOpenAiDialog: (role: "model" | "scene") => void;
};

/** 参考素材三卡（布局与 model-shot-ref-uploader 一致） */
export function SimpleFusionRefUploadSection({
  project,
  garmentMulti,
  refCardsBusy,
  modelGenBusy,
  sceneTextOnly,
  onProject,
  onOpenModelLibrary,
  onOpenSceneCatalog,
  onOpenAssetPicker,
  onOpenAiDialog,
}: Props) {
  const { alert } = useDialogs();
  const { uploadingSlot, uploadProgress, runWithUploadProgress } = useEcomRefUploadProgress();

  const garmentInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);

  const garmentItems: EcomRefUploadItem[] = (project.references.garments ?? []).map((g) => ({
    id: g.id,
    ossUrl: g.ossUrl,
    label: g.label?.trim() || "服装",
  }));

  const modelItems: EcomRefUploadItem[] = project.references.model?.ossUrl
    ? [
        {
          id: "model",
          ossUrl: project.references.model.ossUrl,
          label: project.references.model.label?.trim() || "模特",
        },
      ]
    : [];

  const sceneItems: EcomRefUploadItem[] = project.references.scene?.ossUrl
    ? [
        {
          id: "scene",
          ossUrl: project.references.scene.ossUrl,
          label: project.references.scene.libraryEntryName?.trim() || "场景参考",
        },
      ]
    : [];

  const previewItems = useMemo(
    () =>
      buildRefPreviewItems([
        ...garmentItems.map((i) => ({ ossUrl: i.ossUrl, label: i.label })),
        ...modelItems.map((i) => ({ ossUrl: i.ossUrl, label: i.label })),
        ...sceneItems.map((i) => ({ ossUrl: i.ossUrl, label: i.label })),
      ]),
    [garmentItems, modelItems, sceneItems],
  );

  const { preview, openPreview, closePreview } = useEcomImagePreview(previewItems);

  function uploadSlotProgress(slot: "garment" | "model" | "scene") {
    return {
      showUploadProgress: uploadingSlot === slot,
      uploadProgress: uploadingSlot === slot ? uploadProgress : null,
    };
  }

  async function uploadGarmentFiles(files: File[]) {
    try {
      await runWithUploadProgress("garment", async () => {
        for (const f of files) {
          await uploadSimpleFusionMedia(project.id, "garment", f);
        }
        onProject(await getSimpleFusionProject(project.id));
      });
    } catch (e) {
      await alert({
        title: "上传失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function uploadSingle(slot: "model" | "scene", file: File) {
    try {
      await runWithUploadProgress(slot, async () => {
        const p = await uploadSimpleFusionMedia(project.id, slot, file);
        onProject(p);
      });
    } catch (e) {
      await alert({
        title: "上传失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function removeGarment(id: string) {
    try {
      onProject(await removeSimpleFusionGarment(project.id, id));
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function removeModel() {
    try {
      onProject(await clearSimpleFusionRefSlot(project.id, "model", project.references));
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function removeSceneImage() {
    if (!project.references.scene?.ossUrl) return;
    try {
      const p = await clearSimpleFusionRefSlot(
        project.id,
        "scene",
        project.references,
      );
      onProject(p);
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  const cardBusy = refCardsBusy || uploadingSlot != null;

  return (
    <>
      <EcomImagePreviewHost preview={preview} onClose={closePreview} />

      <section className="mb-4 space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">参考素材</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">
            服装 · 模特 · 场景（服装 {garmentMulti ? "2～6 套" : "1 套"}）。与服装模特图相同：悬停看大图、可删除、上传有进度。
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
              素材图
            </span>
            <span className="text-[10px] text-[#86868b]">{IMAGE_UPLOAD_DROP_HINT}</span>
          </div>

          <EcomRefUploadCard
            title="服装图"
            items={garmentItems}
            emptyHint={`上传服装平铺/实拍（${garmentMulti ? "2～6 套" : "1 套"}）。${IMAGE_UPLOAD_DROP_HINT}`}
            accept="image/*"
            multiple={garmentMulti}
            busy={cardBusy}
            removeLabel="删除服装图"
            inputRef={garmentInputRef}
            onOpenAssetPicker={() => onOpenAssetPicker("garment")}
            onOpenFilePicker={() => garmentInputRef.current?.click()}
            onUploadFiles={(files) => void uploadGarmentFiles(files)}
            onPreviewItem={(item) => openPreview(item.ossUrl, item.label)}
            onRemove={(id) => void removeGarment(id)}
            {...uploadSlotProgress("garment")}
          />

          <EcomRefUploadCard
            title="模特图"
            items={modelItems}
            emptyHint="拖放 / 粘贴 / 模特库 / 我的资产，或 AI 生成模特参考图。"
            accept="image/*"
            multiple={false}
            busy={cardBusy}
            generating={modelGenBusy}
            generatingLabel="AI 生成中…"
            removeLabel="删除模特图"
            inputRef={modelInputRef}
            onOpenAssetPicker={() => onOpenAssetPicker("model")}
            onOpenFilePicker={() => modelInputRef.current?.click()}
            onUploadFiles={(files) => {
              const f = files[0];
              if (f) void uploadSingle("model", f);
            }}
            onPreviewItem={(item) => openPreview(item.ossUrl, item.label)}
            onRemove={() => void removeModel()}
            headerActions={
              <>
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={cardBusy}
                  className={ECOM_REF_CARD_ACTION_BTN}
                  onClick={onOpenModelLibrary}
                >
                  <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                  模特库
                </EcomButtonSecondary>
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={cardBusy}
                  className={ECOM_REF_CARD_ACTION_BTN}
                  onClick={() => onOpenAiDialog("model")}
                >
                  <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
                  AI生成
                </EcomButtonSecondary>
              </>
            }
            {...uploadSlotProgress("model")}
          />

          <div>
            <EcomRefUploadCard
              title="场景图"
              items={sceneItems}
              emptyHint={
                sceneTextOnly
                  ? ""
                  : "可选。上传 / 场景库 / 我的资产，或 AI 填写场景描述（可无参考图）。"
              }
              accept="image/*"
              multiple={false}
              busy={cardBusy}
              removeLabel="删除场景图"
              inputRef={sceneInputRef}
              onOpenAssetPicker={() => onOpenAssetPicker("scene")}
              onOpenFilePicker={() => sceneInputRef.current?.click()}
              onUploadFiles={(files) => {
                const f = files[0];
                if (f) void uploadSingle("scene", f);
              }}
              onPreviewItem={(item) => openPreview(item.ossUrl, item.label)}
              onRemove={() => void removeSceneImage()}
              headerActions={
                <>
                  <EcomButtonSecondary
                    size="sm"
                    type="button"
                    disabled={cardBusy}
                    className={ECOM_REF_CARD_ACTION_BTN}
                    onClick={onOpenSceneCatalog}
                  >
                    场景库
                  </EcomButtonSecondary>
                  <EcomButtonSecondary
                    size="sm"
                    type="button"
                    disabled={cardBusy}
                    className={ECOM_REF_CARD_ACTION_BTN}
                    onClick={() => onOpenAiDialog("scene")}
                  >
                    <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
                    AI生成
                  </EcomButtonSecondary>
                </>
              }
              {...uploadSlotProgress("scene")}
            />
            {sceneTextOnly ? (
              <p className="mt-1 line-clamp-3 rounded-md bg-[#f5f5f7] px-2 py-1.5 text-[10px] leading-relaxed text-[#424245]">
                Prompt：{project.references.scene?.scenePrompt?.trim()}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
