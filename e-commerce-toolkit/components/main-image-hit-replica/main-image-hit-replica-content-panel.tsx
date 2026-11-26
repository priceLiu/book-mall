"use client";

import Image from "next/image";
import { ChevronDown, ChevronUp, Link2, Loader2, Plus } from "lucide-react";
import { useCallback, useRef, useState, type RefObject } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/image-upload-utils";
import { EcomRefImageThumb } from "@/components/media/ecom-ref-image-thumb";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomWorkspaceTitleHeading } from "@/components/layout/ecom-workspace-title-heading";
import {
  ECOM_WORKSPACE_RESULT_COLUMN_CLASS,
  ECOM_WORKSPACE_RESULT_GRID_CLASS,
  ECOM_WORKSPACE_RESULT_LABEL_CLASS,
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

type UploadRole = "reference" | "product";

type Props = {
  project: MainImageHitReplicaProject;
  ratio: string;
  uploadingRole?: UploadRole | null;
  uploadProgress?: number | null;
  replicating?: boolean;
  onUpload: (file: File, role: UploadRole) => Promise<void>;
  onRemoveRef: (refId: string, role: UploadRole) => void;
  onSaveReferences: (references: MainImageHitReplicaReference[]) => void | Promise<void>;
};

export function MainImageHitReplicaContentPanel({
  project,
  ratio,
  uploadingRole = null,
  uploadProgress = null,
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

  const productUploading = uploadingRole === "product";
  const refUploading = uploadingRole === "reference";
  const productZoneDisabled = productUploading || Boolean(replicating);
  const refZoneDisabled = refUploading || Boolean(replicating);
  const productSlotsLeft = MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT - productRefs.length;
  const refSlotsLeft = MAIN_IMAGE_HIT_REPLICA_MAX_REF - referenceRefs.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-[var(--ecom-divider)] px-5 py-4">
        <EcomWorkspaceTitleHeading title="爆款图复刻" />
        <p className="mt-1 text-[11px] text-[var(--ecom-muted)]">
          在中栏先上传产品原图（可选），再上传爆款参考图；右侧配置后一键复刻。
        </p>
      </div>

      <div className="space-y-6 px-5 py-5">
        <section>
          <div className="mb-2 flex items-center gap-1">
            <h3 className="text-[11px] font-semibold text-[var(--ecom-ink)]">产品原图</h3>
            <span className="text-[10px] text-[var(--ecom-subtle)]">（选填）</span>
          </div>
          {productRefs.length > 0 ? (
            <>
            <input
              ref={productInputRef}
              type="file"
              accept={IMAGE_UPLOAD_ACCEPT}
              className="hidden"
              multiple={productSlotsLeft > 1}
              disabled={productZoneDisabled || productSlotsLeft <= 0}
              onChange={(e) => {
                const list = e.target.files;
                if (list?.length) void uploadMany(Array.from(list), "product");
                e.target.value = "";
              }}
            />
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {productRefs.map((ref, i) => (
                <HitReplicaRefThumb
                  key={ref.id}
                  caption={ref.label?.trim() || `产品${i + 1}`}
                  url={ref.ossUrl}
                  removeDisabled={replicating}
                  onRemove={() => onRemoveRef(ref.id, "product")}
                />
              ))}
              {productSlotsLeft > 0 ? (
                <HitReplicaRefAddTile
                  disabled={productZoneDisabled}
                  uploading={productUploading}
                  uploadProgress={productUploading ? uploadProgress : null}
                  multiple={productSlotsLeft > 1}
                  ariaLabel="继续上传产品图"
                  onOpenPicker={() => productInputRef.current?.click()}
                  onFiles={(files) => void uploadMany(files, "product")}
                  onError={pasteError}
                />
              ) : null}
            </div>
            </>
          ) : null}
          {productRefs.length === 0 && productSlotsLeft > 0 ? (
            <HitReplicaPasteUploadZone
              inputRef={productInputRef}
              disabled={productZoneDisabled}
              uploading={productUploading}
              uploadProgress={productUploading ? uploadProgress : null}
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
            <h3 className="text-[11px] font-semibold text-[var(--ecom-ink)]">参考内容</h3>
            <button
              type="button"
              className="text-[10px] text-[var(--ecom-subtle)] hover:text-[var(--ecom-ink)]"
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
                  ? "font-semibold text-[var(--ecom-ink)]"
                  : "text-[var(--ecom-subtle)]",
              )}
              onClick={() => setRefTab("upload")}
            >
              上传参考图
            </button>
            <button
              type="button"
              className={cn(
                "text-[11px]",
                refTab === "link" ? "font-semibold text-[var(--ecom-ink)]" : "text-[var(--ecom-subtle)]",
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
                  <HitReplicaRefThumb
                    key={ref.id}
                    caption={`图${i + 1}`}
                    url={ref.ossUrl}
                    removeDisabled={replicating}
                    onRemove={() => onRemoveRef(ref.id, "reference")}
                  />
                ))}
                {refSlotsLeft > 0 ? (
                  <HitReplicaRefAddTile
                    disabled={refZoneDisabled}
                    uploading={refUploading}
                    uploadProgress={refUploading ? uploadProgress : null}
                    multiple={refSlotsLeft > 1}
                    ariaLabel="继续上传参考图"
                    onOpenPicker={() => refInputRef.current?.click()}
                    onFiles={(files) => void uploadMany(files, "reference")}
                    onError={pasteError}
                  />
                ) : null}
              </div>
              <div className="mb-3 rounded-xl border border-[var(--ecom-divider)] bg-[var(--ecom-parchment)]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold text-[var(--ecom-ink)]"
                  onClick={() => setPerRefOpen((v) => !v)}
                >
                  单张参考要求
                  {perRefOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 text-[var(--ecom-subtle)]" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--ecom-subtle)]" />
                  )}
                </button>
                {perRefOpen ? (
                  <div className="space-y-2 border-t border-[var(--ecom-divider)] px-3 py-3">
                    <p className="text-[10px] leading-relaxed text-[var(--ecom-subtle)]">
                      每张参考图可单独备注参考要求，不填默认处理。
                    </p>
                    {referenceRefs.map((ref, i) => {
                      const draft =
                        perRefDraft[ref.id] ?? ref.referenceRequirement ?? "";
                      return (
                        <label key={ref.id} className="block">
                          <span className="mb-1 block text-[10px] font-medium text-[var(--ecom-muted)]">
                            参考图{i + 1}
                          </span>
                          <input
                            type="text"
                            disabled={replicating}
                            placeholder="参考要求（选填）"
                            value={draft}
                            className="w-full rounded-lg border border-[var(--ecom-divider)] bg-white px-2.5 py-2 text-[11px] text-[var(--ecom-ink)] placeholder:text-[#c7c7cc] focus:border-[var(--ecom-chrome-accent)] focus:outline-none"
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
          {referenceRefs.length > 0 ? (
            <input
              ref={refInputRef}
              type="file"
              accept={IMAGE_UPLOAD_ACCEPT}
              className="hidden"
              multiple={refSlotsLeft > 1}
              disabled={refZoneDisabled || refSlotsLeft <= 0}
              onChange={(e) => {
                const list = e.target.files;
                if (list?.length) {
                  void uploadMany(Array.from(list), "reference");
                }
                e.target.value = "";
              }}
            />
          ) : null}
          {referenceRefs.length === 0 && refSlotsLeft > 0 ? (
            <HitReplicaPasteUploadZone
              inputRef={refInputRef}
              disabled={refZoneDisabled}
              uploading={refUploading}
              uploadProgress={refUploading ? uploadProgress : null}
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
            <h3 className="mb-3 text-[11px] font-semibold text-[var(--ecom-ink)]">复刻结果</h3>
            <div className={ECOM_WORKSPACE_RESULT_GRID_CLASS}>
              {results.map((row) => (
                <article
                  key={row.id}
                  className={cn(
                    "flex min-w-0 flex-col overflow-hidden",
                    ECOM_WORKSPACE_RESULT_COLUMN_CLASS,
                  )}
                >
                  <div
                    className={cn(
                      "relative w-full",
                      ecomWorkspaceResultShellClass(),
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
                    ) : row.status === "failed" ? (
                      <PendingResultPlaceholder label="生成失败" />
                    ) : (
                      <PendingResultPlaceholder />
                    )}
                  </div>
                  <p className={ECOM_WORKSPACE_RESULT_LABEL_CLASS}>
                    {row.status === "failed"
                      ? row.failMessage ?? "生成失败"
                      : row.status === "generating"
                        ? `生成中 · #${row.index}`
                        : `复刻 #${row.index}`}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--ecom-divider)] px-4 py-8 text-[11px] text-[var(--ecom-subtle)]">
            <Link2 className="h-4 w-4 shrink-0" />
            上传参考图并在右下「一键复刻爆款图（N）」后，成片将按统一规格追加展示在此
          </div>
        )}
      </div>
    </div>
  );
}

function PendingResultPlaceholder({ label = "待出图" }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[11px] text-[var(--ecom-subtle)]">
      {label}
    </div>
  );
}

function HitReplicaUploadProgress({
  progress,
  label = "正在上传…",
}: {
  progress: number | null;
  label?: string;
}) {
  return (
    <div className="mb-2 w-full max-w-xs space-y-1">
      <div
        className={cn(
          "ecom-upload-progress",
          typeof progress !== "number" && "ecom-upload-progress-indeterminate",
        )}
      >
        <span
          style={
            typeof progress === "number"
              ? { width: `${Math.min(100, Math.max(0, progress))}%` }
              : undefined
          }
        />
      </div>
      <p className="text-[10px] text-[var(--ecom-primary)]">
        {typeof progress === "number" && progress >= 100 ? "完成" : label}
      </p>
    </div>
  );
}

function HitReplicaRefThumb({
  caption,
  url,
  removeDisabled,
  onRemove,
}: {
  caption: string;
  url: string;
  removeDisabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="w-[72px] shrink-0">
      <EcomRefImageThumb
        src={url}
        alt={caption}
        size={72}
        removeLabel={`删除${caption}`}
        onRemove={removeDisabled ? undefined : onRemove}
      />
      <p className="mt-1 truncate text-center text-[10px] text-[var(--ecom-subtle)]">{caption}</p>
    </div>
  );
}

function HitReplicaPasteUploadZone({
  title,
  hint,
  disabled,
  uploading,
  uploadProgress,
  multiple,
  inputRef,
  onOpenPicker,
  onFiles,
  onError,
}: {
  title: string;
  hint: string;
  disabled?: boolean;
  uploading?: boolean;
  uploadProgress?: number | null;
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
          ? "border-[var(--ecom-chrome-accent)] bg-[var(--ecom-content-selected-bg)] ring-2 ring-[var(--ecom-ink)]/10"
          : "border-[var(--ecom-border-soft)] text-[var(--ecom-muted)] hover:border-[var(--ecom-chrome-accent)]",
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
      aria-busy={uploading}
    >
      {uploading ? (
        <HitReplicaUploadProgress progress={uploadProgress ?? null} />
      ) : null}
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
      {uploading ? (
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ecom-primary)]" aria-hidden />
      ) : (
        <Plus className="h-6 w-6 text-[var(--ecom-subtle)]" />
      )}
      <span className="text-[11px] font-medium text-[#424245]">{title}</span>
      <span className="max-w-md text-[10px] leading-relaxed text-[var(--ecom-subtle)]">{hint}</span>
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
  uploading,
  uploadProgress,
  multiple,
  ariaLabel,
  onOpenPicker,
  onFiles,
  onError,
}: {
  disabled?: boolean;
  uploading?: boolean;
  uploadProgress?: number | null;
  multiple?: boolean;
  ariaLabel: string;
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
    <div className="relative w-[72px] shrink-0">
      <div
        {...dropZoneProps}
        title={pasteReady ? "支持粘贴图片" : ariaLabel}
        className={cn(
          "flex h-[72px] w-[72px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed p-1 outline-none transition-colors",
          dragOver
            ? "border-[var(--ecom-chrome-accent)] bg-[var(--ecom-content-selected-bg)]"
            : "border-[var(--ecom-border-soft)] text-[var(--ecom-subtle)] hover:border-[var(--ecom-chrome-accent)]",
          disabled && "pointer-events-none opacity-50",
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-busy={uploading}
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
        {uploading ? (
          <>
            <div className="ecom-upload-progress h-1 w-full">
              <span
                style={{
                  width: `${Math.min(100, Math.max(0, uploadProgress ?? 10))}%`,
                }}
              />
            </div>
            <Loader2 className="h-4 w-4 animate-spin text-[var(--ecom-primary)]" />
          </>
        ) : (
          <Plus className="h-5 w-5" />
        )}
      </div>
    </div>
  );
}