"use client";

import { useState } from "react";

import { importPoseToLibraryAdmin } from "@/lib/ecom-pose-library-admin-api";

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

export function EcomPoseLibraryImportDialog({
  open,
  imageUrl,
  prompt,
  sourceModule = "e-commerce-toolkit",
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-xl">
        <h4 className="mb-3 text-sm font-semibold text-[#1d1d1f]">保存到姿势库</h4>
        <div className="mb-3 overflow-hidden rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="mx-auto max-h-48 object-contain" />
        </div>
        <fieldset className="mb-3 space-y-2 text-sm">
          <legend className="mb-1 text-xs font-medium text-[#86868b]">
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
            <span className="font-medium text-[#424245]">姿势提示词</span>
            <textarea
              className="min-h-[88px] w-full rounded-lg border border-[#d2d2d7] px-2 py-1"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
          </label>
        ) : null}
        <label className="mb-3 block space-y-1 text-xs">
          <span className="font-medium text-[#424245]">分类</span>
          <select
            className="w-full rounded-lg border border-[#d2d2d7] px-2 py-1"
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
          <button
            type="button"
            className="rounded-lg border border-[#d2d2d7] px-3 py-1.5 text-sm"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#0071e3] px-3 py-1.5 text-sm text-white disabled:opacity-50"
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
