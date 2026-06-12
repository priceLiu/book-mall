"use client";

import { useCallback, useRef, useState } from "react";
import { Eye, Lock, Trash2, Upload, Wand2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { StoryProAssetImportIcon } from "@/components/canvas/story-pro-asset-import-icon";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  autoFillStoryProCharacterSlotsFromThreeView,
  deleteStoryProCharacterAssetRef,
  parseStoryProOutfitFromFullBody,
  saveStoryProCharacterAssetRef,
  type StoryProCharacterAssetRecord,
  uploadCanvasImage,
} from "@/lib/canvas-api";
import {
  formatAutoFillSlotsMessage,
  type AutoFillSlotsResult,
} from "@/lib/canvas/story-pro-character-asset-auto-fill";
import {
  latestRefForKind,
  STORY_PRO_ASSET_REF_KIND_LABELS,
  STORY_PRO_ASSET_REF_KINDS,
  type StoryProAssetRefKind,
} from "@/lib/canvas/story-pro-character-asset-catalog";
import {
  STORY_ROW_BANNER_CLASS,
  STORY_ROW_SECTION_CLASS,
  STORY_ROW_SUBLABEL_CLASS,
} from "@/lib/canvas/story-column-sync";
import {
  PRO_ASSET_PANEL_CLASS,
  PRO_ROW_PRIMARY_BTN_CLASS,
  PRO_ROW_SECONDARY_BTN_CLASS,
  PRO_SLOT_IMPORT_BTN_CLASS,
  PRO_SLOT_TOOLBAR_BTN_CLASS,
} from "@/lib/canvas/story-pro-node-chrome";
import {
  StoryErrorLine,
  StoryHintLine,
  StoryStatusLine,
} from "@/components/canvas/story-status-line";
import {
  activateImagePasteTarget,
  bindImageDragDropHandlers,
  deactivateImagePasteTarget,
  firstImageFileFromDataTransfer,
  useImagePasteRouter,
} from "@/lib/canvas/image-upload-handlers";
import { normalizeStoryProCharacterKey } from "@/lib/canvas/story-pro-character-key";
import { notifyStoryProCharacterAssetsChanged } from "@/lib/canvas/use-story-pro-character-assets";
import { cn } from "@/lib/utils";
import {
  STYLE_LIBRARY_CARD_FOOTER,
  STYLE_LIBRARY_CARD_SHELL,
  STYLE_LIBRARY_CARD_TITLE,
  STYLE_LIBRARY_HOVER_PROMPT_OVERLAY,
  STYLE_LIBRARY_MEDIA_FRAME,
} from "@/lib/canvas/style-library-card-chrome";

type RowLike = {
  key: string;
  name: string;
  assetId?: string;
  lockedRefIds?: string[];
  runtime?: { ossUrl?: string; ephemeralUrl?: string; taskId?: string };
};

export function StoryProCharacterAssetSlots({
  row,
  asset,
  projectId,
  onRowPatch,
  onPreview,
}: {
  row: RowLike;
  asset: StoryProCharacterAssetRecord | undefined;
  projectId: string | null | undefined;
  onRowPatch: (patch: Partial<RowLike>) => void;
  onPreview?: (url: string, title: string) => void;
}) {
  const base = useBookMallBaseUrl();
  const { doubleConfirm } = useDialogs();
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useImagePasteRouter();
  const [pendingKind, setPendingKind] = useState<StoryProAssetRefKind | null>(
    null,
  );
  const [activeKind, setActiveKind] = useState<StoryProAssetRefKind | null>(
    null,
  );
  const [dragOverKind, setDragOverKind] = useState<StoryProAssetRefKind | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [statusHint, setStatusHint] = useState<{
    text: string;
    kind: "error" | "info";
  } | null>(null);

  const assetLocked = asset?.locked === true;
  const lockedSet = new Set(row.lockedRefIds ?? []);
  const canUpload = !assetLocked && !busy && Boolean(base?.trim());

  const saveThreeViewAndAutoFill = async (
    threeViewUrl: string,
    sourceTaskId?: string | null,
  ) => {
    if (!base?.trim()) return null;
    const saved = await saveStoryProCharacterAssetRef(base, {
      characterKey: normalizeStoryProCharacterKey(row.key),
      displayName: row.name,
      projectId: projectId ?? null,
      kind: "three_view",
      ossUrl: threeViewUrl,
      label: `${row.name} · 三视图`,
      sourceTaskId: sourceTaskId ?? null,
    });
    onRowPatch({ assetId: saved.id });

    let fill: AutoFillSlotsResult = { filled: [], skipped: [] };
    try {
      const res = await autoFillStoryProCharacterSlotsFromThreeView(base, {
        characterKey: row.key,
        displayName: row.name,
        projectId: projectId ?? null,
        threeViewUrl,
        sourceTaskId: sourceTaskId ?? null,
        onlyEmpty: true,
      });
      fill = { filled: res.filled, skipped: res.skipped, asset: res.asset };
      onRowPatch({ assetId: res.asset.id });
    } catch (e) {
      fill.error = e instanceof Error ? e.message : String(e);
    }
    notifyStoryProCharacterAssetsChanged();
    setStatusHint({ text: formatAutoFillSlotsMessage(fill), kind: fill.error ? "error" : "info" });
    return saved;
  };

  const saveRef = async (
    kind: StoryProAssetRefKind,
    ossUrl: string,
    label: string,
    sourceTaskId?: string | null,
  ) => {
    if (!base?.trim()) return;
    setBusy(true);
    setStatusHint(null);
    try {
      if (kind === "three_view") {
        await saveThreeViewAndAutoFill(ossUrl, sourceTaskId);
        return;
      }
      const saved = await saveStoryProCharacterAssetRef(base, {
        characterKey: normalizeStoryProCharacterKey(row.key),
        displayName: row.name,
        projectId: projectId ?? null,
        kind,
        ossUrl,
        label,
        sourceTaskId: sourceTaskId ?? null,
      });
      notifyStoryProCharacterAssetsChanged();
      onRowPatch({ assetId: saved.id });
    } finally {
      setBusy(false);
    }
  };

  const uploadFileToKind = useCallback(
    async (kind: StoryProAssetRefKind, file: File) => {
      if (!canUpload) return;
      if (!file.type.startsWith("image/")) return;
      setActiveKind(kind);
      setStatusHint(null);
      setBusy(true);
      try {
        const url = await uploadCanvasImage(base!, file);
        if (kind === "three_view") {
          await saveThreeViewAndAutoFill(url, null);
          return;
        }
        const saved = await saveStoryProCharacterAssetRef(base!, {
          characterKey: normalizeStoryProCharacterKey(row.key),
          displayName: row.name,
          projectId: projectId ?? null,
          kind,
          ossUrl: url,
          label: `${row.name} · ${STORY_PRO_ASSET_REF_KIND_LABELS[kind]}`,
          sourceTaskId: null,
        });
        notifyStoryProCharacterAssetsChanged();
        onRowPatch({ assetId: saved.id });
      } finally {
        setBusy(false);
      }
    },
    [base, canUpload, onRowPatch, projectId, row.key, row.name],
  );

  const pasteTargetId = (kind: StoryProAssetRefKind) =>
    `char-asset:${normalizeStoryProCharacterKey(row.key)}:${kind}`;

  const armPasteTarget = (kind: StoryProAssetRefKind) => {
    if (!canUpload) return;
    if (pasteLeaveTimerRef.current) {
      clearTimeout(pasteLeaveTimerRef.current);
      pasteLeaveTimerRef.current = null;
    }
    setActiveKind(kind);
    activateImagePasteTarget(pasteTargetId(kind), {
      onFile: (file) => {
        void uploadFileToKind(kind, file);
      },
    });
  };

  const bindSlotPaste = (kind: StoryProAssetRefKind) => ({
    onMouseEnter: () => armPasteTarget(kind),
    onMouseLeave: () => {
      const id = pasteTargetId(kind);
      pasteLeaveTimerRef.current = setTimeout(() => {
        deactivateImagePasteTarget(id);
        setActiveKind((prev) => (prev === kind ? null : prev));
        setDragOverKind((prev) => (prev === kind ? null : prev));
        pasteLeaveTimerRef.current = null;
      }, 1500);
    },
  });

  const onUploadClick = (kind: StoryProAssetRefKind) => {
    if (!canUpload) return;
    armPasteTarget(kind);
    setPendingKind(kind);
    fileRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const kind = pendingKind;
    const file = e.target.files?.[0];
    e.target.value = "";
    setPendingKind(null);
    if (!kind || !file) return;
    await uploadFileToKind(kind, file);
  };

  const importGeneratedThreeView = async () => {
    const url = row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
    if (!url || !/^https?:\/\//.test(url) || assetLocked || busy) return;
    setBusy(true);
    setStatusHint(null);
    try {
      await saveThreeViewAndAutoFill(url, row.runtime?.taskId ?? null);
    } finally {
      setBusy(false);
    }
  };

  const autoCropFromSavedThreeView = async () => {
    const tv = latestRefForKind(asset, "three_view");
    if (!tv?.ossUrl || assetLocked || busy) return;
    setBusy(true);
    setStatusHint(null);
    try {
      const res = await autoFillStoryProCharacterSlotsFromThreeView(base!, {
        threeViewUrl: tv.ossUrl,
        characterKey: row.key,
        displayName: row.name,
        projectId: projectId ?? null,
        sourceTaskId: tv.sourceTaskId,
        onlyEmpty: true,
      });
      notifyStoryProCharacterAssetsChanged();
      setStatusHint({
        text: formatAutoFillSlotsMessage({
          filled: res.filled,
          skipped: res.skipped,
        }),
        kind: "info",
      });
    } catch (e) {
      setStatusHint({
        text: formatAutoFillSlotsMessage({
          filled: [],
          skipped: [],
          error: e instanceof Error ? e.message : String(e),
        }),
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const parseOutfitFromFullBody = async () => {
    const fullBody = latestRefForKind(asset, "full_body");
    if (!fullBody?.ossUrl || assetLocked || busy || !base?.trim()) return;
    setBusy(true);
    setStatusHint(null);
    try {
      const res = await parseStoryProOutfitFromFullBody(base, {
        characterKey: row.key,
        displayName: row.name,
        projectId: projectId ?? null,
        fullBodyUrl: fullBody.ossUrl,
        sourceTaskId: fullBody.sourceTaskId ?? null,
      });
      notifyStoryProCharacterAssetsChanged();
      onRowPatch({ assetId: res.asset.id });
      setStatusHint({ text: `AI 分割已覆盖服装槽（${res.segments} 段）`, kind: "info" });
    } catch (e) {
      setStatusHint({
        text: e instanceof Error ? e.message : String(e),
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const generatedPreviewUrl =
    row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
  const hasGeneratedPreview = Boolean(
    generatedPreviewUrl && /^https?:\/\//.test(generatedPreviewUrl),
  );
  const threeViewRef = latestRefForKind(asset, "three_view");
  const hasEmptyAutoSlots =
    !latestRefForKind(asset, "face") ||
    !latestRefForKind(asset, "full_body") ||
    !latestRefForKind(asset, "outfit");

  const toggleRefLock = (refId: string) => {
    const next = new Set(row.lockedRefIds ?? []);
    if (next.has(refId)) next.delete(refId);
    else next.add(refId);
    onRowPatch({ lockedRefIds: Array.from(next) });
  };

  const removeRef = async (refId: string, label: string) => {
    if (assetLocked || !base?.trim()) return;
    const ok = await doubleConfirm({
      first: {
        title: "删除角色参考图",
        message: `从角色资产库删除「${label}」？`,
        confirmLabel: "继续",
        cancelLabel: "取消",
        danger: true,
      },
      second: {
        title: "不可恢复",
        message:
          "此操作不可恢复；将同时删除云端存储（OSS）中的该参考图记录。确定删除？",
        confirmLabel: "确定删除",
        cancelLabel: "取消",
        danger: true,
      },
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteStoryProCharacterAssetRef(base, refId);
      notifyStoryProCharacterAssetsChanged();
      const nextLocked = (row.lockedRefIds ?? []).filter((id) => id !== refId);
      if (nextLocked.length !== (row.lockedRefIds ?? []).length) {
        onRowPatch({ lockedRefIds: nextLocked });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={PRO_ASSET_PANEL_CLASS}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFileChange(e)}
      />
      <p className={`mb-1.5 ${STORY_ROW_SECTION_CLASS}`}>
        角色资产 · 四槽参考（持久入库，供分镜 @ 引用）
        {assetLocked ? <span className="ml-1">· 资产已锁定</span> : null}
        {busy ? <span className="ml-1">· 处理中…</span> : null}
      </p>
      {hasGeneratedPreview && !threeViewRef && !assetLocked ? (
        <div className={`mb-2 ${STORY_ROW_BANNER_CLASS}`}>
          <StoryHintLine message="上方预览已生成 · 入库后自动裁切脸/全身/服装" />
          <button
            type="button"
            className={PRO_ROW_SECONDARY_BTN_CLASS}
            onClick={() => void importGeneratedThreeView()}
            disabled={busy}
          >
            保存到三视图槽
          </button>
        </div>
      ) : null}
      {threeViewRef && hasEmptyAutoSlots && !assetLocked ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={PRO_ROW_SECONDARY_BTN_CLASS}
            onClick={() => void autoCropFromSavedThreeView()}
            disabled={busy}
          >
            从三视图自动裁切补全空槽
          </button>
        </div>
      ) : null}
      {statusHint ? (
        statusHint.kind === "error" ? (
          <StoryErrorLine message={statusHint.text} className="mb-2" />
        ) : (
          <StoryStatusLine message={statusHint.text} className="mb-2" />
        )
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STORY_PRO_ASSET_REF_KINDS.map((kind) => {
          const ref = latestRefForKind(asset, kind);
          const url = ref?.ossUrl;
          const isLocked = ref ? lockedSet.has(ref.id) : false;
          const kindLabel = STORY_PRO_ASSET_REF_KIND_LABELS[kind];
          return (
            <article
              key={kind}
              className={cn(
                "group/asset-slot nodrag",
                STYLE_LIBRARY_CARD_SHELL,
                dragOverKind === kind && "ring-1 ring-white/30",
              )}
              {...bindSlotPaste(kind)}
            >
              <button
                type="button"
                className={cn(
                  "nodrag relative w-full overflow-hidden",
                  STYLE_LIBRARY_MEDIA_FRAME,
                  "h-[120px]",
                  kind === "outfit" && url
                    ? "bg-white"
                    : url
                      ? "bg-black/50"
                      : "bg-black/40",
                  activeKind === kind && canUpload && "ring-1 ring-inset ring-white/20",
                )}
                onClick={() => {
                  if (url) {
                    onPreview?.(
                      url,
                      `${row.name} · ${STORY_PRO_ASSET_REF_KIND_LABELS[kind]}`,
                    );
                    return;
                  }
                  if (canUpload) onUploadClick(kind);
                }}
                title={canUpload ? "点击 / 拖入 / 悬停后粘贴" : undefined}
                {...bindImageDragDropHandlers(
                  (file) => void uploadFileToKind(kind, file),
                  { disabled: !canUpload },
                )}
                onDragEnter={() => setDragOverKind(kind)}
                onDragLeave={() =>
                  setDragOverKind((prev) => (prev === kind ? null : prev))
                }
                onDrop={(e) => {
                  if (!canUpload) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const file = firstImageFileFromDataTransfer(e.dataTransfer);
                  if (file) void uploadFileToKind(kind, file);
                  setDragOverKind(null);
                }}
              >
                {url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={kindLabel}
                      className="absolute inset-0 size-full object-cover"
                    />
                    {onPreview ? (
                      <span
                        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover/asset-slot:opacity-100"
                        aria-hidden
                      >
                        <Eye className="size-4 text-white/90" />
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-0.5 px-1 text-center text-[8px] leading-tight text-white/25">
                    <span>空</span>
                    {canUpload ? (
                      <span className="text-[7px] text-white/20">拖入 / 粘贴</span>
                    ) : null}
                  </span>
                )}
                {ref?.label ? (
                  <div className={STYLE_LIBRARY_HOVER_PROMPT_OVERLAY} aria-hidden>
                    {ref.label}
                  </div>
                ) : null}
              </button>
              <div className={cn(STYLE_LIBRARY_CARD_FOOTER, "px-2 py-2")}>
                <p className={cn(STYLE_LIBRARY_CARD_TITLE, "text-[12px]")}>
                  {kindLabel}
                </p>
                <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                {kind === "full_body" && url && !assetLocked ? (
                  <button
                    type="button"
                    title="AI 分割服装并覆盖服装槽"
                    className="nodrag rounded p-0.5 text-amber-300/75 hover:bg-white/5 hover:text-amber-200 disabled:opacity-40"
                    onClick={() => void parseOutfitFromFullBody()}
                    disabled={busy}
                  >
                    <Wand2 className="size-3" />
                  </button>
                ) : null}
                {!assetLocked ? (
                  <button
                    type="button"
                    title="上传替换"
                    className={PRO_SLOT_TOOLBAR_BTN_CLASS}
                    onClick={() => onUploadClick(kind)}
                    disabled={busy}
                  >
                    <Upload className="size-3" />
                  </button>
                ) : null}
                {kind === "three_view" && !assetLocked && !ref ? (
                  <button
                    type="button"
                    title="把上方预览的三视图保存到资产库，并自动裁切其余三槽"
                    aria-label="入库到项目资产"
                    className={PRO_SLOT_IMPORT_BTN_CLASS}
                    onClick={() => void importGeneratedThreeView()}
                    disabled={busy || !hasGeneratedPreview}
                  >
                    <StoryProAssetImportIcon />
                  </button>
                ) : null}
                {ref ? (
                  <>
                    <button
                      type="button"
                      title={isLocked ? "已锁定用于 @ 引用" : "锁定用于 @ 引用"}
                      className={`nodrag rounded p-0.5 ${
                        isLocked
                          ? "text-white/75"
                          : "text-white/40 hover:text-white/65"
                      }`}
                      onClick={() => toggleRefLock(ref.id)}
                    >
                      <Lock className="size-3" />
                    </button>
                    {!assetLocked ? (
                      <button
                        type="button"
                        title="删除"
                        className="nodrag rounded p-0.5 text-red-300/60 hover:text-red-200"
                        onClick={() =>
                          void removeRef(
                            ref.id,
                            ref.label ?? STORY_PRO_ASSET_REF_KIND_LABELS[kind],
                          )
                        }
                        disabled={busy}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                  </>
                ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-1.5 text-[9px] leading-relaxed text-amber-300/70">
        三视图入库时会从正面列自动裁切脸 / 全身 / 服装（仅填空槽）；全身槽底部魔杖可 AI
        分割并覆盖服装槽。各槽支持点击、拖入、悬停后 Ctrl+V 粘贴。
      </p>
    </div>
  );
}
