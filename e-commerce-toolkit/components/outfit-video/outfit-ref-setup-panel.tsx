"use client";

import { useRef, useState } from "react";

import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import type { WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import { cn } from "@/lib/utils";

type Props = {
  refs: WorkflowRefs;
  outfitRefMode: OutfitRefMode;
  garmentMode: OutfitGarmentMode;
  busy?: boolean;
  lockLabel?: string;
  onOutfitRefModeChange: (mode: OutfitRefMode) => void;
  onGarmentModeChange: (mode: OutfitGarmentMode) => void;
  onUploadModel: (file: File) => Promise<void>;
  onUploadClothing: (file: File) => Promise<void>;
  onUploadTopGarment: (file: File) => Promise<void>;
  onUploadBottomGarment: (file: File) => Promise<void>;
  onPickModelFromLibrary: (ossUrl: string, label?: string) => Promise<void>;
  onConfirm: () => void;
  confirmDisabled?: boolean;
};

function modeButtonClass(active: boolean): string {
  return cn(
    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
    active
      ? "border-[#0071e3] bg-[#f0f6ff] text-[#1d1d1f]"
      : "border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[#d2d2d7]",
  );
}

export function OutfitRefSetupPanel({
  refs,
  outfitRefMode,
  garmentMode,
  busy,
  lockLabel = "锁定特征并进入逐镜生成",
  onOutfitRefModeChange,
  onGarmentModeChange,
  onUploadModel,
  onUploadClothing,
  onUploadTopGarment,
  onUploadBottomGarment,
  onPickModelFromLibrary,
  onConfirm,
  confirmDisabled,
}: Props) {
  const modelInputRef = useRef<HTMLInputElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);
  const topInputRef = useRef<HTMLInputElement>(null);
  const bottomInputRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const isAlreadyDressed = outfitRefMode === "already_dressed";
  const isTwoPiece = garmentMode === "two_piece";

  const modelItems = refs.model?.ossUrl
    ? [
        {
          id: "model",
          ossUrl: refs.model.ossUrl,
          label: refs.model.label ?? (isAlreadyDressed ? "已穿搭全身照" : "模特全身照"),
        },
      ]
    : [];
  const clothingItems = refs.clothing?.ossUrl
    ? [{ id: "clothing", ossUrl: refs.clothing.ossUrl, label: refs.clothing.label ?? "服装图" }]
    : [];
  const topItems = refs.topGarment?.ossUrl
    ? [{ id: "top", ossUrl: refs.topGarment.ossUrl, label: refs.topGarment.label ?? "上装" }]
    : [];
  const bottomItems = refs.bottomGarment?.ossUrl
    ? [
        {
          id: "bottom",
          ossUrl: refs.bottomGarment.ossUrl,
          label: refs.bottomGarment.label ?? "下装",
        },
      ]
    : [];

  const dressedLocked = Boolean(refs.dressedImage?.ossUrl);

  return (
    <section className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-[#1d1d1f]">穿搭参考</h2>
        <p className="mt-1 text-xs text-[#6e6e73]">
          锁定全片人物与服装特征；动作由参考视频驱动，无需编辑 Prompt。
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className={modeButtonClass(isAlreadyDressed)}
          disabled={busy || dressedLocked}
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
          disabled={busy || dressedLocked}
          onClick={() => onOutfitRefModeChange("need_tryon")}
        >
          <span className="font-medium text-[#1d1d1f]">需穿衣</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed">
            上传模特全身照与服装，系统将自动 AI 试衣合成穿搭图。
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
            disabled={busy || dressedLocked}
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
            disabled={busy || dressedLocked}
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
                : `单人正面全身素模照；半身/特殊角度请先在试衣间合成，再选「已穿搭」上传。${IMAGE_UPLOAD_DROP_HINT}`
            }
            accept="image/*"
            busy={busy}
            onUploadFiles={(files) => {
              const f = files[0];
              if (f) void onUploadModel(f);
            }}
            onOpenFilePicker={() => modelInputRef.current?.click()}
            toolbarPrefix={
              !isAlreadyDressed ? (
                <button
                  type="button"
                  className="text-[11px] text-[#0071e3] hover:underline"
                  disabled={busy}
                  onClick={() => setLibraryOpen(true)}
                >
                  模特库
                </button>
              ) : undefined
            }
          />
          <input
            ref={modelInputRef}
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

        {!isAlreadyDressed && isTwoPiece ? (
          <>
            <div className="space-y-2">
              <span className="text-xs font-medium text-[#6e6e73]">上装</span>
              <EcomRefUploadCard
                title="上装"
                items={topItems}
                emptyHint={`上传上装平铺/上身图。${IMAGE_UPLOAD_DROP_HINT}`}
                accept="image/*"
                busy={busy}
                onUploadFiles={(files) => {
                  const f = files[0];
                  if (f) void onUploadTopGarment(f);
                }}
                onOpenFilePicker={() => topInputRef.current?.click()}
              />
              <input
                ref={topInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUploadTopGarment(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-[#6e6e73]">下装</span>
              <EcomRefUploadCard
                title="下装"
                items={bottomItems}
                emptyHint={`上传下装平铺/上身图。${IMAGE_UPLOAD_DROP_HINT}`}
                accept="image/*"
                busy={busy}
                onUploadFiles={(files) => {
                  const f = files[0];
                  if (f) void onUploadBottomGarment(f);
                }}
                onOpenFilePicker={() => bottomInputRef.current?.click()}
              />
              <input
                ref={bottomInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUploadBottomGarment(f);
                  e.target.value = "";
                }}
              />
            </div>
          </>
        ) : null}

        {!isAlreadyDressed && !isTwoPiece ? (
          <div className="space-y-2">
            <span className="text-xs font-medium text-[#6e6e73]">连体 / 单件服装</span>
            <EcomRefUploadCard
              title="服装"
              items={clothingItems}
              emptyHint={`上传连体或单件服装图。${IMAGE_UPLOAD_DROP_HINT}`}
              accept="image/*"
              busy={busy}
              onUploadFiles={(files) => {
                const f = files[0];
                if (f) void onUploadClothing(f);
              }}
              onOpenFilePicker={() => clothingInputRef.current?.click()}
            />
            <input
              ref={clothingInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadClothing(f);
                e.target.value = "";
              }}
            />
          </div>
        ) : null}
      </div>

      {refs.dressedImage?.ossUrl ? (
        <p className="rounded-lg border border-[#d4edda] bg-[#f6fff8] px-3 py-2 text-xs text-[#1d6f42]">
          穿搭参考已锁定
          {refs.dressedImage.source === "aitryon-plus" ? "（AI 试衣成片）" : ""}，可开始逐镜生成。
        </p>
      ) : null}

      <EcomButtonPrimary
        type="button"
        size="sm"
        disabled={busy || confirmDisabled || dressedLocked}
        onClick={onConfirm}
      >
        {lockLabel}
      </EcomButtonPrimary>

      <EcomModelLibraryPickerDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={(entry) => {
          setLibraryOpen(false);
          void onPickModelFromLibrary(entry.ossUrl, entry.name);
        }}
      />
    </section>
  );
}
