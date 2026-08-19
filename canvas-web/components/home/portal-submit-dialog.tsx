"use client";

import { useEffect, useState } from "react";

import type { CanvasPortalPublishKind } from "@/lib/canvas-api";

const USER_REVIEW_OPTIONS: {
  kind: CanvasPortalPublishKind;
  label: string;
  hint: string;
}[] = [
  {
    kind: "PUBLIC_TEMPLATE",
    label: "社区模板",
    hint: "立即公开到首页「模板」，他人可复制到你的画布",
  },
  { kind: "CASE", label: "案例墙", hint: "提交后由管理员审核，通过后展示在首页「案例」" },
  {
    kind: "FEATURED",
    label: "精选工作流",
    hint: "提交后由管理员审核，通过后展示在首页「精选」",
  },
];

const ADMIN_OPTIONS: {
  kind: CanvasPortalPublishKind;
  label: string;
  hint: string;
}[] = [
  { kind: "CASE", label: "案例墙", hint: "立即发布到首页「案例」" },
  { kind: "FEATURED", label: "精选工作流", hint: "立即发布到首页「精选」" },
  { kind: "PUBLIC_TEMPLATE", label: "社区模板", hint: "立即公开，他人可复制" },
  { kind: "TEMPLATE", label: "私有模板", hint: "仅自己可用的工作流模板" },
];

type Props = {
  open: boolean;
  projectName: string;
  isAdmin?: boolean;
  /** 画布内分享 vs 项目列表投稿 */
  context?: "canvas" | "projects";
  onClose: () => void;
  onSubmit: (kind: CanvasPortalPublishKind, note: string) => Promise<void>;
};

export function PortalSubmitDialog({
  open,
  projectName,
  isAdmin = false,
  context = "projects",
  onClose,
  onSubmit,
}: Props) {
  const options = isAdmin ? ADMIN_OPTIONS : USER_REVIEW_OPTIONS;
  const [kind, setKind] = useState<CanvasPortalPublishKind>(options[0].kind);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const dialogTitle = isAdmin
    ? context === "canvas"
      ? "分享 / 发布"
      : "发布到首页"
    : context === "canvas"
      ? "分享作品"
      : "提交作品审核";

  useEffect(() => {
    if (!open) return;
    setKind(isAdmin ? "CASE" : "PUBLIC_TEMPLATE");
    setNote("");
  }, [open, isAdmin]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label={dialogTitle}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--canvas-surface)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white">{dialogTitle}</h3>
        <p className="mt-1 text-sm text-[var(--canvas-muted)]">
          项目：{projectName}
        </p>
        {context === "canvas" ? (
          <p className="mt-2 text-xs text-[var(--canvas-muted)]">
            {isAdmin
              ? "管理员可直接发布到首页「精选」「案例」或「模板」；发布前已自动保存当前画布。"
              : "社区模板即时公开；精选与案例需管理员审核通过后展示。"}
          </p>
        ) : null}

        <ul className="mt-4 space-y-2">
          {options.map((opt) => (
            <li key={opt.kind}>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3 hover:border-[var(--canvas-accent)]/40"
              >
                <input
                  type="radio"
                  name="portal-kind"
                  checked={kind === opt.kind}
                  onChange={() => setKind(opt.kind)}
                  className="mt-1"
                />
                <span>
                  <span className="text-sm font-medium text-white">{opt.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--canvas-muted)]">
                    {opt.hint}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <label className="mt-4 block text-xs text-[var(--canvas-muted)]">
          补充说明（可选）
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm text-[var(--canvas-muted)] hover:text-white"
            onClick={onClose}
            disabled={busy}
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-[var(--canvas-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              setBusy(true);
              void onSubmit(kind, note.trim())
                .then(() => onClose())
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "提交中…" : isAdmin ? "立即发布" : "提交审核"}
          </button>
        </div>
      </div>
    </div>
  );
}
