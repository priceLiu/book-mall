"use client";

import { useState } from "react";

const POSE_CATEGORIES = ["A", "B", "C", "D", "E", "H", "I", "J", "K", "L", "M"];

type Props = {
  open: boolean;
  imageUrl: string;
  prompt?: string | null;
  sourceModule?: string;
  sourceAssetId?: string;
  onClose: () => void;
  onSaved?: () => void;
};

export function AdminPoseLibraryImportDialog({
  open,
  imageUrl,
  prompt,
  sourceModule = "tool-libraries",
  sourceAssetId,
  onClose,
  onSaved,
}: Props) {
  const [savePrompt, setSavePrompt] = useState(Boolean(prompt?.trim()));
  const [promptText, setPromptText] = useState(prompt ?? "");
  const [category, setCategory] = useState("A");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ecom/pose-library/import-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          savePrompt,
          prompt: savePrompt ? promptText : undefined,
          category,
          sourceModule,
          sourceAssetId,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        existingTitle?: string;
        entry?: { title: string };
      };
      if (res.status === 409) {
        setError(`该图片已在姿势库中：「${data.existingTitle ?? "未知"}」`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "入库失败");
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "入库失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow">
        <h4 className="mb-3 font-semibold">保存到姿势库</h4>
        <div className="mb-3 overflow-hidden rounded-lg border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="mx-auto max-h-48 object-contain" />
        </div>
        <fieldset className="mb-3 space-y-2 text-sm">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">
            是否同时存入姿势提示词？
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={savePrompt}
              onChange={() => setSavePrompt(true)}
            />
            是 — 保存图片与提示词
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!savePrompt}
              onChange={() => setSavePrompt(false)}
            />
            否 — 仅保存图片
          </label>
        </fieldset>
        {savePrompt ? (
          <label className="mb-3 block space-y-1 text-xs">
            <span className="font-medium">姿势提示词</span>
            <textarea
              className="min-h-[88px] w-full rounded border px-2 py-1"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
          </label>
        ) : null}
        <label className="mb-3 block space-y-1 text-xs">
          <span className="font-medium">分类</span>
          <select
            className="w-full rounded border px-2 py-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {POSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="rounded bg-[#0969da] px-3 py-1 text-sm text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "保存中…" : "确认入库"}
          </button>
        </div>
      </div>
    </div>
  );
}
