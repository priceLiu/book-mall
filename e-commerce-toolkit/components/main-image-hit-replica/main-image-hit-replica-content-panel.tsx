"use client";

import Image from "next/image";
import { ChevronDown, ChevronUp, Link2, Plus, X } from "lucide-react";
import { useCallback, useRef, useState, type RefObject } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/image-upload-utils";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomWorkspaceTitleHeading } from "@/components/layout/ecom-workspace-title-heading";
import {
  ECOM_WORKSPACE_RESULT_GRID_CLASS,
  ecomWorkspaceResultShellClass,
} from "@/lib/ecom-workspace-result-grid";
import {
  MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT,
  MAIN_IMAGE_HIT_REPLICA_MAX_REF,
  type MainImageHitReplicaProject,
  type MainImageHitReplicaReference,
} from "@/lib/main-image-hit-replica-types";
import { hitReplicaAspectToCssRatio } from "@/lib/main-image-hit-replica-settings";
import { cn } from "@/lib/utils";

type Props = {
  project: MainImageHitReplicaProject;
  ratio: string;
  refBusy?: boolean;
  replicating?: boolean;
  onUpload: (file: File, role: "reference" | "product") => Promise<void>;
  onRemoveRef: (refId: string, role: "reference" | "product") => void;
  onSaveReferences: (references: MainImageHitReplicaReference[]) => void | Promise<void>;
};

export function MainImageHitReplicaContentPanel({
  project,
  ratio,
  refBusy,
  replicating,
  onUpload,
  onRemoveRef,
  onSaveReferences,
}: Props) {
  const { alert } = useDialogs();
  const refInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const [refTab, setRefTab] = useState<"upload" | "link">("upload");
  const [perRefOpen, setPerRefOpen] = useState(true);
  const [perRefDraft, setPerRefDraft] = useState<Record<string, string>>({});

  const referenceRefs = project.references.filter((r) => r.role === "reference");
  const productRefs = project.references.filter((r) => r.role === "product");
  const results = project.output.results;

  const uploadMany = useCallback(
    async (files: File[], role: "reference" | "product") => {
      const max =
        role === "product"
          ? MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT
          : MAIN_IMAGE_HIT_REPLICA_MAX_REF;
      const start =
        role === "product" ? productRefs.length : referenceRefs.length;
      let n = start;
      for (const file of files) {
        if (n >= max) break;
        await onUpload(file, role);
        n += 1;
      }
    },
    [onUpload, productRefs.length, referenceRefs.length],
  );

  const pasteError = useCallback(
    (title: string, message: string) => {
      void alert({ title, message, variant: "error" });
    },
    [alert],
  );

  const uploadDisabled = Boolean(refBusy || replicating);
  const productSlotsLeft = MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT - productRefs.length;
  const refSlotsLeft = MAIN_IMAGE_HIT_REPLICA_MAX_REF - referenceRefs.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-[#e8e8ed] px-5 py-4">
        <EcomWorkspaceTitleHeading title="爆款图复刻" />
        <p className="mt-1 text-[11px] text-[#6e6e73]">
          在中栏先上传产品原图（可选），再上传爆款参考图；右侧配置后一键复刻。
        </p>
      </div>

      <div className="space-y-6 px-5 py-5">
        <section>
          <div className="mb-2 flex items-center gap-1">
            <h3 className="text-[11px] font-semibold text-[#1d1d1f]">产品原图</h3>
            <span className="text-[10px] text-[#86868b]">（选填）</span>
          </div>
          {productRefs.length > 0 ? (
            <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {productRefs.map((ref) => (
                <RefThumbCard
                  key={ref.id}
                  label={ref.label || "产品图"}
                  url={ref.ossUrl}
                  disabled={refBusy || replicating}
                  onRemove={() => onRemoveRef(ref.id, "product")}
                />
              ))}
            </div>
          ) : null}
          {productSlotsLeft > 0 ? (
            <HitReplicaPasteUploadZone
              inputRef={productInputRef}
              disabled={uploadDisabled}
              multiple={productSlotsLeft > 1}
              title="上传产品图"
              hint="需要换产品时上传；不换产品可跳过"
              onOpenPicker={() => productInputRef.current?.click()}
              onFiles={(files) => void uploadMany(files, "product")}
              onError={pasteError}
            />
          ) : null}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold text-[#1d1d1f]">参考内容</h3>
            <button
              type="button"
              className="text-[10px] text-[#86868b] hover:text-[#1d1d1f]"
              onClick={() =>
                void alert({
                  title: "图片采集插件",
                  message: "浏览器采集插件即将上线，当前请在本页上传参考图。",
                })
              }
            >
              图片采集插件
            </button>
          </div>
          <div className="mb-3 flex gap-2 border-b border-[#f0f0f2] pb-2">
            <button
              type="button"
              className={cn(
                "text-[11px]",
                refTab === "upload"
                  ? "font-semibold text-[#1d1d1f]"
                  : "text-[#86868b]",
              )}
              onClick={() => setRefTab("upload")}
            >
              上传参考图
            </button>
            <button
              type="button"
              className={cn(
                "text-[11px]",
                refTab === "link" ? "font-semibold text-[#1d1d1f]" : "text-[#86868b]",
              )}
              onClick={() => {
                setRefTab("link");
                void alert({
                  title: "导入链接",
                  message: "链接导入即将支持，请先上传参考图文件。",
                });
              }}
            >
              导入链接
            </button>
          </div>
          {referenceRefs.length > 0 ? (
            <>
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {referenceRefs.map((ref, i) => (
                  <RefThumbTile
                    key={ref.id}
                    caption={`图${i + 1}`}
                    url={ref.ossUrl}
                    disabled={refBusy || replicating}
                    onRemove={() => onRemoveRef(ref.id, "reference")}
                  />
                ))}
                {refSlotsLeft > 0 ? (
                  <HitReplicaRefAddTile
                    disabled={uploadDisabled}
                    multiple={refSlotsLeft > 1}
                    onOpenPicker={() => refInputRef.current?.click()}
                    onFiles={(files) => void uploadMany(files, "reference")}
                    onError={pasteError}
                  />
                ) : null}
              </div>
              <div className="mb-3 rounded-xl border border-[#e8e8ed] bg-[#f5f5f7]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold text-[#1d1d1f]"
                  onClick={() => setPerRefOpen((v) => !v)}
                >
                  单张参考要求
                  {perRefOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 text-[#86868b]" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-[#86868b]" />
                  )}
                </button>
                {perRefOpen ? (
                  <div className="space-y-2 border-t border-[#e8e8ed] px-3 py-3">
                    <p className="text-[10px] leading-relaxed text-[#86868b]">
                      每张参考图可单独备注参考要求，不填默认处理。
                    </p>
                    {referenceRefs.map((ref, i) => {
                      const draft =
                        perRefDraft[ref.id] ?? ref.referenceRequirement ?? "";
                      return (
                        <label key={ref.id} className="block">
                          <span className="mb-1 block text-[10px] font-medium text-[#6e6e73]">
                            参考图{i + 1}
                          </span>
                          <input
                            type="text"
                            disabled={refBusy || replicating}
                            placeholder="参考要求（选填）"
                            value={draft}
                            className="w-full rounded-lg border border-[#e8e8ed] bg-white px-2.5 py-2 text-[11px] text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:border-[var(--ecom-chrome-accent)] focus:outline-none"
                            onChange={(e) =>
                              setPerRefDraft((prev) => ({
                                ...prev,
                                [ref.id]: e.target.value,
                              }))
                            }
                            onBlur={() => {
                              const next = draft.trim();
                              if (next === (ref.referenceRequirement ?? "").trim()) return;
                              const refs = project.references.map((r) =>
                                r.id === ref.id
                                  ? { ...r, referenceRequirement: next || undefined }
                                  : r,
                              );
                              void onSaveReferences(refs);
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          <input
            ref={refInputRef}
            type="file"
            accept={IMAGE_UPLOAD_ACCEPT}
            className="hidden"
            multiple={refSlotsLeft > 1}
            disabled={uploadDisabled || refSlotsLeft <= 0}
            onChange={(e) => {
              const list = e.target.files;
              if (list?.length) {
                void uploadMany(Array.from(list), "reference");
              }
              e.target.value = "";
            }}
          />
          {referenceRefs.length === 0 && refSlotsLeft > 0 ? (
            <HitReplicaPasteUploadZone
              inputRef={refInputRef}
              disabled={uploadDisabled}
              multiple
              title="上传参考图"
              hint={`支持复刻套图，最多上传 ${MAIN_IMAGE_HIT_REPLICA_MAX_REF} 张`}
              onOpenPicker={() => refInputRef.current?.click()}
              onFiles={(files) => void uploadMany(files, "reference")}
              onError={pasteError}
            />
          ) : null}
        </section>

        {results.length > 0 ? (
          <section>
            <h3 className="mb-3 text-[11px] font-semibold text-[#1d1d1f]">复刻结果</h3>
            <div className={ECOM_WORKSPACE_RESULT_GRID_CLASS}>
              {results.map((row) => {
                const refThumb = referenceRefs.find((r) => r.id === row.sourceRefId)?.ossUrl;
                return (
                  <article
                    key={row.id}
                    className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-white"
                  >
                    <div
                      className={cn(
                        "relative w-full bg-[#f5f5f7]",
                        ecomWorkspaceResultShellClass,
                      )}
                      style={{ aspectRatio: hitReplicaAspectToCssRatio(ratio) }}
                    >
                      {row.status === "generating" ? (
                        <EcomMediaGeneratingBusy background="light" />
                      ) : row.imageUrl ? (
                        <Image
                          src={row.imageUrl}
                          alt={`复刻 ${row.index}`}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      ) : refThumb ? (
                        <Image
                          src={refThumb}
                          alt="参考"
                          fill
                          className="object-contain opacity-40"
                          unoptimized
                        />
                      ) : (
                        <PendingResultPlaceholder />
                      )}
                    </div>
                    <p className="border-t border-[#f0f0f2] px-2 py-1.5 text-[10px] text-[#86868b]">
                      {row.status === "failed"
                        ? row.failMessage ?? "生成失败"
                        : `复刻 #${row.index}`}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#e8e8ed] px-4 py-8 text-[11px] text-[#86868b]">
            <Link2 className="h-4 w-4 shrink-0" />
            上传参考图并在右侧点「一键复刻爆款图」后，结果将展示在此
          </div>
        )}
      </div>
    </div>
  );
}

function PendingResultPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-[11px] text-[#86868b]">
      待出图
    </div>
  );
}

function HitReplicaPasteUploadZone({
  title,
  hint,
  disabled,
  multiple,
  inputRef,
  onOpenPicker,
  onFiles,
  onError,
}: {
  title: string;
  hint: string;
  disabled?: boolean;
  multiple?: boolean;
  inputRef: RefObject<HTMLInputElement>;
  onOpenPicker: () => void;
  onFiles: (files: File[]) => void | Promise<void>;
  onError: (title: string, message: string) => void;
}) {
  const { dragOver, pasteReady, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: !disabled,
    multiple: Boolean(multiple),
    onFiles,
    onError,
  });

  const openPicker = () => {
    if (disabled) return;
    focusZone();
    onOpenPicker();
  };

  return (
    <div
      {...dropZoneProps}
      className={cn(
        "flex w-full min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center outline-none transition-colors",
        dragOver
          ? "border-[var(--ecom-chrome-accent)] bg-[#f0f6ff] ring-2 ring-[#1d1d1f]/10"
          : "border-[#d2d2d7] text-[#6e6e73] hover:border-[var(--ecom-chrome-accent)]",
        disabled && "pointer-events-none opacity-50",
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("input")) return;
        openPicker();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={title}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) void onFiles(Array.from(list));
          e.target.value = "";
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <Plus className="h-6 w-6 text-[#86868b]" />
      <span className="text-[11px] font-medium text-[#424245]">{title}</span>
      <span className="max-w-md text-[10px] leading-relaxed text-[#86868b]">{hint}</span>
      <span className="text-[10px] text-[#c7c7cc]">
        {dragOver
          ? "松开以上传"
          : pasteReady
            ? "支持拖放 · Ctrl+V / ⌘V 粘贴"
            : "鼠标移入本区后可粘贴 · 支持拖放"}
      </span>
    </div>
  );
}

function HitReplicaRefAddTile({
  disabled,
  multiple,
  onOpenPicker,
  onFiles,
  onError,
}: {
  disabled?: boolean;
  multiple?: boolean;
  onOpenPicker: () => void;
  onFiles: (files: File[]) => void | Promise<void>;
  onError: (title: string, message: string) => void;
}) {
  const { dragOver, pasteReady, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: !disabled,
    multiple: Boolean(multiple),
    onFiles,
    onError,
  });

  return (
    <div
      {...dropZoneProps}
      title={pasteReady ? "支持粘贴图片" : "继续上传参考图"}
      className={cn(
        "flex h-[72px] w-[72px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed outline-none transition-colors",
        dragOver
          ? "border-[var(--ecom-chrome-accent)] bg-[#f0f6ff]"
          : "border-[#d2d2d7] text-[#86868b] hover:border-[var(--ecom-chrome-accent)]",
        disabled && "pointer-events-none opacity-50",
      )}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="继续上传参考图"
      onClick={() => {
        if (disabled) return;
        focusZone();
        onOpenPicker();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          focusZone();
          onOpenPicker();
        }
      }}
    >
      <Plus className="h-5 w-5" />
    </div>
  );
}

function RefThumbTile({
  caption,
  url,
  disabled,
  onRemove,
}: {
  caption: string;
  url: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="relative w-[72px] shrink-0">
      <div className="relative h-[72px] overflow-hidden rounded-lg border border-[#e8e8ed] bg-white">
        <Image src={url} alt={caption} fill className="object-cover" unoptimized />
        <button
          type="button"
          disabled={disabled}
          className="absolute right-0.5 top-0.5 rounded-full bg-black/55 p-0.5 text-white hover:bg-black/75 disabled:opacity-40"
          aria-label={`删除${caption}`}
          onClick={onRemove}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
      <p className="mt-1 text-center text-[10px] text-[#86868b]">{caption}</p>
    </div>
  );
}

function RefThumbCard({
  label,
  url,
  disabled,
  onRemove,
}: {
  label: string;
  url: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8e8ed] bg-[#fafafa]">
      <h4 className="px-2 pt-2 text-[10px] font-medium text-[#6e6e73]">{label}</h4>
      <div className="relative m-2 aspect-square overflow-hidden rounded-lg bg-white">
        <Image src={url} alt={label} fill className="object-contain" unoptimized />
      </div>
      <button
        type="button"
        disabled={disabled}
        className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 disabled:opacity-40"
        aria-label="删除"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}