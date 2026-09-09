"use client";

import { useCallback, useRef, useState } from "react";
import { Images, Plus } from "lucide-react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import {
  VtonCompositeFullSetCard,
  VtonManualDualSlotRow,
} from "@/components/vton/vton-full-set-garment-slot";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import {
  filterFullSetGarmentsByMode,
  isFullSetGarmentReady,
  type VtonFullSetUploadSlot,
} from "@/lib/vton-full-set-garment";
import type { AddLookDraftOpts } from "@/components/vton/vton-look-composer";
import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  VTON_FULL_SET_COMPOSITE_HINT,
  VTON_FULL_SET_COMPOSITE_LABEL,
  VTON_FULL_SET_MANUAL_HINT,
  VTON_FULL_SET_MANUAL_LABEL,
  VTON_GARMENT_KIND_LABELS,
  VTON_GARMENT_KIND_SHORT_LABELS,
  VTON_GARMENT_POOL_COLUMNS,
  VTON_GARMENT_UPLOAD_HINTS,
  VTON_LOOK_KIND_LABELS,
  type VtonGarmentItem,
  type VtonGarmentKind,
  type VtonLookKind,
} from "@/lib/vton-types";
import { cn } from "@/lib/utils";

/** 服装池各列统一最小高度 */
const POOL_COLUMN_CLASS = "flex min-h-[240px] flex-col space-y-1.5";
const POOL_CARD_CONTENT_MIN_H = "min-h-[140px]";
const POOL_COLUMN_HINT_CLASS = "text-[10px] leading-snug text-[#86868b]";
const POOL_CARD_SHELL_CLASS =
  "rounded-lg border border-[#e8e8ed] bg-white px-2.5 py-2 outline-none transition-colors hover:border-[#0071e3]/40";

export type VtonGarmentUploadOpts = {
  fullSetSlot?: VtonFullSetUploadSlot;
  garmentId?: string;
};

type Props = {
  pool: VtonGarmentItem[];
  lookCount?: number;
  busy?: boolean;
  disabled?: boolean;
  onUploadGarment: (kind: VtonGarmentKind, file: File, opts?: VtonGarmentUploadOpts) => Promise<void>;
  onAddFromAssets: (
    kind: VtonGarmentKind,
    assets: Array<{ ossUrl: string; title: string }>,
    opts?: VtonGarmentUploadOpts,
  ) => Promise<void>;
  onRemove: (ids: string[]) => Promise<void>;
  onPreviewGarment?: (item: VtonGarmentItem) => void;
  onAddLook?: (kind: VtonLookKind, opts?: AddLookDraftOpts) => void | Promise<void>;
};

/** 与 EcomRefUploadCard 顶栏按钮一致 */
function PoolUploadToolbar({
  busy,
  disabled,
  onOpenAssets,
  onUploadClick,
  onFocusZone,
  uploadLabel = "上传",
}: {
  busy?: boolean;
  disabled?: boolean;
  onOpenAssets?: () => void;
  onUploadClick: () => void;
  onFocusZone?: () => void;
  uploadLabel?: string;
}) {
  return (
    <div className="mb-1.5 flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {onOpenAssets ? (
        <EcomButtonSecondary
          size="sm"
          type="button"
          disabled={busy || disabled}
          className="h-7 px-2 text-[10px]"
          onClick={() => {
            onFocusZone?.();
            onOpenAssets();
          }}
        >
          <Images className="h-3 w-3 shrink-0" />
          我的资产
        </EcomButtonSecondary>
      ) : null}
      <EcomButtonSecondary
        size="sm"
        type="button"
        disabled={busy || disabled}
        className="h-7 px-2 text-[10px]"
        onClick={() => {
          onFocusZone?.();
          onUploadClick();
        }}
      >
        <Plus className="h-3 w-3 shrink-0" />
        {uploadLabel}
      </EcomButtonSecondary>
    </div>
  );
}

/** 各服装池列底部 · 添加对应类型搭配行 */
function PoolAddLookButton({
  label,
  lookKind,
  lookCount = 0,
  busy,
  disabled,
  fullSetMode,
  onAddLook,
}: {
  label: string;
  lookKind: VtonLookKind;
  lookCount?: number;
  busy?: boolean;
  disabled?: boolean;
  fullSetMode?: AddLookDraftOpts["fullSetMode"];
  onAddLook?: (kind: VtonLookKind, opts?: AddLookDraftOpts) => void | Promise<void>;
}) {
  if (!onAddLook) return null;
  const atMax = lookCount >= ECOM_VTON_MAX_BATCH_LOOKS;
  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-1 rounded-md border border-[#e8e8ed] bg-white px-2 py-1.5 text-[10px] font-medium text-[#0071e3] transition hover:border-[#0071e3]/35 hover:bg-[#f0f6ff] disabled:opacity-50"
      disabled={busy || disabled || atMax}
      title={atMax ? `已达 ${ECOM_VTON_MAX_BATCH_LOOKS} 套上限` : undefined}
      onClick={() => void onAddLook(lookKind, fullSetMode ? { fullSetMode } : undefined)}
    >
      <Plus className="h-3 w-3 shrink-0" />
      {label}
    </button>
  );
}

export function VtonGarmentPoolPanel({
  pool,
  lookCount = 0,
  busy,
  disabled,
  onUploadGarment,
  onAddFromAssets,
  onRemove,
  onPreviewGarment,
  onAddLook,
}: Props) {
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetKind, setAssetKind] = useState<VtonGarmentKind>("top");
  const [assetFullSetSlot, setAssetFullSetSlot] = useState<VtonFullSetUploadSlot>("composite");
  const [assetGarmentId, setAssetGarmentId] = useState<string | undefined>();
  const [garmentBusy, setGarmentBusy] = useState(false);
  const poolDisabled = Boolean(busy || disabled);

  const runGarmentOp = useCallback(async (fn: () => Promise<void>) => {
    setGarmentBusy(true);
    try {
      await fn();
    } finally {
      setGarmentBusy(false);
    }
  }, []);

  function openAssets(kind: VtonGarmentKind, opts?: VtonGarmentUploadOpts) {
    setAssetKind(kind);
    setAssetFullSetSlot(opts?.fullSetSlot ?? "composite");
    setAssetGarmentId(opts?.garmentId);
    setAssetOpen(true);
  }

  const grouped: Record<Exclude<VtonGarmentKind, "full_set">, VtonGarmentItem[]> = {
    top: pool.filter((g) => g.kind === "top"),
    bottom: pool.filter((g) => g.kind === "bottom"),
    one_piece: pool.filter((g) => g.kind === "one_piece"),
  };
  const compositeFullSets = filterFullSetGarmentsByMode(pool, "composite");
  const manualFullSets = filterFullSetGarmentsByMode(pool, "manual");

  return (
    <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
      <div>
        <h3 className="text-xs font-semibold text-[#1d1d1f]">服装池</h3>
        <p className="text-[11px] text-[#6e6e73]">
          上传或从资产选择，用于编排最多 {ECOM_VTON_MAX_BATCH_LOOKS} 套搭配。服饰图建议平铺、背景干净、主体完整（见百炼
          aitryon-plus 要求）。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {VTON_GARMENT_POOL_COLUMNS.map((col) => {
          if (col.type === "kind") {
            return (
              <GarmentKindSlot
                key={col.kind}
                kind={col.kind}
                items={grouped[col.kind]}
                lookCount={lookCount}
                disabled={poolDisabled}
                onUpload={(kind, file) =>
                  runGarmentOp(() => onUploadGarment(kind, file))
                }
                onOpenAssets={openAssets}
                onRemove={onRemove}
                onPreviewGarment={onPreviewGarment}
                onAddLook={onAddLook}
              />
            );
          }
          if (col.mode === "composite") {
            return (
              <CompositeFullSetColumn
                key="full_set-composite"
                items={compositeFullSets}
                lookCount={lookCount}
                garmentBusy={garmentBusy}
                disabled={poolDisabled}
                onUpload={(file) =>
                  runGarmentOp(() =>
                    onUploadGarment("full_set", file, { fullSetSlot: "composite" }),
                  )
                }
                onOpenAssets={() => openAssets("full_set", { fullSetSlot: "composite" })}
                onRemove={onRemove}
                onPreviewGarment={onPreviewGarment}
                onAddLook={onAddLook}
              />
            );
          }
          return (
            <ManualFullSetColumn
              key="full_set-manual"
              items={manualFullSets}
              lookCount={lookCount}
              garmentBusy={garmentBusy}
              disabled={poolDisabled}
              onUpload={(slot, file, garmentId) =>
                runGarmentOp(() =>
                  onUploadGarment("full_set", file, { fullSetSlot: slot, garmentId }),
                )
              }
              onOpenAssets={(slot, garmentId) =>
                openAssets("full_set", { fullSetSlot: slot, garmentId })
              }
              onRemove={onRemove}
              onPreviewGarment={onPreviewGarment}
              onAddLook={onAddLook}
            />
          );
        })}
      </div>

      <EcomAssetPickerDialog
        open={assetOpen}
        onOpenChange={setAssetOpen}
        maxSelect={assetKind === "full_set" && assetFullSetSlot === "bottom" ? 1 : 5}
        onConfirm={async (assets) => {
          setAssetOpen(false);
          if (!assets.length) return;
          const mapped = assets.map((a) => ({
            ossUrl: a.ossUrl,
            title: a.title ?? VTON_GARMENT_KIND_LABELS[assetKind],
          }));
          await runGarmentOp(() =>
            onAddFromAssets(assetKind, mapped, {
              fullSetSlot: assetKind === "full_set" ? assetFullSetSlot : undefined,
              garmentId: assetGarmentId,
            }),
          );
        }}
      />
    </section>
  );
}

/** 整图套装上传 / 分割中 · 居中浅色扫光（非黑底小方块） */
function CompositeFullSetBusyPlaceholder({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#fafafa]",
        POOL_CARD_CONTENT_MIN_H,
      )}
    >
      <EcomMediaGeneratingBusy label={label} background="light" />
    </div>
  );
}

/** 套装整图列 · 上传整图，卡片展示原图 + 自动分割双槽 */
function CompositeFullSetColumn({
  items,
  lookCount,
  garmentBusy,
  disabled,
  onUpload,
  onOpenAssets,
  onRemove,
  onPreviewGarment,
  onAddLook,
}: {
  items: VtonGarmentItem[];
  lookCount?: number;
  garmentBusy?: boolean;
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
  onOpenAssets: () => void;
  onRemove: (ids: string[]) => Promise<void>;
  onPreviewGarment?: (item: VtonGarmentItem) => void;
  onAddLook?: (kind: VtonLookKind, opts?: AddLookDraftOpts) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadHint = `${VTON_FULL_SET_COMPOSITE_HINT}。${IMAGE_UPLOAD_DROP_HINT}`;
  const uploadingFirst = garmentBusy && items.length === 0;
  const hasItems = items.length > 0;
  const { dragOver, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: !garmentBusy && !disabled && hasItems,
    multiple: true,
    onFiles: (files) => {
      for (const file of files) void onUpload(file);
    },
  });

  return (
    <div className={POOL_COLUMN_CLASS}>
      <h4 className="text-xs font-semibold leading-snug text-[#1d1d1f]">
        {VTON_FULL_SET_COMPOSITE_LABEL}
      </h4>

      <div className="min-h-0 flex-1">
        {uploadingFirst ? (
          <CompositeFullSetBusyPlaceholder label="上传并分割中…" />
        ) : !hasItems ? (
          <EcomRefUploadCard
            title={VTON_FULL_SET_COMPOSITE_LABEL}
            hideTitle
            items={[]}
            emptyHint={uploadHint}
            hideEmptyHint
            accept="image/*"
            busy={garmentBusy || disabled}
            contentMinHeightClass={POOL_CARD_CONTENT_MIN_H}
            onUploadFiles={(files) => {
              for (const file of files) void onUpload(file);
            }}
            onOpenFilePicker={() => inputRef.current?.click()}
            onOpenAssetPicker={onOpenAssets}
            inputRef={inputRef}
          />
        ) : (
          <div
            {...dropZoneProps}
            className={cn(
              POOL_CARD_SHELL_CLASS,
              "focus-visible:ring-2 focus-visible:ring-[#0071e3]/30",
              dragOver && "border-[#0071e3] bg-white ring-1 ring-[#0071e3]/30",
            )}
          >
            <PoolUploadToolbar
              busy={garmentBusy}
              disabled={disabled}
              onFocusZone={focusZone}
              onOpenAssets={onOpenAssets}
              onUploadClick={() => inputRef.current?.click()}
            />
            <div className={cn("relative space-y-2", POOL_CARD_CONTENT_MIN_H)}>
              {items.map((g, index) => (
                <VtonCompositeFullSetCard
                  key={g.id}
                  garment={g}
                  index={index}
                  busy={garmentBusy}
                  disabled={disabled}
                  onRemove={() => void onRemove([g.id])}
                  onPreview={
                    onPreviewGarment
                      ? (url, title) => onPreviewGarment({ ...g, ossUrl: url, label: title })
                      : undefined
                  }
                />
              ))}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                e.target.value = "";
                if (files) for (const file of Array.from(files)) void onUpload(file);
              }}
            />
          </div>
        )}
      </div>

      <p className={POOL_COLUMN_HINT_CLASS}>{uploadHint}</p>
      <PoolAddLookButton
        label={VTON_FULL_SET_COMPOSITE_LABEL}
        lookKind="full_set"
        lookCount={lookCount}
        disabled={disabled}
        fullSetMode="composite"
        onAddLook={onAddLook}
      />
    </div>
  );
}

/** 套装双槽列 · 固定两个图片上传格 */
function ManualFullSetColumn({
  items,
  lookCount,
  garmentBusy,
  disabled,
  onUpload,
  onOpenAssets,
  onRemove,
  onPreviewGarment,
  onAddLook,
}: {
  items: VtonGarmentItem[];
  lookCount?: number;
  garmentBusy?: boolean;
  disabled?: boolean;
  onUpload: (
    slot: Exclude<VtonFullSetUploadSlot, "composite">,
    file: File,
    garmentId?: string,
  ) => Promise<void>;
  onOpenAssets: (
    slot: Exclude<VtonFullSetUploadSlot, "composite">,
    garmentId?: string,
  ) => void;
  onRemove: (ids: string[]) => Promise<void>;
  onPreviewGarment?: (item: VtonGarmentItem) => void;
  onAddLook?: (kind: VtonLookKind, opts?: AddLookDraftOpts) => void | Promise<void>;
}) {
  const uploadHint = `${VTON_FULL_SET_MANUAL_HINT}。${IMAGE_UPLOAD_DROP_HINT}`;
  const hasIncompleteSet = items.some((g) => !isFullSetGarmentReady(g));
  const [draftNewSet, setDraftNewSet] = useState(false);
  const showDraftRow = items.length === 0 || (draftNewSet && !hasIncompleteSet);

  async function uploadDraftSlot(
    slot: Exclude<VtonFullSetUploadSlot, "composite">,
    file: File,
    garmentId?: string,
  ) {
    await onUpload(slot, file, garmentId);
    if (!garmentId) setDraftNewSet(false);
  }

  return (
    <div className={POOL_COLUMN_CLASS}>
      <h4 className="text-xs font-semibold leading-snug text-[#1d1d1f]">
        {VTON_FULL_SET_MANUAL_LABEL}
      </h4>

      <div className={cn("min-h-0 flex-1 space-y-2", POOL_CARD_CONTENT_MIN_H)}>
        {items.map((g, index) => (
          <VtonManualDualSlotRow
            key={g.id}
            garment={g}
            index={index}
            garmentId={g.id}
            busy={garmentBusy}
            disabled={disabled}
            onUpload={(slot, file, garmentId) => void onUpload(slot, file, garmentId)}
            onOpenAssets={(slot, garmentId) => onOpenAssets(slot, garmentId ?? g.id)}
            onRemove={() => void onRemove([g.id])}
            onPreview={
              onPreviewGarment
                ? (url, title) => onPreviewGarment({ ...g, ossUrl: url, label: title })
                : undefined
            }
          />
        ))}
        {showDraftRow ? (
          <VtonManualDualSlotRow
            busy={garmentBusy}
            disabled={disabled}
            onUpload={(slot, file, garmentId) => void uploadDraftSlot(slot, file, garmentId)}
            onOpenAssets={(slot, garmentId) => onOpenAssets(slot, garmentId)}
          />
        ) : null}
      </div>

      <p className={POOL_COLUMN_HINT_CLASS}>{uploadHint}</p>
      {items.length > 0 && !hasIncompleteSet && !draftNewSet ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[#c7c7cc] bg-white px-2 py-1.5 text-[10px] text-[#0071e3] transition hover:border-[#0071e3]/40 hover:bg-[#f0f6ff] disabled:opacity-50"
          disabled={disabled}
          onClick={() => setDraftNewSet(true)}
        >
          <Plus className="h-3 w-3 shrink-0" />
          上传新一套
        </button>
      ) : null}
      <PoolAddLookButton
        label={VTON_LOOK_KIND_LABELS.full_set}
        lookKind="full_set"
        lookCount={lookCount}
        disabled={disabled}
        fullSetMode="manual"
        onAddLook={onAddLook}
      />
    </div>
  );
}

const KIND_COLUMN_LOOK_BUTTONS: Record<
  Exclude<VtonGarmentKind, "full_set">,
  Array<{ kind: VtonLookKind; label: string }>
> = {
  top: [{ kind: "top_only", label: VTON_LOOK_KIND_LABELS.top_only }],
  bottom: [
    { kind: "two_piece", label: VTON_LOOK_KIND_LABELS.two_piece },
    { kind: "bottom_only", label: VTON_LOOK_KIND_LABELS.bottom_only },
  ],
  one_piece: [{ kind: "one_piece", label: VTON_LOOK_KIND_LABELS.one_piece }],
};

function GarmentKindSlot({
  kind,
  items,
  lookCount,
  disabled,
  onUpload,
  onOpenAssets,
  onRemove,
  onPreviewGarment,
  onAddLook,
}: {
  kind: Exclude<VtonGarmentKind, "full_set">;
  items: VtonGarmentItem[];
  lookCount?: number;
  disabled?: boolean;
  onUpload: (kind: VtonGarmentKind, file: File) => Promise<void>;
  onOpenAssets: (kind: VtonGarmentKind) => void;
  onRemove: (ids: string[]) => Promise<void>;
  onPreviewGarment?: (item: VtonGarmentItem) => void;
  onAddLook?: (kind: VtonLookKind, opts?: AddLookDraftOpts) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = VTON_GARMENT_KIND_LABELS[kind];
  const uploadHint = `${VTON_GARMENT_UPLOAD_HINTS[kind]}。${IMAGE_UPLOAD_DROP_HINT}`;

  return (
    <div className={cn(POOL_COLUMN_CLASS)}>
      <h4 className="text-xs font-semibold leading-snug text-[#1d1d1f]">{label}</h4>
      <div className="min-h-0 flex-1">
        <EcomRefUploadCard
          title={label}
          hideTitle
          items={items.map((g) => ({
            id: g.id,
            ossUrl: g.ossUrl,
            label: g.label ?? VTON_GARMENT_KIND_SHORT_LABELS[kind],
          }))}
          emptyHint={uploadHint}
          hideEmptyHint
          accept="image/*"
          busy={disabled}
          multiple
          contentMinHeightClass={POOL_CARD_CONTENT_MIN_H}
          onUploadFiles={(files) => {
            for (const file of files) void onUpload(kind, file);
          }}
          onOpenFilePicker={() => inputRef.current?.click()}
          onOpenAssetPicker={() => onOpenAssets(kind)}
          onRemove={(id) => void onRemove([id])}
          onPreviewItem={
            onPreviewGarment
              ? (item) => {
                  const garment = items.find((g) => g.id === item.id);
                  if (garment) onPreviewGarment(garment);
                }
              : undefined
          }
          removeLabel={`删除${label}`}
          inputRef={inputRef}
        />
      </div>
      <p className={POOL_COLUMN_HINT_CLASS}>{uploadHint}</p>
      <div className="space-y-1">
        {KIND_COLUMN_LOOK_BUTTONS[kind].map((entry) => (
          <PoolAddLookButton
            key={entry.kind}
            label={entry.label}
            lookKind={entry.kind}
            lookCount={lookCount}
            disabled={disabled}
            onAddLook={onAddLook}
          />
        ))}
      </div>
    </div>
  );
}
