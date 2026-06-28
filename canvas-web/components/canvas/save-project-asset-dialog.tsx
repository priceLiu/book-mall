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
import { notifyProjectAssetsChanged } from "@/lib/canvas/use-project-assets";
import { ProjectAssetMediaPreviewGrid } from "./project-asset-grid-card";

const VISIBILITY_KEY = "canvas.projectAsset.visibility";

const SAVE_ASSET_OPEN_EVENT = "canvas:open-save-project-asset";

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
  const [scope, setScope] = useState<"project" | "library">("project");
  const [visibility, setVisibility] = useState<AssetVisibility>("PRIVATE");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !draft) return;
    setName(draft.displayName);
    setKind(draft.kind);
    setScope(draft.sourceProjectId ? "project" : "library");
    try {
      const saved = localStorage.getItem(VISIBILITY_KEY) as AssetVisibility | null;
      if (saved === "PRIVATE" || saved === "TEAM_PUBLIC") setVisibility(saved);
    } catch {
      /* ignore */
    }
  }, [open, draft]);

  const onSubmit = useCallback(async () => {
    if (!draft || !base) return;
    setBusy(true);
    try {
      const vis = showTeamShare ? visibility : "PRIVATE";
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
      } catch {
        /* ignore */
      }
      notifyProjectAssetsChanged();
      onSaved?.();
      onClose();
      await alert({
        title: "已保存",
        message: "资产已写入项目资产库。",
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

  const dialog = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c1e] p-5 shadow-2xl"
        role="dialog"
        aria-modal
      >
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
          <legend className="mb-1">保存范围</legend>
          <label className="mr-4 inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={scope === "project"}
              onChange={() => setScope("project")}
            />
            本项目
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={scope === "library"}
              onChange={() => setScope("library")}
            />
            租户复用库
          </label>
        </fieldset>

        {showTeamShare ? (
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

        {previewItems.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/30 p-2">
            <div className="mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-md bg-black/40">
              <ProjectAssetMediaPreviewGrid items={previewItems} />
            </div>
            {previewItems.length >= 2 ? (
              <p className="mt-1.5 text-center text-[10px] text-white/40">
                组内 {previewItems.length} 项预览
              </p>
            ) : null}
          </div>
        ) : null}

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
