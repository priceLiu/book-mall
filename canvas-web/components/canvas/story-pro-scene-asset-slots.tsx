"use client";

import { useCallback, useRef, useState } from "react";
import { Eye, Trash2, Upload } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  deleteStoryProSceneAssetRef,
  saveStoryProSceneAssetRef,
  type StoryProSceneAssetRecord,
  uploadCanvasImage,
} from "@/lib/canvas-api";
import {
  latestSceneRefForKind,
  normalizeStoryProSceneKey,
  STORY_PRO_SCENE_REF_KIND_LABELS,
  STORY_PRO_SCENE_REF_KINDS,
  type StoryProSceneRefKind,
} from "@/lib/canvas/story-pro-scene-asset-catalog";
import { notifyStoryProSceneAssetsChanged } from "@/lib/canvas/use-story-pro-scene-assets";
import {
  STORY_ROW_SECTION_CLASS,
  STORY_ROW_SUBLABEL_CLASS,
} from "@/lib/canvas/story-column-sync";
import {
  activateImagePasteTarget,
  bindImageDragDropHandlers,
  deactivateImagePasteTarget,
  firstImageFileFromDataTransfer,
  useImagePasteRouter,
} from "@/lib/canvas/image-upload-handlers";
import { cn } from "@/lib/utils";

type RowLike = {
  key: string;
  name: string;
  runtime?: { ossUrl?: string; ephemeralUrl?: string; taskId?: string };
};

export function StoryProSceneAssetSlots({
  row,
  asset,
  projectId,
  onPreview,
}: {
  row: RowLike;
  asset: StoryProSceneAssetRecord | undefined;
  projectId: string | null | undefined;
  onPreview?: (url: string, title: string) => void;
}) {
  const base = useBookMallBaseUrl();
  const { doubleConfirm } = useDialogs();
  const fileRef = useRef<HTMLInputElement>(null);
  useImagePasteRouter();
  const [pendingKind, setPendingKind] = useState<StoryProSceneRefKind | null>(
    null,
  );
  const [activeKind, setActiveKind] = useState<StoryProSceneRefKind | null>(
    null,
  );
  const [dragOverKind, setDragOverKind] = useState<StoryProSceneRefKind | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const assetLocked = asset?.locked === true;
  const canUpload = !assetLocked && !busy && Boolean(base?.trim());

  const saveRef = async (
    kind: StoryProSceneRefKind,
    ossUrl: string,
    label: string,
    sourceTaskId?: string | null,
  ) => {
    if (!base?.trim()) return;
    setBusy(true);
    try {
      await saveStoryProSceneAssetRef(base, {
        sceneKey: normalizeStoryProSceneKey(row.key),
        displayName: row.name,
        projectId: projectId ?? null,
        kind,
        ossUrl,
        label,
        sourceTaskId: sourceTaskId ?? null,
      });
      notifyStoryProSceneAssetsChanged();
    } finally {
      setBusy(false);
    }
  };

  const uploadFileToKind = useCallback(
    async (kind: StoryProSceneRefKind, file: File) => {
      if (!canUpload) return;
      if (!file.type.startsWith("image/")) return;
      setActiveKind(kind);
      setBusy(true);
      try {
        const url = await uploadCanvasImage(base!, file);
        await saveStoryProSceneAssetRef(base!, {
          sceneKey: normalizeStoryProSceneKey(row.key),
          displayName: row.name,
          projectId: projectId ?? null,
          kind,
          ossUrl: url,
          label: `${row.name} · ${STORY_PRO_SCENE_REF_KIND_LABELS[kind]}`,
          sourceTaskId: null,
        });
        notifyStoryProSceneAssetsChanged();
      } finally {
        setBusy(false);
      }
    },
    [base, canUpload, projectId, row.key, row.name],
  );

  const pasteTargetId = (kind: StoryProSceneRefKind) =>
    `scene-asset:${normalizeStoryProSceneKey(row.key)}:${kind}`;

  const bindSlotPaste = (kind: StoryProSceneRefKind) => ({
    onMouseEnter: () => {
      if (!canUpload) return;
      setActiveKind(kind);
      activateImagePasteTarget(pasteTargetId(kind), (file) => {
        void uploadFileToKind(kind, file);
      });
    },
    onMouseLeave: () => {
      deactivateImagePasteTarget(pasteTargetId(kind));
      setActiveKind((prev) => (prev === kind ? null : prev));
      setDragOverKind((prev) => (prev === kind ? null : prev));
    },
  });

  const onUploadClick = (kind: StoryProSceneRefKind) => {
    if (!canUpload) return;
    setActiveKind(kind);
    activateImagePasteTarget(pasteTargetId(kind), (file) => {
      void uploadFileToKind(kind, file);
    });
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

  const importGenerated = async (kind: StoryProSceneRefKind) => {
    const url = row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
    if (!url || !/^https?:\/\//.test(url) || assetLocked || busy) return;
    await saveRef(
      kind,
      url,
      `${row.name} · ${STORY_PRO_SCENE_REF_KIND_LABELS[kind]}`,
      row.runtime?.taskId ?? null,
    );
  };

  const removeRef = async (refId: string, label: string) => {
    if (assetLocked || !base?.trim()) return;
    const ok = await doubleConfirm({
      first: {
        title: "删除场景参考图",
        message: `从场景资产库删除「${label}」？`,
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
      await deleteStoryProSceneAssetRef(base, refId);
      notifyStoryProSceneAssetsChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFileChange(e)}
      />
      <p className={`mb-1.5 ${STORY_ROW_SECTION_CLASS}`}>
        场景资产 · 三槽参考（点击 / 拖入 / 悬停后粘贴）
        {assetLocked ? <span className="ml-1">· 已锁定</span> : null}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {STORY_PRO_SCENE_REF_KINDS.map((kind) => {
          const ref = latestSceneRefForKind(asset, kind);
          const url = ref?.ossUrl;
          return (
            <div
              key={kind}
              className="flex flex-col gap-1 rounded border border-white/8 bg-black/25 p-1"
              {...bindSlotPaste(kind)}
            >
              <p className={`truncate text-center ${STORY_ROW_SUBLABEL_CLASS}`}>
                {STORY_PRO_SCENE_REF_KIND_LABELS[kind]}
              </p>
              <button
                type="button"
                className={cn(
                  "group/asset-slot nodrag relative aspect-video w-full overflow-hidden rounded bg-black/50 hover:ring-1 hover:ring-white/15",
                  dragOverKind === kind && "ring-1 ring-white/40",
                  activeKind === kind && canUpload && "ring-1 ring-white/20",
                )}
                onClick={() => {
                  if (url) {
                    onPreview?.(
                      url,
                      `${row.name} · ${STORY_PRO_SCENE_REF_KIND_LABELS[kind]}`,
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
                    <img src={url} alt="" className="size-full object-contain" />
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
              </button>
              <div className="flex justify-center gap-0.5">
                {!assetLocked ? (
                  <>
                    <button
                      type="button"
                      className="nodrag rounded p-0.5 text-white/45 hover:bg-white/5 hover:text-white/75"
                      onClick={() => onUploadClick(kind)}
                      disabled={busy}
                      title="上传"
                    >
                      <Upload className="size-3" />
                    </button>
                    {!ref && (row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl) ? (
                      <button
                        type="button"
                        className="nodrag text-[8px] text-white/45 hover:text-white/75"
                        onClick={() => void importGenerated(kind)}
                      >
                        入库
                      </button>
                    ) : null}
                    {ref ? (
                      <button
                        type="button"
                        className="nodrag rounded p-0.5 text-red-300/60"
                        onClick={() =>
                          void removeRef(
                            ref.id,
                            ref.label ?? STORY_PRO_SCENE_REF_KIND_LABELS[kind],
                          )
                        }
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
