"use client";

import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomFullScreenOverlay } from "@/components/ui/ecom-full-screen-overlay";
import { fetchEcomSceneLibraryCatalog } from "@/lib/ecom-scene-library-api";
import type { EcomSceneLibraryEntry } from "@/lib/ecom-scene-library/types";
import type { OutfitSceneFusionMode } from "@/lib/ecom-outfit-video-api";
import type { OutfitSceneLibraryPreset, SceneShot, WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import { getOutfitProductionField } from "@/lib/outfit-production-fields";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: Array<{ id: OutfitSceneFusionMode; label: string; hint: string }> = [
  { id: "follow_reference", label: "跟随拆解场景", hint: "使用制作表中的光影/场景描述" },
  { id: "library", label: "平台场景库", hint: "选择预设场景提示词" },
  { id: "upload_ref", label: "上传场景参考图", hint: "参考图 + 提示词融图" },
];

type Props = {
  open: boolean;
  shot: SceneShot | null;
  globalSceneRef?: WorkflowRefs["sceneRef"];
  globalScenePreset?: OutfitSceneLibraryPreset | null;
  fusionModelKey: string;
  fusing?: boolean;
  disabled?: boolean;
  onClose: () => void;
  onScenePromptChange: (sceneId: string, promptFragment: string) => void;
  onPickMode: (
    index: number,
    mode: OutfitSceneFusionMode,
    libraryEntryId?: string,
  ) => Promise<void>;
  onUploadSceneRef: (index: number, file: File) => Promise<void>;
  onAttachSceneRefFromAssets: (
    index: number,
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => Promise<void>;
  onFuse: (index: number) => Promise<void>;
  onClearFusion: (index: number) => Promise<void>;
};

export function OutfitShotSceneSetupDialog({
  open,
  shot,
  globalSceneRef,
  globalScenePreset,
  fusionModelKey,
  fusing,
  disabled,
  onClose,
  onScenePromptChange,
  onPickMode,
  onUploadSceneRef,
  onAttachSceneRefFromAssets,
  onFuse,
  onClearFusion,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState<EcomSceneLibraryEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");

  const fusion = shot?.sceneFusion;
  const fusedUrl = fusion?.fusedImageUrl?.trim();
  const busy = Boolean(disabled || fusing);

  const defaultPrompt = useMemo(() => {
    if (!shot) return "";
    const fromFusion = fusion?.visualPromptFragment?.trim();
    if (fromFusion) return fromFusion;
    if (globalScenePreset?.visualPromptFragment?.trim()) {
      return globalScenePreset.visualPromptFragment.trim();
    }
    const bg = getOutfitProductionField(shot, "sceneBackground");
    const light = getOutfitProductionField(shot, "lightingSetup");
    return [bg, light].filter(Boolean).join("，");
  }, [fusion?.visualPromptFragment, globalScenePreset?.visualPromptFragment, shot]);

  useEffect(() => {
    if (!open) return;
    setPromptDraft(defaultPrompt);
  }, [defaultPrompt, open, shot?.sceneId]);

  useEffect(() => {
    if (!open) return;
    setCatalogLoading(true);
    void fetchEcomSceneLibraryCatalog()
      .then((c) => setCatalog(c.scenes ?? []))
      .finally(() => setCatalogLoading(false));
  }, [open]);

  if (!shot) return null;

  return (
    <>
      <EcomFullScreenOverlay
        open={open}
        onClose={onClose}
        title={`镜 ${shot.index} · 场景与融图`}
        description="配置场景来源与描述，执行融图后作为该镜视频生成的人物参考图。"
        panelClassName="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--ecom-ink)]">场景来源</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={busy}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                    fusion?.mode === opt.id
                      ? "border-[var(--ecom-outline-border)] bg-[var(--ecom-content-selected-bg)]"
                      : "border-[var(--ecom-divider)] hover:border-[var(--ecom-border-soft)]",
                  )}
                  onClick={() => {
                    if (opt.id === "upload_ref") {
                      fileRef.current?.click();
                      return;
                    }
                    void onPickMode(shot.index, opt.id);
                  }}
                >
                  <span className="font-medium text-[var(--ecom-ink)]">{opt.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--ecom-subtle)]">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--ecom-ink)]">场景描述（融图 Prompt 片段）</span>
            <textarea
              className="ecom-scrollbar-thin min-h-[5rem] w-full resize-y rounded-lg border border-[var(--ecom-border-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--ecom-ink)] focus:border-[var(--ecom-outline-border)] focus:outline-none focus:ring-2 focus:ring-[var(--ecom-ink)]/15 disabled:opacity-50"
              value={promptDraft}
              disabled={busy}
              onChange={(e) => setPromptDraft(e.target.value)}
              onBlur={() => {
                if (promptDraft.trim() !== (fusion?.visualPromptFragment ?? "").trim()) {
                  onScenePromptChange(shot.sceneId, promptDraft);
                }
              }}
            />
            <p className="text-[10px] text-[var(--ecom-subtle)]">
              默认继承全局场景预设或制作表光影/场景；可在此修改后再融图。
            </p>
          </label>

          {fusion?.mode === "upload_ref" || globalSceneRef?.ossUrl ? (
            <div className="rounded-lg border border-[var(--ecom-divider)] bg-[#fafafa] p-3">
              <p className="mb-2 text-xs font-medium text-[var(--ecom-ink)]">场景参考图</p>
              <div className="flex flex-wrap items-center gap-2">
                {(fusion?.sceneRefUrl || globalSceneRef?.ossUrl)?.trim() ? (
                  <div className="relative h-20 w-14 overflow-hidden rounded-md border border-[var(--ecom-divider)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={(fusion?.sceneRefUrl || globalSceneRef?.ossUrl)!}
                      alt="场景参考"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-14 items-center justify-center rounded-md border border-dashed border-[var(--ecom-border-soft)] text-[var(--ecom-subtle)]">
                    <Plus className="h-5 w-5" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <EcomButtonSecondary
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    上传
                  </EcomButtonSecondary>
                  <EcomButtonSecondary
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => setAssetPickerOpen(true)}
                  >
                    我的资产
                  </EcomButtonSecondary>
                </div>
              </div>
            </div>
          ) : null}

          {fusion?.mode === "library" || catalog.length > 0 ? (
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--ecom-divider)] p-2">
              <p className="text-[10px] font-medium text-[var(--ecom-muted)]">平台场景提示词</p>
              {catalogLoading ? (
                <p className="text-[10px] text-[var(--ecom-subtle)]">加载中…</p>
              ) : (
                catalog.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    disabled={busy}
                    className={cn(
                      "block w-full rounded-md px-2 py-1.5 text-left text-[11px]",
                      fusion?.libraryEntryId === entry.id
                        ? "bg-[var(--ecom-content-selected-bg)] text-[var(--ecom-primary)]"
                        : "text-[var(--ecom-ink)] hover:bg-[var(--ecom-parchment)]",
                    )}
                    onClick={() => void onPickMode(shot.index, "library", entry.id)}
                  >
                    <span className="font-medium">{entry.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-[var(--ecom-subtle)]">
                      {entry.visualPrompt}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}

          <div className="rounded-lg border border-[var(--ecom-divider)] bg-white p-3">
            <p className="mb-2 text-xs font-medium text-[var(--ecom-ink)]">融图结果</p>
            <div className="flex flex-wrap items-start gap-3">
              <div className="relative aspect-[9/16] w-16 overflow-hidden rounded-md border border-[var(--ecom-divider)] bg-[#fafafa]">
                {fusedUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fusedUrl} alt="融合图" className="h-full w-full object-cover" />
                    {fusing ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--ecom-primary)]" />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center px-1 text-center text-[9px] text-[var(--ecom-subtle)]">
                    未融图
                  </div>
                )}
              </div>
              <div className="flex min-w-[10rem] flex-1 flex-col gap-2">
                <EcomButtonPrimary
                  type="button"
                  size="sm"
                  disabled={busy || !fusion?.mode}
                  onClick={() => void onFuse(shot.index)}
                >
                  {fusing ? (
                    <>
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      融图中…
                    </>
                  ) : (
                    "执行融图"
                  )}
                </EcomButtonPrimary>
                {fusedUrl ? (
                  <EcomButtonSecondary
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void onClearFusion(shot.index)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    删除融合图
                  </EcomButtonSecondary>
                ) : null}
                <p className="text-[10px] leading-relaxed text-[var(--ecom-subtle)]">
                  融图模型：{fusionModelKey}。人物图 + 场景描述/参考图 → 静态融合图，供动作迁移使用。
                </p>
              </div>
            </div>
          </div>
        </div>
      </EcomFullScreenOverlay>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUploadSceneRef(shot.index, f);
          e.target.value = "";
        }}
      />

      <EcomAssetPickerDialog
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        maxSelect={1}
        onConfirm={(assets) => {
          setAssetPickerOpen(false);
          void onAttachSceneRefFromAssets(shot.index, assets);
        }}
      />
    </>
  );
}
