"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  catalogKindSupportsImageImport,
  PLATFORM_CATALOG_SAVE_TYPE_OPTIONS,
  platformCatalogSaveTypeLabel,
} from "./platform-catalog-save-types";
import { GALD_CLOSE_BTN_CLASS, globalAssetTheme } from "./theme";
import type {
  GlobalAssetCatalogKind,
  GlobalAssetCatalogScope,
  GlobalAssetLibraryApiClient,
  GlobalAssetLibraryVariant,
  GlobalAssetSaveContext,
  GlobalAssetSourceImage,
} from "./types";

const POSE_CATEGORIES = ["A", "B", "C", "D", "E", "H", "I", "J", "K", "L", "M"];

const MODEL_CATALOG_KINDS = new Set<GlobalAssetCatalogKind>([
  "pose",
  "avatar",
  "garment",
  "full-body",
  "character",
]);

function buildDefaultCatalogName(catalogKind: GlobalAssetCatalogKind): string {
  const label = platformCatalogSaveTypeLabel(catalogKind);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${label}-${stamp}`;
}

type Props = {
  open: boolean;
  variant: GlobalAssetLibraryVariant;
  api: GlobalAssetLibraryApiClient;
  sourceImage: GlobalAssetSourceImage;
  defaultCatalog?: GlobalAssetCatalogKind;
  saveContext?: GlobalAssetSaveContext;
  onClose: () => void;
  onSaved?: () => void;
};

export function SaveToCatalogDialog({
  open,
  variant,
  api,
  sourceImage,
  defaultCatalog = "pose",
  saveContext,
  onClose,
  onSaved,
}: Props) {
  const theme = globalAssetTheme(variant);
  const [catalogKind, setCatalogKind] = useState<GlobalAssetCatalogKind>(defaultCatalog);
  const [scopeUser, setScopeUser] = useState(true);
  const [scopeProject, setScopeProject] = useState(false);
  const [scopePlatform, setScopePlatform] = useState(false);
  const [isAdminFromApi, setIsAdminFromApi] = useState(false);
  const isAdmin = saveContext?.isPlatformAdmin === true || isAdminFromApi;
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
    setScopeUser(true);
    setScopeProject(false);
    setScopePlatform(false);
    setError(null);
    setDiscardOpen(false);
    setSavePrompt(Boolean(sourceImage.prompt?.trim()));
    setPromptText(sourceImage.prompt ?? "");
    setName(buildDefaultCatalogName(defaultCatalog));
    void api.isPlatformAdmin?.().then(setIsAdminFromApi);
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

  function resolvedScopes(): GlobalAssetCatalogScope[] {
    const scopes: GlobalAssetCatalogScope[] = [];
    const canProject =
      scopeProject && saveContext?.allowProjectScope && saveContext.projectId?.trim();
    if (canProject) scopes.push("project");
    else if (scopeUser) scopes.push("user");
    if (scopePlatform && isAdmin) scopes.push("platform");
    return [...new Set(scopes)];
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!catalogKindSupportsImageImport(catalogKind)) {
        throw new Error("当前入口仅支持图片类型");
      }
      const scopes = resolvedScopes();
      if (!scopes.some((s) => s === "user" || s === "project")) {
        throw new Error("请选择个人全账号或当前项目");
      }
      const payloadBase = {
        catalogKind,
        imageUrl: sourceImage.url,
        name: name.trim() || buildDefaultCatalogName(catalogKind),
        gender: MODEL_CATALOG_KINDS.has(catalogKind) ? gender : undefined,
        savePrompt: catalogKind === "pose" ? savePrompt : undefined,
        prompt: catalogKind === "pose" && savePrompt ? promptText : undefined,
        category: catalogKind === "pose" ? category : undefined,
        sourceModule: sourceImage.sourceModule,
        sourceAssetId: sourceImage.sourceAssetId,
        projectId: saveContext?.projectId,
        modelKey:
          catalogKind === "style" || catalogKind === "scene"
            ? saveContext?.visionModelKey
            : undefined,
      };
      for (const finalScope of scopes) {
        await api.importToCatalog({
          ...payloadBase,
          scope: finalScope,
          sourceProjectId:
            finalScope === "project" ? saveContext?.projectId ?? undefined : undefined,
        });
      }
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
        className={`relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-xl sm:flex-row ${theme.shell}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex min-h-[200px] shrink-0 items-center justify-center border-b p-4 sm:min-h-0 sm:w-[40%] sm:max-w-[320px] sm:border-b-0 sm:border-r ${theme.border} ${
            variant === "dark" ? "bg-black/30" : "bg-[#f5f5f7]"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sourceImage.url}
            alt=""
            className="max-h-[min(42vh,360px)] w-full object-contain sm:max-h-[min(78vh,520px)]"
          />
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 pt-10">
          <button
            type="button"
            className={`absolute right-3 top-3 ${GALD_CLOSE_BTN_CLASS} ${theme.btnSecondary}`}
            aria-label="关闭"
            onClick={requestClose}
          >
            <X className="h-4 w-4" />
          </button>

          <h4 className={`mb-3 pr-8 text-sm font-semibold ${theme.textPrimary}`}>保存平台资产库</h4>

        <label className={`mb-3 block space-y-1 text-xs ${theme.textPrimary}`}>
          <span className="font-medium">类型</span>
          <select
            className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-sm ${theme.border} bg-transparent`}
            value={catalogKind}
            onChange={(e) => setCatalogKind(e.target.value as GlobalAssetCatalogKind)}
          >
            {PLATFORM_CATALOG_SAVE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className={`mb-3 space-y-2 text-xs ${theme.textPrimary}`}>
          <legend className={`mb-1 font-medium ${theme.textSecondary}`}>可见范围</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={scopeUser}
              onChange={(e) => {
                const on = e.target.checked;
                setScopeUser(on);
                if (on) setScopeProject(false);
              }}
            />
            个人 · 全账号可用
          </label>
          {saveContext?.allowProjectScope ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scopeProject}
                onChange={(e) => {
                  const on = e.target.checked;
                  setScopeProject(on);
                  if (on) setScopeUser(false);
                }}
              />
              仅当前画布项目
            </label>
          ) : null}
          {isAdmin ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scopePlatform}
                onChange={(e) => setScopePlatform(e.target.checked)}
              />
              全平台 · 所有用户可用
            </label>
          ) : null}
        </fieldset>

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

        {MODEL_CATALOG_KINDS.has(catalogKind) ? (
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
        ) : null}

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
        <div className="mt-auto flex justify-end gap-2 pt-2">
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
            {busy
              ? catalogKind === "style" || catalogKind === "scene"
                ? "分析并入库中…"
                : "保存中…"
              : "确认入库"}
          </button>
        </div>
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
