"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { ModelShotRefGenerateDialog } from "@/components/model-shot/model-shot-ref-generate-dialog";
import { VtonGarmentPoolPanel } from "@/components/vton/vton-garment-pool-panel";
import { VtonLookComposer } from "@/components/vton/vton-look-composer";
import { VtonResultsGrid } from "@/components/vton/vton-results-grid";
import { VtonTryonProgressStrip } from "@/components/vton/vton-tryon-progress-strip";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import type { WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import type { VtonTryonProgress } from "@/lib/vton-tryon-progress";
import type { VtonGarmentKind, VtonLookSpec, VtonProjectMeta } from "@/lib/vton-types";
import { cn } from "@/lib/utils";

export type VtonBatchWorkflowProps = {
  meta: VtonProjectMeta;
  selectedResultIds: string[];
  onToggleResult: (resultId: string) => void;
  onUploadGarment: (kind: VtonGarmentKind, file: File) => Promise<void>;
  onAddGarmentsFromAssets: (
    kind: VtonGarmentKind,
    assets: Array<{ ossUrl: string; title: string }>,
  ) => Promise<void>;
  onRemoveGarments: (ids: string[]) => Promise<void>;
  onChangeLooks: (looks: VtonLookSpec[]) => Promise<void>;
  onCartesianLooks?: (topIds: string[], bottomIds: string[]) => Promise<void>;
  onBatchTryon: () => Promise<void>;
  onLockSelected: () => Promise<void>;
  onSetDefaultLocked?: (lockedLookId: string) => Promise<void>;
  onUnlockLocked?: (lockedLookId: string) => Promise<void>;
};

export type VtonWorkbenchMode = "outfit-video" | "model-tryon";

type Props = {
  mode: VtonWorkbenchMode;
  refs: WorkflowRefs;
  outfitRefMode: OutfitRefMode;
  garmentMode: OutfitGarmentMode;
  refsLocked?: boolean;
  busy?: boolean;
  tryonBusy?: boolean;
  tryonProgress?: VtonTryonProgress | null;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  fusionModelKey: string;
  modelsLoading?: boolean;
  onOutfitRefModeChange: (mode: OutfitRefMode) => void;
  onGarmentModeChange: (mode: OutfitGarmentMode) => void;
  onUploadModel: (file: File) => Promise<void>;
  onUploadClothing: (file: File) => Promise<void>;
  onUploadTopGarment: (file: File) => Promise<void>;
  onUploadBottomGarment: (file: File) => Promise<void>;
  onPickModelFromLibrary: (ossUrl: string, label?: string) => Promise<void>;
  onAttachModelFromAssets?: (
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => Promise<void>;
  onGenerateModel: (opts: { prompt: string; modelKey: string }) => Promise<void>;
  onExpandFullBody: (opts: { prompt?: string; modelKey: string }) => Promise<void>;
  onTryon: () => Promise<void>;
  onLockRefs?: () => Promise<void>;
  onSaveToAssets?: () => Promise<void>;
  saveBusy?: boolean;
  batchWorkflow?: VtonBatchWorkflowProps;
};

function modeButtonClass(active: boolean): string {
  return cn(
    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
    active
      ? "border-[#0071e3] bg-[#f0f6ff] text-[#1d1d1f]"
      : "border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[#d2d2d7]",
  );
}

export function VtonRefWorkbench({
  mode,
  refs,
  outfitRefMode,
  garmentMode,
  refsLocked = false,
  busy,
  tryonBusy,
  tryonProgress,
  imageModels,
  imageModelKey,
  fusionModelKey,
  modelsLoading,
  onOutfitRefModeChange,
  onGarmentModeChange,
  onUploadModel,
  onUploadClothing,
  onUploadTopGarment,
  onUploadBottomGarment,
  onPickModelFromLibrary,
  onAttachModelFromAssets,
  onGenerateModel,
  onExpandFullBody,
  onTryon,
  onLockRefs,
  onSaveToAssets,
  saveBusy,
  batchWorkflow,
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [genModelOpen, setGenModelOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandPrompt, setExpandPrompt] = useState("");
  const [genModelKey, setGenModelKey] = useState(imageModelKey);

  useEffect(() => {
    setGenModelKey(imageModelKey);
  }, [imageModelKey]);

  const isAlreadyDressed = outfitRefMode === "already_dressed";
  const isTwoPiece = garmentMode === "two_piece";
  const useBatch = Boolean(batchWorkflow) && !isAlreadyDressed;
  const lockedCount = batchWorkflow?.meta.lockedLooks?.length ?? 0;
  const hasTryonPreview = useBatch
    ? lockedCount > 0 || Boolean(refs.dressedImage?.ossUrl)
    : Boolean(refs.dressedImage?.ossUrl);
  const canTryon = !isAlreadyDressed && !refsLocked && !useBatch;

  const modelItems = refs.model?.ossUrl
    ? [
        {
          id: "model",
          ossUrl: refs.model.ossUrl,
          label: refs.model.label ?? (isAlreadyDressed ? "已穿搭全身照" : "模特全身照"),
        },
      ]
    : [];

  const genModelDisplayName = useMemo(
    () => imageModels.find((m) => m.modelKey === genModelKey)?.displayName ?? genModelKey,
    [genModelKey, imageModels],
  );

  const fusionDisplayName = useMemo(
    () => imageModels.find((m) => m.modelKey === fusionModelKey)?.displayName ?? fusionModelKey,
    [fusionModelKey, imageModels],
  );

  const sectionTitle =
    mode === "model-tryon" ? "模特试衣" : "穿搭参考";
  const sectionHint =
    mode === "model-tryon"
      ? "选择模特与服装，AI 试衣后可保存到我的资产。"
      : "锁定全片人物与服装特征；动作由参考视频驱动，无需编辑 Prompt。";

  return (
    <section className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-[#1d1d1f]">{sectionTitle}</h2>
        <p className="mt-1 text-xs text-[#6e6e73]">{sectionHint}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className={modeButtonClass(isAlreadyDressed)}
          disabled={busy || tryonBusy || refsLocked}
          onClick={() => onOutfitRefModeChange("already_dressed")}
        >
          <span className="font-medium text-[#1d1d1f]">已穿搭</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed">
            上传 1 张已穿好目标服装的全身照，无需试衣。
          </span>
        </button>
        <button
          type="button"
          className={modeButtonClass(!isAlreadyDressed)}
          disabled={busy || tryonBusy || refsLocked}
          onClick={() => onOutfitRefModeChange("need_tryon")}
        >
          <span className="font-medium text-[#1d1d1f]">需穿衣</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed">
            上传模特全身照与服装，AI 试衣合成穿搭图。
          </span>
        </button>
      </div>

      {!isAlreadyDressed ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-[11px]",
              isTwoPiece
                ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                : "border-[#e8e8ed] text-[#6e6e73]",
            )}
            disabled={busy || tryonBusy || refsLocked}
            onClick={() => onGarmentModeChange("two_piece")}
          >
            上下装
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-[11px]",
              !isTwoPiece
                ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                : "border-[#e8e8ed] text-[#6e6e73]",
            )}
            disabled={busy || tryonBusy || refsLocked}
            onClick={() => onGarmentModeChange("one_piece")}
          >
            连体 / 单件
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-4",
          isAlreadyDressed ? "md:grid-cols-1" : isTwoPiece ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        <div className="space-y-2">
          <span className="text-xs font-medium text-[#6e6e73]">
            {isAlreadyDressed ? "已穿搭全身照" : "模特全身照"}
          </span>
          <EcomRefUploadCard
            title={isAlreadyDressed ? "已穿搭" : "模特"}
            items={modelItems}
            emptyHint={
              isAlreadyDressed
                ? `单人正面全身照，已穿好目标服装。${IMAGE_UPLOAD_DROP_HINT}`
                : `单人正面全身素模照；头像/半身可点「生成全身图」。${IMAGE_UPLOAD_DROP_HINT}`
            }
            accept="image/*"
            busy={busy}
            onUploadFiles={(files) => {
              const f = files[0];
              if (f) void onUploadModel(f);
            }}
            onOpenFilePicker={() => {
              const input = document.getElementById("vton-model-file") as HTMLInputElement | null;
              input?.click();
            }}
            toolbarPrefix={
              !isAlreadyDressed ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-50"
                    disabled={busy || refsLocked}
                    onClick={() => setGenModelOpen(true)}
                  >
                    AI 生模特
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-50"
                    disabled={busy || refsLocked || !refs.model?.ossUrl}
                    onClick={() => setExpandOpen(true)}
                  >
                    生成全身图
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-50"
                    disabled={busy || refsLocked}
                    onClick={() => setLibraryOpen(true)}
                  >
                    模特库
                  </button>
                  {onAttachModelFromAssets ? (
                    <button
                      type="button"
                      className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-50"
                      disabled={busy || refsLocked}
                      onClick={() => setAssetPickerOpen(true)}
                    >
                      我的资产
                    </button>
                  ) : null}
                </div>
              ) : undefined
            }
          />
          <input
            id="vton-model-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUploadModel(f);
              e.target.value = "";
            }}
          />
        </div>

        {!useBatch && !isAlreadyDressed && isTwoPiece ? (
          <>
            <GarmentSlot
              label="上装"
              title="上装"
              items={
                refs.topGarment?.ossUrl
                  ? [{ id: "top", ossUrl: refs.topGarment.ossUrl, label: refs.topGarment.label ?? "上装" }]
                  : []
              }
              hint={`上传上装平铺/上身图。${IMAGE_UPLOAD_DROP_HINT}`}
              inputId="vton-top-file"
              busy={busy}
              onUpload={(f) => void onUploadTopGarment(f)}
            />
            <GarmentSlot
              label="下装"
              title="下装"
              items={
                refs.bottomGarment?.ossUrl
                  ? [
                      {
                        id: "bottom",
                        ossUrl: refs.bottomGarment.ossUrl,
                        label: refs.bottomGarment.label ?? "下装",
                      },
                    ]
                  : []
              }
              hint={`上传下装平铺/上身图。${IMAGE_UPLOAD_DROP_HINT}`}
              inputId="vton-bottom-file"
              busy={busy}
              onUpload={(f) => void onUploadBottomGarment(f)}
            />
          </>
        ) : null}

        {!useBatch && !isAlreadyDressed && !isTwoPiece ? (
          <GarmentSlot
            label="连体 / 单件服装"
            title="服装"
            items={
              refs.clothing?.ossUrl
                ? [{ id: "clothing", ossUrl: refs.clothing.ossUrl, label: refs.clothing.label ?? "服装图" }]
                : []
            }
            hint={`上传连体或单件服装图。${IMAGE_UPLOAD_DROP_HINT}`}
            inputId="vton-clothing-file"
            busy={busy}
            onUpload={(f) => void onUploadClothing(f)}
          />
        ) : null}
      </div>

      {useBatch && batchWorkflow ? (
        <div className="space-y-3">
          <VtonGarmentPoolPanel
            pool={batchWorkflow.meta.garmentPool ?? []}
            busy={busy}
            disabled={refsLocked}
            onUploadGarment={batchWorkflow.onUploadGarment}
            onAddFromAssets={batchWorkflow.onAddGarmentsFromAssets}
            onRemove={batchWorkflow.onRemoveGarments}
          />
          <VtonLookComposer
            looks={batchWorkflow.meta.lookDrafts ?? []}
            pool={batchWorkflow.meta.garmentPool ?? []}
            busy={busy}
            disabled={refsLocked}
            onChange={batchWorkflow.onChangeLooks}
            onCartesian={batchWorkflow.onCartesianLooks}
          />
          <VtonResultsGrid
            batch={batchWorkflow.meta.tryonBatch}
            looks={batchWorkflow.meta.lookDrafts ?? []}
            lockedLooks={batchWorkflow.meta.lockedLooks ?? []}
            defaultLockedLookId={batchWorkflow.meta.defaultLockedLookId}
            tryonBusy={tryonBusy}
            busy={busy}
            disabled={refsLocked}
            mode={mode}
            selectedResultIds={batchWorkflow.selectedResultIds}
            onToggleResult={batchWorkflow.onToggleResult}
            onLockSelected={batchWorkflow.onLockSelected}
            onSetDefaultLocked={batchWorkflow.onSetDefaultLocked}
            onUnlockLocked={batchWorkflow.onUnlockLocked}
            onBatchTryon={batchWorkflow.onBatchTryon}
          />
        </div>
      ) : null}

      {!useBatch && hasTryonPreview ? (
        <div className="space-y-2">
          <span className="text-xs font-medium text-[#6e6e73]">试衣效果预览</span>
          <div className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-[#fafafa]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={refs.dressedImage!.ossUrl}
              alt="试衣预览"
              className="mx-auto max-h-[420px] w-auto object-contain"
            />
          </div>
        </div>
      ) : null}

      <VtonTryonProgressStrip active={tryonBusy} progress={tryonProgress ?? null} />

      {refsLocked ? (
        <p className="rounded-lg border border-[#d4edda] bg-[#f6fff8] px-3 py-2 text-xs text-[#1d6f42]">
          穿搭参考已锁定，可开始逐镜生成。
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canTryon ? (
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy || tryonBusy}
            onClick={() => void onTryon()}
          >
            {hasTryonPreview ? "重新 AI 试衣" : "AI 试衣"}
          </EcomButtonPrimary>
        ) : null}

        {mode === "outfit-video" && onLockRefs && !isAlreadyDressed ? (
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={
              busy ||
              tryonBusy ||
              refsLocked ||
              (useBatch ? lockedCount < 1 : canTryon && !hasTryonPreview)
            }
            onClick={() => void onLockRefs()}
          >
            锁定已选参考{useBatch && lockedCount > 0 ? ` (${lockedCount})` : ""}
          </EcomButtonSecondary>
        ) : null}

        {mode === "outfit-video" && isAlreadyDressed && onLockRefs ? (
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy || tryonBusy || refsLocked}
            onClick={() => void onLockRefs()}
          >
            锁定特征并进入逐镜生成
          </EcomButtonPrimary>
        ) : null}

        {mode === "model-tryon" && onSaveToAssets && hasTryonPreview ? (
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={busy || tryonBusy || saveBusy}
            onClick={() => void onSaveToAssets()}
          >
            保存到我的资产
          </EcomButtonSecondary>
        ) : null}
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <>
              <EcomModelLibraryPickerDialog
                open={libraryOpen}
                onOpenChange={setLibraryOpen}
                onPick={(entry) => {
                  setLibraryOpen(false);
                  void onPickModelFromLibrary(entry.ossUrl, entry.name);
                }}
              />
              {onAttachModelFromAssets ? (
                <EcomAssetPickerDialog
                  open={assetPickerOpen}
                  onOpenChange={setAssetPickerOpen}
                  maxSelect={1}
                  onConfirm={async (assets) => {
                    setAssetPickerOpen(false);
                    if (assets.length) await onAttachModelFromAssets(assets);
                  }}
                />
              ) : null}
              <ModelShotRefGenerateDialog
                open={genModelOpen}
                onClose={() => setGenModelOpen(false)}
                role="model"
                modelKey={genModelKey}
                modelDisplayName={genModelDisplayName}
                imageModels={imageModels}
                modelsLoading={modelsLoading}
                busy={busy}
                onConfirm={async (opts) => {
                  setGenModelOpen(false);
                  await onGenerateModel(opts);
                }}
              />
              {expandOpen ? (
                <VtonExpandFullBodyDialog
                  fusionDisplayName={fusionDisplayName}
                  prompt={expandPrompt}
                  onPromptChange={setExpandPrompt}
                  busy={busy}
                  onClose={() => setExpandOpen(false)}
                  onConfirm={async () => {
                    setExpandOpen(false);
                    await onExpandFullBody({
                      prompt: expandPrompt.trim() || undefined,
                      modelKey: fusionModelKey,
                    });
                  }}
                />
              ) : null}
            </>,
            document.body,
          )
        : null}
    </section>
  );
}

function GarmentSlot({
  label,
  title,
  items,
  hint,
  inputId,
  busy,
  onUpload,
}: {
  label: string;
  title: string;
  items: Array<{ id: string; ossUrl: string; label: string }>;
  hint: string;
  inputId: string;
  busy?: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[#6e6e73]">{label}</span>
      <EcomRefUploadCard
        title={title}
        items={items}
        emptyHint={hint}
        accept="image/*"
        busy={busy}
        onUploadFiles={(files) => {
          const f = files[0];
          if (f) onUpload(f);
        }}
        onOpenFilePicker={() => {
          const input = document.getElementById(inputId) as HTMLInputElement | null;
          input?.click();
        }}
      />
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function VtonExpandFullBodyDialog({
  fusionDisplayName,
  prompt,
  onPromptChange,
  busy,
  onClose,
  onConfirm,
}: {
  fusionDisplayName: string;
  prompt: string;
  onPromptChange: (v: string) => void;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-[#e8e8ed] bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="vton-expand-title"
      >
        <h3 id="vton-expand-title" className="text-sm font-semibold text-[#1d1d1f]">
          生成全身图
        </h3>
        <p className="mt-1 text-xs text-[#6e6e73]">
          将当前模特图扩展为全身照（{fusionDisplayName}）。可追加补充描述，留空则使用默认 Prompt。
        </p>
        <textarea
          className="mt-3 min-h-[88px] w-full rounded-lg border border-[#e8e8ed] px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
          placeholder="可选：补充姿态、背景等描述"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={busy}
        />
        <div className="mt-4 flex justify-end gap-2">
          <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={onClose}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary type="button" size="sm" disabled={busy} onClick={() => void onConfirm()}>
            开始生成
          </EcomButtonPrimary>
        </div>
      </div>
    </div>,
    document.body,
  );
}
