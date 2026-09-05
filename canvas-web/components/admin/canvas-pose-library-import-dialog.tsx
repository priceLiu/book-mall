"use client";

import { useState } from "react";

import { importPoseToLibraryAdmin } from "@/lib/canvas/pose-library-admin-api";

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

export function CanvasPoseLibraryImportDialog({
  open,
  imageUrl,
  prompt,
  sourceModule = "canvas-web",
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
      const result = await importPoseToLibraryAdmin({
        imageUrl,
        savePrompt,
        prompt: savePrompt ? promptText : undefined,
        category,
        sourceModule,
        sourceAssetId,
      });
      if (!result.ok) {
        if (result.status === 409) {
          setError(`该图片已在姿势库中：「${result.existingTitle ?? "未知"}」`);
          return;
        }
        throw new Error(result.error);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "入库失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-2xl">
        <h4 className="mb-3 text-sm font-semibold text-white">保存到姿势库</h4>
        <div className="mb-3 overflow-hidden rounded-lg border border-white/10 bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="mx-auto max-h-48 object-contain" />
        </div>
        <fieldset className="mb-3 space-y-2 text-sm text-white/85">
          <legend className="mb-1 text-xs font-medium text-white/50">
            是否同时存入姿势提示词？
          </legend>
          <label className="flex items-center gap-2">
            <input type="radio" checked={savePrompt} onChange={() => setSavePrompt(true)} />
            是 — 保存图片与提示词
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!savePrompt} onChange={() => setSavePrompt(false)} />
            否 — 仅保存图片
          </label>
        </fieldset>
        {savePrompt ? (
          <label className="mb-3 block space-y-1 text-xs">
            <span className="font-medium text-white/70">姿势提示词</span>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-white"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
          </label>
        ) : null}
        <label className="mb-3 block space-y-1 text-xs">
          <span className="font-medium text-white/70">分类</span>
          <select
            className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-white"
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
        {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-md bg-[var(--canvas-accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
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
