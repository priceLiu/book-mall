"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { ModalPortal } from "@/components/common/modal-portal";
import type { ProjectCharacter } from "@/lib/projects/types";

type CharacterDraft = {
  name: string;
  role: string;
  description: string;
};

type Props = {
  open: boolean;
  character: ProjectCharacter | null;
  onClose: () => void;
  onSave: (patch: CharacterDraft) => Promise<void>;
};

export function CharacterEditModal({ open, character, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<CharacterDraft>({
    name: "",
    role: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && character) {
      setDraft({
        name: character.name,
        role: character.role,
        description: character.description,
      });
      setError(null);
      setSavedHint(false);
      setSaving(false);
    }
  }, [open, character]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, saving]);

  if (!open || !character) return null;

  const canSave = draft.name.trim().length > 0;

  const handleSave = async () => {
    if (saving || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: draft.name.trim(),
        role: draft.role.trim(),
        description: draft.description.trim(),
      });
      setSavedHint(true);
      setTimeout(() => {
        setSavedHint(false);
        onClose();
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-[var(--story-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-medium text-white">编辑角色信息</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-[var(--story-muted)] transition hover:text-white disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="block text-xs text-[var(--story-muted)]">
              名字 <span className="text-red-300/80">*</span>
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              disabled={saving}
              maxLength={40}
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--story-accent)] disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--story-muted)]">
              身份 / 角色定位
            </label>
            <input
              type="text"
              value={draft.role}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
              disabled={saving}
              maxLength={40}
              placeholder="例：主角 / 反派 / 核心冲突配角"
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-[var(--story-accent)] disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--story-muted)]">
              角色描述
              <span className="ml-2 text-[10px] text-white/30">
                这部分供 AI 出分镜文本时参考
              </span>
            </label>
            <textarea
              value={draft.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
              disabled={saving}
              rows={6}
              className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-white outline-none focus:ring-1 focus:ring-[var(--story-accent)] disabled:opacity-60"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}
          {savedHint ? (
            <p className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
              <Check className="size-3" />
              已保存
            </p>
          ) : null}

          <p className="text-[11px] text-white/40">
            提示：编辑后的描述不会自动重画头像；如需，请关闭后点角色头像 ➜「保存并重新生成头像」。
          </p>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/5 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !canSave}
              className="twenty-btn !rounded-lg disabled:opacity-60"
            >
              {saving ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-2 size-3 animate-spin" />
                  保存中…
                </span>
              ) : (
                "保存"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
