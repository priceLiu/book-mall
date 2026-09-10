"use client";

import { BookOpen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  EcomCatalogPickerDialog,
  type CatalogPickerEntry,
} from "@/components/model-shot/ecom-catalog-picker-dialog";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { fetchEcomSceneLibraryCatalog } from "@/lib/ecom-scene-library-api";
import type { EcomSceneLibraryEntry } from "@/lib/ecom-scene-library/types";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type {
  OutfitModelGalleryItem,
  OutfitSceneLibraryPreset,
  WorkflowRefImage,
} from "@/lib/video-workflow/shot-spine";

export const OUTFIT_MODEL_GALLERY_MAX = 9;

type Props = {
  gallery: OutfitModelGalleryItem[];
  sceneRef?: WorkflowRefImage | null;
  sceneLibraryPreset?: OutfitSceneLibraryPreset | null;
  refsLocked?: boolean;
  busy?: boolean;
  onUploadModelFiles: (files: File[]) => Promise<void>;
  onAttachModelAssets: (assets: Array<{ id: string; ossUrl: string; title: string }>) => Promise<void>;
  onRemoveModelItem: (refId: string) => Promise<void>;
  onUploadSceneRef: (file: File) => Promise<void>;
  onAttachSceneAsset: (assets: Array<{ id: string; ossUrl: string; title: string }>) => Promise<void>;
  onPickSceneLibraryPreset: (preset: OutfitSceneLibraryPreset) => Promise<void>;
  onRemoveSceneRef: () => Promise<void>;
};

function sceneToPickerEntry(entry: EcomSceneLibraryEntry): CatalogPickerEntry {
  return {
    id: entry.id,
    name: entry.name,
    subtitle: entry.visualPrompt,
    scope: entry.scope,
    lockedAt: entry.lockedAt,
  };
}

export function OutfitModelRefsPanel({
  gallery,
  sceneRef,
  sceneLibraryPreset,
  refsLocked,
  busy,
  onUploadModelFiles,
  onAttachModelAssets,
  onRemoveModelItem,
  onUploadSceneRef,
  onAttachSceneAsset,
  onPickSceneLibraryPreset,
  onRemoveSceneRef,
}: Props) {
  const modelInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const [modelAssetPickerOpen, setModelAssetPickerOpen] = useState(false);
  const [sceneAssetPickerOpen, setSceneAssetPickerOpen] = useState(false);
  const [sceneCatalogOpen, setSceneCatalogOpen] = useState(false);
  const [sceneCatalog, setSceneCatalog] = useState<EcomSceneLibraryEntry[]>([]);
  const [sceneCatalogLoading, setSceneCatalogLoading] = useState(false);

  const refsDisabled = Boolean(busy) || Boolean(refsLocked);
  const modelAtLimit = gallery.length >= OUTFIT_MODEL_GALLERY_MAX;
  const modelUploadDisabled = refsDisabled || modelAtLimit;
  const sceneUploadDisabled = refsDisabled;

  const previewItems = useMemo(
    () =>
      gallery.map((item, index) => ({
        src: item.ossUrl,
        title: item.label ?? `穿搭参考 ${index + 1}`,
        thumbSrc: item.ossUrl,
      })),
    [gallery],
  );

  const { preview, galleryItems, openPreview, closePreview } = useEcomImagePreview(previewItems);

  const modelCardItems = gallery.map((item, index) => ({
    id: item.id,
    ossUrl: item.ossUrl,
    label:
      index === 0
        ? `${item.label ?? `穿搭参考 ${index + 1}`} · 默认参考`
        : item.label ?? `穿搭参考 ${index + 1}`,
  }));

  const sceneCardItems = sceneRef?.ossUrl?.trim()
    ? [
        {
          id: "scene-ref",
          ossUrl: sceneRef.ossUrl.trim(),
          label: sceneRef.label ?? "场景参考",
        },
      ]
    : [];

  const sceneCatalogEntries = useMemo(
    () => sceneCatalog.map(sceneToPickerEntry),
    [sceneCatalog],
  );

  useEffect(() => {
    if (!sceneCatalogOpen || sceneCatalog.length > 0) return;
    setSceneCatalogLoading(true);
    void fetchEcomSceneLibraryCatalog()
      .then((catalog) => {
        const list = catalog.scenes.length
          ? catalog.scenes
          : [...(catalog.platform ?? []), ...(catalog.user ?? [])];
        setSceneCatalog(list);
      })
      .finally(() => setSceneCatalogLoading(false));
  }, [sceneCatalog.length, sceneCatalogOpen]);

  async function handleModelFiles(files: File[]) {
    if (!files.length || modelUploadDisabled) return;
    const remaining = OUTFIT_MODEL_GALLERY_MAX - gallery.length;
    await onUploadModelFiles(files.slice(0, remaining));
    if (modelInputRef.current) modelInputRef.current.value = "";
  }

  async function handleSceneFile(files: File[]) {
    const file = files[0];
    if (!file || sceneUploadDisabled) return;
    await onUploadSceneRef(file);
    if (sceneInputRef.current) sceneInputRef.current.value = "";
  }

  async function handleSceneCatalogPick(entry: CatalogPickerEntry) {
    const scene = sceneCatalog.find((s) => s.id === entry.id);
    await onPickSceneLibraryPreset({
      entryId: entry.id,
      entryName: entry.name,
      visualPromptFragment: scene?.visualPrompt ?? entry.subtitle,
    });
  }

  return (
    <>
      <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">穿搭参考</h2>
          <p className="mt-1 text-xs text-[#6e6e73]">
            上传并选择参考图，以便对人物比例、构图与风格进行针对性参考；场景图用于后续融图。
          </p>
        </div>

        <EcomRefUploadCard
          title="模特参考"
          items={modelCardItems}
          emptyHint={`上传 1～${OUTFIT_MODEL_GALLERY_MAX} 张已穿搭全身照。${IMAGE_UPLOAD_DROP_HINT}`}
          removeLabel="删除"
          accept="image/*"
          multiple
          busy={modelUploadDisabled}
          inputRef={modelInputRef}
          onPreviewItem={(item) => openPreview(item.ossUrl, item.label)}
          onUploadFiles={(files) => void handleModelFiles(files)}
          onOpenFilePicker={() => modelInputRef.current?.click()}
          onOpenAssetPicker={() => setModelAssetPickerOpen(true)}
          onRemove={refsDisabled ? undefined : (id) => void onRemoveModelItem(id)}
        />

        <EcomRefUploadCard
          title="场景参考"
          items={sceneCardItems}
          emptyHint={
            sceneLibraryPreset?.entryName
              ? `已选场景词库：${sceneLibraryPreset.entryName}。也可上传参考图覆盖。${IMAGE_UPLOAD_DROP_HINT}`
              : `可选。上传场景参考图，或从场景词库选择；逐镜「上传参考图」融图时可复用。${IMAGE_UPLOAD_DROP_HINT}`
          }
          removeLabel="删除"
          accept="image/*"
          multiple={false}
          busy={sceneUploadDisabled}
          inputRef={sceneInputRef}
          headerActions={
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={sceneUploadDisabled}
              className="h-7 px-2 text-[10px]"
              onClick={() => setSceneCatalogOpen(true)}
            >
              <BookOpen className="h-3 w-3 shrink-0" />
              场景库
            </EcomButtonSecondary>
          }
          onPreviewItem={(item) => openPreview(item.ossUrl, item.label)}
          onUploadFiles={(files) => void handleSceneFile(files)}
          onOpenFilePicker={() => sceneInputRef.current?.click()}
          onOpenAssetPicker={() => setSceneAssetPickerOpen(true)}
          onRemove={
            refsDisabled || !sceneCardItems.length ? undefined : () => void onRemoveSceneRef()
          }
        />

        {sceneLibraryPreset?.entryName && !sceneCardItems.length ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2.5 py-2">
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#0071e3]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#1d1d1f]">
                {sceneLibraryPreset.entryName}
              </p>
              <p className="truncate text-[10px] text-[#86868b]">场景词库 · 无参考图</p>
            </div>
            {!refsDisabled ? (
              <button
                type="button"
                className="rounded-full p-1 text-[#86868b] hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
                aria-label="清除场景词库"
                onClick={() => void onRemoveSceneRef()}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        {refsLocked ? (
          <p className="text-[11px] text-[#86868b]">
            参考图已锁定，如需更改请先解锁或新建项目。
          </p>
        ) : null}
      </section>

      <EcomAssetPickerDialog
        open={modelAssetPickerOpen}
        onOpenChange={setModelAssetPickerOpen}
        maxSelect={OUTFIT_MODEL_GALLERY_MAX - gallery.length}
        onConfirm={async (assets) => {
          setModelAssetPickerOpen(false);
          if (assets.length && !refsDisabled) await onAttachModelAssets(assets);
        }}
      />

      <EcomAssetPickerDialog
        open={sceneAssetPickerOpen}
        onOpenChange={setSceneAssetPickerOpen}
        maxSelect={1}
        onConfirm={async (assets) => {
          setSceneAssetPickerOpen(false);
          if (assets.length && !refsDisabled) await onAttachSceneAsset(assets);
        }}
      />

      <EcomCatalogPickerDialog
        open={sceneCatalogOpen}
        title={sceneCatalogLoading ? "加载场景库…" : "选择场景"}
        entries={sceneCatalogLoading ? [] : sceneCatalogEntries}
        onOpenChange={setSceneCatalogOpen}
        onPick={handleSceneCatalogPick}
      />

      <EcomImagePreviewHost preview={preview} galleryItems={galleryItems} onClose={closePreview} />
    </>
  );
}
