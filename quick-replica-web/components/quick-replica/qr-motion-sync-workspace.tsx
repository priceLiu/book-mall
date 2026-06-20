"use client";

import {
  MOTION_SYNC_MODELS,
  type QrWorkspaceDraft,
} from "@/lib/qr-template-types";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
  onUploadImage?: (file: File) => Promise<void>;
  onUploadVideo?: (file: File) => Promise<void>;
};

/** 运动同步表单字段（产生按钮由 QrWorkspacePanel 统一处理） */
export function QrMotionSyncForm({
  draft,
  onDraftChange,
  busy,
  onUploadImage,
  onUploadVideo,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-[var(--qr-text-muted)]">模型</label>
        <select
          className="qr-input"
          value={draft.modelKey}
          onChange={(e) => onDraftChange({ ...draft, modelKey: e.target.value })}
        >
          {MOTION_SYNC_MODELS.map((m) => (
            <option key={m.modelKey} value={m.modelKey}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">目标图</label>
        <input
          type="file"
          accept="image/*"
          className="block w-full text-xs text-zinc-400"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !onUploadImage) return;
            await onUploadImage(file);
          }}
        />
        {draft.targetImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={draft.targetImageUrl}
            alt="target"
            className="mt-2 max-h-40 rounded-lg border border-white/10"
          />
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">参考视频</label>
        <input
          type="file"
          accept="video/*"
          className="block w-full text-xs text-zinc-400"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !onUploadVideo) return;
            await onUploadVideo(file);
          }}
        />
        {draft.referenceVideoUrl ? (
          <p className="mt-2 break-all text-xs text-zinc-400">{draft.referenceVideoUrl}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--qr-text-muted)]">提示词（场景与镜头）</label>
        <textarea
          className="qr-input min-h-[100px]"
          value={draft.prompt}
          onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
        />
      </div>
    </div>
  );
}

/** @deprecated 使用 QrWorkspacePanel + QrMotionSyncForm */
export function QrMotionSyncWorkspace({
  draft,
  onDraftChange,
}: {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  onCreated?: unknown;
}) {
  return <QrMotionSyncForm draft={draft} onDraftChange={onDraftChange} />;
}
