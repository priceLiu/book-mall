"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { createProjectAsset } from "@/lib/canvas-api";
import type { ExportProjectAssetDraft } from "@/lib/canvas/project-asset-export";
import { collectProjectAssetDraftPreviewItems } from "@/lib/canvas/project-asset-media-url";
import {
  PROJECT_ASSET_KIND_LABELS,
  PROJECT_ASSET_TAB_KINDS,
} from "@/lib/canvas/project-asset-kind-map";
import type { AssetVisibility, ProjectAssetKind } from "@/lib/canvas/project-asset-types";
import { PROJECT_ASSET_SHARE_SCOPE_OPTIONS } from "@/lib/canvas/project-asset-share-scope";
import {
  formatProjectAssetSourceLabel,
  pickPromptFromAssetPayload,
  readProjectAssetProvenance,
} from "@/lib/canvas/project-asset-provenance";
import { isProjectAssetVideoUrl } from "@/lib/canvas/project-asset-preview";
import { notifyProjectAssetsChanged } from "@/lib/canvas/use-project-assets";
import { ProjectAssetMediaPreviewGrid } from "./project-asset-grid-card";

const VISIBILITY_KEY = "canvas.projectAsset.visibility";
const SCOPE_KEY = "canvas.projectAsset.scope";

const SAVE_ASSET_OPEN_EVENT = "canvas:open-save-project-asset";

function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SaveAssetPrimaryPreview({
  url,
  label,
  mimeType,
}: {
  url: string;
  label: string;
  mimeType?: string | null;
}) {
  const isVideo = isProjectAssetVideoUrl(url, mimeType);
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl bg-black/45 p-3">
      {isVideo ? (
        <video
          src={url}
          className="max-h-[min(52vh,520px)] max-w-full object-contain"
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- blob/OSS 预览
        <img
          src={url}
          alt={label}
          className="max-h-[min(52vh,520px)] max-w-full object-contain"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}

type SaveProjectAssetDialogProps = {
  open: boolean;
  onClose: () => void;
  draft: ExportProjectAssetDraft | null;
  showTeamShare?: boolean;
  onSaved?: () => void;
};

export function SaveProjectAssetDialog({
  open,
  onClose,
  draft,
  showTeamShare = false,
  onSaved,
}: SaveProjectAssetDialogProps) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProjectAssetKind>("STORYBOARD_IMAGE");
  const [scope, setScope] = useState<"project" | "user" | "library">("user");
  const [visibility, setVisibility] = useState<AssetVisibility>("PRIVATE");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !draft) return;
    setName(draft.displayName);
    setKind(draft.kind);
    try {
      const savedScope = localStorage.getItem(SCOPE_KEY);
      if (savedScope === "project" || savedScope === "user" || savedScope === "library") {
        setScope(savedScope);
      } else {
        setScope("user");
      }
      const saved = localStorage.getItem(VISIBILITY_KEY) as AssetVisibility | null;
      if (saved === "PRIVATE" || saved === "TEAM_PUBLIC") setVisibility(saved);
    } catch {
      setScope("user");
    }
  }, [open, draft]);

  const onSubmit = useCallback(async () => {
    if (!draft || !base) return;
    setBusy(true);
    try {
      let vis: AssetVisibility = "PRIVATE";
      if (scope === "library") {
        vis = "TEAM_PUBLIC";
      } else if (scope === "project" && showTeamShare) {
        vis = visibility;
      }
      await createProjectAsset(base, {
        kind,
        displayName: name.trim() || draft.displayName,
        description: draft.description,
        thumbnailUrl: draft.thumbnailUrl,
        visibility: vis,
        sourceProjectId: scope === "project" ? draft.sourceProjectId : null,
        sourceNodeId: draft.sourceNodeId,
        sourceEdition: draft.sourceEdition,
        payload: draft.payload,
        refs: draft.refs,
      });
      try {
        localStorage.setItem(VISIBILITY_KEY, vis);
        localStorage.setItem(SCOPE_KEY, scope);
      } catch {
        /* ignore */
      }
      notifyProjectAssetsChanged();
      onSaved?.();
      onClose();
      const scopeHint =
        scope === "project"
          ? "已标记来源为当前画布；本人所有画布的项目资产面板均可插入。"
          : scope === "library"
            ? "已写入租户复用库，团队成员可见。"
            : "本人所有画布均可插入使用。";
      await alert({
        title: "已保存",
        message: `资产已写入项目资产库。${scopeHint}`,
        variant: "success",
      });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [alert, base, draft, kind, name, onClose, onSaved, scope, showTeamShare, visibility]);

  if (!open || !draft) return null;

  const provenance = readProjectAssetProvenance(draft.payload);
  const promptPreview = pickPromptFromAssetPayload(draft.payload, draft.description);
  const sourceLabel = formatProjectAssetSourceLabel(
    provenance,
    draft.sourceEdition,
  );
  const savedAtPreview = provenance?.savedAtClient
    ? formatLocalDateTime(provenance.savedAtClient)
    : formatLocalDateTime(new Date().toISOString());

  const previewItems = collectProjectAssetDraftPreviewItems({
    kind: draft.kind,
    displayName: draft.displayName,
    thumbnailUrl: draft.thumbnailUrl,
    refs: draft.refs.map((r, i) => ({
      id: `draft-${i}`,
      slotKey: r.slotKey,
      label: r.label ?? "",
      mediaUrl: r.mediaUrl,
      mimeType: r.mimeType ?? null,
      meta: null,
      sortOrder: i,
    })),
    payload: draft.payload,
  }).map((item) => ({
    id: item.id,
    url: item.url,
    label: item.label,
    mimeType: item.mimeType,
  }));

  const primaryPreviewUrl =
    previewItems[0]?.url?.trim() ||
    draft.thumbnailUrl?.trim() ||
    draft.refs[0]?.mediaUrl?.trim() ||
    "";

  const dialog = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[min(92vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e] shadow-2xl md:flex-row"
        role="dialog"
        aria-modal
      >
        <aside className="flex min-h-[200px] shrink-0 flex-col border-b border-white/10 bg-[#141414] md:w-[min(42%,380px)] md:border-b-0 md:border-r">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-medium text-white/85">预览</p>
            <p className="mt-0.5 text-[10px] text-white/45">
              {PROJECT_ASSET_KIND_LABELS[kind]}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            {primaryPreviewUrl ? (
              <SaveAssetPrimaryPreview
                url={primaryPreviewUrl}
                label={name || draft.displayName}
                mimeType={previewItems[0]?.mimeType ?? draft.refs[0]?.mimeType}
              />
            ) : (
              <p className="flex flex-1 items-center justify-center text-sm text-white/40">
                暂无媒体预览
              </p>
            )}
            {previewItems.length >= 2 ? (
              <div className="mt-2 max-h-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30 p-1.5">
                <ProjectAssetMediaPreviewGrid items={previewItems} />
                <p className="mt-1 text-center text-[10px] text-white/40">
                  组内 {previewItems.length} 项
                </p>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-5">
        <h2 className="text-base font-semibold text-white">保存为资产</h2>
        <p className="mt-1 text-xs text-white/50">写入统一项目资产库，三版画布共用。</p>

        <label className="mt-4 block text-xs text-white/60">
          名称
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="mt-3 block text-xs text-white/60">
          类型
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            value={kind}
            onChange={(e) => setKind(e.target.value as ProjectAssetKind)}
          >
            {PROJECT_ASSET_TAB_KINDS.map((k) => (
              <option key={k} value={k}>
                {PROJECT_ASSET_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mt-3 text-xs text-white/60">
          <legend className="mb-1">共享范围（我的资产 · 非平台官方库）</legend>
          <div className="space-y-1.5">
            {PROJECT_ASSET_SHARE_SCOPE_OPTIONS.filter(
              (o) => o.id !== "team" || showTeamShare,
            ).map((opt) => {
              const value =
                opt.id === "team" ? ("library" as const) : opt.id;
              return (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-start gap-1.5"
                >
                  <input
                    type="radio"
                    className="mt-0.5"
                    checked={scope === value}
                    onChange={() => setScope(value)}
                  />
                  <span>
                    <span className="block text-white/85">{opt.title}</span>
                    <span className="text-[10px] text-white/40">{opt.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {showTeamShare && scope === "project" ? (
          <fieldset className="mt-3 text-xs text-white/60">
            <legend className="mb-1">可见性</legend>
            <label className="mr-4 inline-flex items-center gap-1.5">
              <input
                type="radio"
                checked={visibility === "PRIVATE"}
                onChange={() => setVisibility("PRIVATE")}
              />
              仅自己可见
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                checked={visibility === "TEAM_PUBLIC"}
                onChange={() => setVisibility("TEAM_PUBLIC")}
              />
              团队共享
            </label>
          </fieldset>
        ) : null}

        <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px]">
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-white/45">提示词</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap text-white/80">
              {promptPreview.trim() || "（无 · 可在节点 Dock 填写后再保存）"}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-white/45">来源</span>
            <span className="min-w-0 flex-1 text-white/80">{sourceLabel}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-white/45">保存时间</span>
            <span className="min-w-0 flex-1 text-white/80">
              {savedAtPreview}
              <span className="text-white/40"> · 确认后以服务器时间为准</span>
            </span>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            onClick={onClose}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            onClick={() => void onSubmit()}
            disabled={busy || !name.trim()}
          >
            {busy ? "保存中…" : "确认保存"}
          </button>
        </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}

let openSaveDialog:
  | ((
      draft: ExportProjectAssetDraft,
      options?: SaveProjectAssetDialogOpenOptions,
    ) => void)
  | null = null;

export function registerSaveProjectAssetDialog(
  opener: (
    draft: ExportProjectAssetDraft,
    options?: SaveProjectAssetDialogOpenOptions,
  ) => void,
): () => void {
  openSaveDialog = opener;
  return () => {
    if (openSaveDialog === opener) openSaveDialog = null;
  };
}

export type SaveProjectAssetDialogOpenOptions = {
  showTeamShare?: boolean;
};

export function openSaveProjectAssetDialog(
  draft: ExportProjectAssetDraft,
  options?: SaveProjectAssetDialogOpenOptions,
): void {
  if (openSaveDialog) {
    openSaveDialog(draft, options);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SAVE_ASSET_OPEN_EVENT, {
        detail: { draft, ...options },
      }),
    );
  }
}

export function SaveProjectAssetDialogHost({
  showTeamShare = false,
}: {
  showTeamShare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ExportProjectAssetDraft | null>(null);
  const [teamShare, setTeamShare] = useState(false);

  useEffect(() => {
    const openDraft = (
      detail: ExportProjectAssetDraft,
      options?: SaveProjectAssetDialogOpenOptions,
    ) => {
      setDraft(detail);
      setTeamShare(options?.showTeamShare === true);
      setOpen(true);
    };
    const onEvent = (e: Event) => {
      const raw = (e as CustomEvent<
        ExportProjectAssetDraft | { draft: ExportProjectAssetDraft; showTeamShare?: boolean }
      >).detail;
      if (!raw) return;
      if (typeof raw === "object" && raw !== null && "draft" in raw) {
        openDraft(raw.draft, { showTeamShare: raw.showTeamShare });
      } else {
        openDraft(raw as ExportProjectAssetDraft);
      }
    };
    window.addEventListener(SAVE_ASSET_OPEN_EVENT, onEvent);
    const unregister = registerSaveProjectAssetDialog(openDraft);
    return () => {
      window.removeEventListener(SAVE_ASSET_OPEN_EVENT, onEvent);
      unregister();
    };
  }, []);

  return (
    <SaveProjectAssetDialog
      open={open}
      draft={draft}
      showTeamShare={teamShare || showTeamShare}
      onClose={() => {
        setOpen(false);
        setDraft(null);
      }}
    />
  );
}
