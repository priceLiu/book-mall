"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  CANVAS_MODAL_BACKDROP_CLASS,
  useModalBodyScrollLock,
} from "@/lib/canvas/use-modal-portal-effects";
import { CANVAS_DIALOG_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";
import {
  defaultLibtvCloneVoiceDisplayName,
  LIBTV_VOICE_CLONE_PROMPT_MAX,
} from "@/lib/canvas/libtv-audio-voice-clone-defaults";

export type LibtvAudioVoiceCloneDialogSubmit = {
  title: string;
  prompt: string;
};

type Props = {
  open: boolean;
  busy?: boolean;
  sourceLabel: string;
  defaultPrompt?: string;
  onClose: () => void;
  onSubmit: (values: LibtvAudioVoiceCloneDialogSubmit) => void | Promise<void>;
};

export function LibtvAudioVoiceCloneDialog({
  open,
  busy,
  sourceLabel,
  defaultPrompt = "",
  onClose,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useModalBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultLibtvCloneVoiceDisplayName(sourceLabel));
    setPrompt(defaultPrompt.trim());
    setFormError(null);
  }, [open, sourceLabel, defaultPrompt]);

  if (!open || typeof document === "undefined") return null;

  const onConfirm = () => {
    const t = title.trim();
    const p = prompt.trim();
    if (!t) {
      setFormError("请填写音色名称");
      return;
    }
    if (!p) {
      setFormError("请填写试听台词（用于复刻与首段合成）");
      return;
    }
    if (p.length > LIBTV_VOICE_CLONE_PROMPT_MAX) {
      setFormError(`台词最多 ${LIBTV_VOICE_CLONE_PROMPT_MAX} 字`);
      return;
    }
    setFormError(null);
    void onSubmit({ title: t, prompt: p });
  };

  return createPortal(
    <div
      className={`${CANVAS_MODAL_BACKDROP_CLASS} flex items-center justify-center p-4`}
      style={{ zIndex: CANVAS_DIALOG_MODAL_Z }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-labelledby="libtv-voice-clone-title"
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="libtv-voice-clone-title"
          className="text-[17px] font-medium text-white/95"
        >
          音色克隆
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
          以当前节点音频为参考，克隆 MiniMax 音色并生成右侧新音频节点。音色名称会出现在「我的克隆音色」列表中。
        </p>

        <label className="mt-4 block text-[12px] text-white/55">
          音色名称
          <input
            type="text"
            value={title}
            disabled={busy}
            maxLength={40}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[14px] text-white outline-none ring-violet-500/40 focus:border-violet-500/50 focus:ring-2 disabled:opacity-50"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="mt-3 block text-[12px] text-white/55">
          试听台词
          <textarea
            value={prompt}
            disabled={busy}
            rows={4}
            maxLength={LIBTV_VOICE_CLONE_PROMPT_MAX}
            placeholder="填写与参考音相近或希望首段合成的口播稿…"
            className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[14px] text-white outline-none ring-violet-500/40 focus:border-violet-500/50 focus:ring-2 disabled:opacity-50"
            onChange={(e) => {
              setPrompt(e.target.value);
              setFormError(null);
            }}
          />
        </label>
        {formError ? (
          <p className="mt-2 text-[12px] text-red-400/90">{formError}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg px-4 py-2 text-[14px] text-white/70 hover:bg-white/8 disabled:opacity-40"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            className="flex min-w-[5.5rem] items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            onClick={onConfirm}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                克隆中…
              </>
            ) : (
              "生成"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
