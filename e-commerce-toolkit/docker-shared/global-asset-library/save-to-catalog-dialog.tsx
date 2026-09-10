"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GALD_CLOSE_BTN_CLASS, globalAssetTheme } from "./theme";
import type {
  GlobalAssetCatalogKind,
  GlobalAssetCatalogScope,
  GlobalAssetLibraryApiClient,
  GlobalAssetLibraryVariant,
  GlobalAssetSourceImage,
} from "./types";

const POSE_CATEGORIES = ["A", "B", "C", "D", "E", "H", "I", "J", "K", "L", "M"];

const SAVE_CATALOG_OPTIONS: Array<{ id: GlobalAssetCatalogKind; label: string }> = [
  { id: "pose", label: "姿势库" },
  { id: "avatar", label: "模特头像库" },
  { id: "garment", label: "服装库" },
  { id: "full-body", label: "全身模特" },
];

function buildDefaultCatalogName(catalogKind: GlobalAssetCatalogKind): string {
  const label = SAVE_CATALOG_OPTIONS.find((o) => o.id === catalogKind)?.label ?? "素材";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${label}-${stamp}`;
}

type Props = {
  open: boolean;
  variant: GlobalAssetLibraryVariant;
  api: GlobalAssetLibraryApiClient;
  sourceImage: GlobalAssetSourceImage;
  defaultCatalog?: GlobalAssetCatalogKind;
  onClose: () => void;
  onSaved?: () => void;
};

export function SaveToCatalogDialog({
  open,
  variant,
  api,
  sourceImage,
  defaultCatalog = "pose",
  onClose,
  onSaved,
}: Props) {
  const theme = globalAssetTheme(variant);
  const [catalogKind, setCatalogKind] = useState<GlobalAssetCatalogKind>(defaultCatalog);
  const [scope, setScope] = useState<GlobalAssetCatalogScope>("user");
  const [isAdmin, setIsAdmin] = useState(false);
  const [savePrompt, setSavePrompt] = useState(Boolean(sourceImage.prompt?.trim()));
  const [promptText, setPromptText] = useState(sourceImage.prompt ?? "");
  const [category, setCategory] = useState("A");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const nameTouchedRef = useRef(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    savedRef.current = false;
    nameTouchedRef.current = false;
    setCatalogKind(defaultCatalog);
    setScope("user");
    setError(null);
    setDiscardOpen(false);
    setSavePrompt(Boolean(sourceImage.prompt?.trim()));
    setPromptText(sourceImage.prompt ?? "");
    setName(buildDefaultCatalogName(defaultCatalog));
    void api.isPlatformAdmin?.().then(setIsAdmin);
  }, [open, defaultCatalog, api, sourceImage.prompt]);

  useEffect(() => {
    if (!open || nameTouchedRef.current) return;
    setName(buildDefaultCatalogName(catalogKind));
  }, [catalogKind, open]);

  if (!open || typeof document === "undefined") return null;

  function requestClose() {
    if (busy) return;
    if (savedRef.current) {
      onClose();
      return;
    }
    setDiscardOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.importToCatalog({
        catalogKind,
        imageUrl: sourceImage.url,
        scope: isAdmin && scope === "platform" ? "platform" : "user",
        name: name.trim() || buildDefaultCatalogName(catalogKind),
        gender,
        savePrompt: catalogKind === "pose" ? savePrompt : undefined,
        prompt: catalogKind === "pose" && savePrompt ? promptText : undefined,
        category: catalogKind === "pose" ? category : undefined,
        sourceModule: sourceImage.sourceModule,
        sourceAssetId: sourceImage.sourceAssetId,
      });
      savedRef.current = true;
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "入库失败");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[320] flex items-center justify-center p-4 ${theme.overlay}`}
      onClick={requestClose}
    >
      <div
        className={`relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-4 pt-10 shadow-xl ${theme.shell}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`absolute right-3 top-3 ${GALD_CLOSE_BTN_CLASS} ${theme.btnSecondary}`}
          aria-label="关闭"
          onClick={requestClose}
        >
          <X className="h-4 w-4" />
        </button>

        <h4 className={`mb-3 text-sm font-semibold ${theme.textPrimary}`}>保存到库</h4>
        <div className={`mb-3 overflow-hidden rounded-lg border ${theme.border} bg-[#f5f5f7]`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sourceImage.url} alt="" className="mx-auto max-h-48 object-contain" />
        </div>

        <div className={`mb-3 space-y-2 text-xs ${theme.textPrimary}`}>
          <span className="font-medium">目标库</span>
          <div className="grid grid-cols-2 gap-2">
            {SAVE_CATALOG_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                  catalogKind === opt.id ? theme.navActive : theme.navIdle
                }`}
                onClick={() => setCatalogKind(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isAdmin ? (
          <fieldset className={`mb-3 space-y-2 text-xs ${theme.textPrimary}`}>
            <legend className={`mb-1 font-medium ${theme.textSecondary}`}>可见范围</legend>
            <label className="flex items-center gap-2">
              <input type="radio" checked={scope === "user"} onChange={() => setScope("user")} />
              个人 · 全站可用
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={scope === "platform"} onChange={() => setScope("platform")} />
              全平台
            </label>
          </fieldset>
        ) : null}

        <label className={`mb-3 block space-y-1 text-xs ${theme.textPrimary}`}>
          <span className="font-medium">名称</span>
          <input
            className={`w-full rounded-lg border px-2 py-1.5 ${theme.border} bg-transparent`}
            value={name}
            placeholder={buildDefaultCatalogName(catalogKind)}
            onChange={(e) => {
              nameTouchedRef.current = true;
              setName(e.target.value);
            }}
          />
        </label>

        <div className={`mb-3 space-y-2 text-xs ${theme.textPrimary}`}>
          <span className="font-medium">性别</span>
          <div className="flex gap-2">
            {(["female", "male"] as const).map((g) => (
              <button
                key={g}
                type="button"
                className={`flex-1 rounded-lg px-3 py-2 transition-colors ${
                  gender === g ? theme.navActive : theme.navIdle
                }`}
                onClick={() => setGender(g)}
              >
                {g === "female" ? "女" : "男"}
              </button>
            ))}
          </div>
        </div>

        {catalogKind === "pose" ? (
          <>
            <fieldset className={`mb-3 space-y-2 text-xs ${theme.textPrimary}`}>
              <legend className={`mb-1 font-medium ${theme.textSecondary}`}>
                是否同时存入姿势提示词？
              </legend>
              <label className="flex items-center gap-2">
                <input type="radio" checked={savePrompt} onChange={() => setSavePrompt(true)} />
                是
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!savePrompt} onChange={() => setSavePrompt(false)} />
                否 — 仅保存图片
              </label>
            </fieldset>
            {savePrompt ? (
              <textarea
                className={`mb-3 min-h-[72px] w-full rounded-lg border px-2 py-1 text-xs ${theme.border} bg-transparent`}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
              />
            ) : null}
            <label className={`mb-3 block space-y-1 text-xs ${theme.textPrimary}`}>
              <span className="font-medium">动作分类 (A–M)</span>
              <div className="flex flex-wrap gap-1.5">
                {POSE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`min-w-[2rem] rounded-md px-2 py-1 transition-colors ${
                      category === c ? theme.navActive : theme.navIdle
                    }`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </label>
          </>
        ) : null}

        {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${theme.btnSecondary}`}
            onClick={requestClose}
          >
            取消
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${theme.btnPrimary}`}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "保存中…" : "确认入库"}
          </button>
        </div>

        {discardOpen ? (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-full max-w-xs rounded-xl border p-4 shadow-xl ${theme.shell} ${theme.border}`}>
              <p className={`mb-4 text-sm ${theme.textPrimary}`}>尚未入库，确定关闭吗？</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm ${theme.btnSecondary}`}
                  onClick={() => setDiscardOpen(false)}
                >
                  继续编辑
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm ${theme.btnPrimary}`}
                  onClick={onClose}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
