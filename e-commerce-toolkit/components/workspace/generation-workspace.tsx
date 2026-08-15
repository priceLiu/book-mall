"use client";

import { useCallback, useEffect, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import {
  EcomMediaLibraryTile,
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import type { EcomModuleDef } from "@/lib/modules/registry";
import {
  deleteAsset,
  fetchBillableEstimate,
  fetchBillingMode,
  generateImage,
  generateVideo,
  isAssetPinnedInAiSpace,
  listAssets,
  pinAssetToAiSpace,
  type EcomAsset,
  type EcomBillingMode,
} from "@/lib/ecom-api";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";

export function GenerationWorkspace({ module }: { module: EcomModuleDef }) {
  const { confirm, doubleConfirm, alert } = useDialogs();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<EcomAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [billingMode, setBillingMode] = useState<EcomBillingMode | null>(null);
  const [estimatePts, setEstimatePts] = useState<number | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );
  const [previewImage, setPreviewImage] = useState<{ src: string; title?: string } | null>(
    null,
  );
  const [pinnedAssetIds, setPinnedAssetIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const [items, mode] = await Promise.all([
        listAssets(module.id),
        fetchBillingMode(),
      ]);
      setAssets(items);
      setBillingMode(mode);
      if (mode === "PLATFORM_METERED") {
        const pts = await fetchBillableEstimate(
          module.toolKey,
          module.action,
        ).catch(() => null);
        setEstimatePts(pts);
      }
    } finally {
      setAssetsLoading(false);
    }
  }, [module]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [load]);

  async function handleGenerate() {
    if (!prompt.trim()) {
      await alert({ title: "提示", message: "请先填写创作描述" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (module.kind === "video") {
        await generateVideo({
          toolKey: module.toolKey,
          action: module.action,
          prompt: prompt.trim(),
          module: module.id,
          durationSec: 5,
        });
      } else {
        await generateImage({
          toolKey: module.toolKey,
          action: module.action,
          prompt: prompt.trim(),
          module: module.id,
          estimatedPoints: estimatePts ?? undefined,
        });
      }
      setPrompt("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      setError(msg);
      await alert({ title: "生成失败", message: msg, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handlePin(asset: EcomAsset) {
    try {
      await pinAssetToAiSpace(asset.id);
      setPinnedAssetIds((prev) => new Set(prev).add(asset.id));
      await alert({
        title: "已展示到 AI 空间",
        message: "可在「个人中心 → 我的 AI 空间」查看与布置。空间只保存指向，不复制文件。",
      });
    } catch (e) {
      await alert({
        title: "展示失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function handleDelete(asset: EcomAsset) {
    const label = asset.title ?? "本条资产";
    if (
      !(await confirm({
        title: "删除资产",
        message: `确定从我的资产库删除「${label}」？`,
        variant: "destructive",
      }))
    ) {
      return;
    }
    const pinned = await isAssetPinnedInAiSpace(asset.id);
    if (
      !(await doubleConfirm({
        title: "再次确认",
        message: "此操作不可恢复。",
        secondTitle: "不可恢复",
        secondMessage: pinned
          ? "删除后库记录将移除；若文件在云端存储（OSS）将尝试一并删除。该作品已展示在「我的 AI 空间」，个人空间展示将一并移除。"
          : "删除后库记录将移除；若文件在云端存储（OSS）将尝试一并删除。",
        confirmLabel: "确认删除",
      }))
    ) {
      return;
    }
    try {
      await deleteAsset(asset.id);
      await load();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  const billingHint =
    billingMode === "PLATFORM_METERED"
      ? estimatePts != null
        ? `代付按次 · 预估约 ${estimatePts} 点/次`
        : "代付按次 · 按挂牌价×2 扣点"
      : "自备 Key + 月费 · 生成不扣点";

  return (
    <>
      <EcomWorkspaceLayout
        assistantHeader={
          <>
            <h1 className="text-lg font-semibold text-[#1d1d1f]">{module.title}</h1>
            <p className="mt-1 text-xs text-[#6e6e73]">{module.tagline}</p>
            <p className="mt-2 text-xs text-[#86868b]">{billingHint}</p>
          </>
        }
        assistant={
          <div className="flex h-full flex-col bg-[var(--ecom-assistant-surface)] p-4">
            <label className="text-sm font-semibold text-[#1d1d1f]">创作描述</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              className="mt-2 min-h-0 flex-1 resize-none rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] p-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3]"
              placeholder="描述商品、风格、镜头与卖点…"
            />
            {error ? (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            ) : null}
            <div className="mt-4">
              <EcomButtonPrimary
                fullWidth
                size="md"
                altLabel="生成中…"
                flipActive={busy}
                disabled={busy}
                onClick={handleGenerate}
              >
                生成
              </EcomButtonPrimary>
            </div>
          </div>
        }
      >
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <h2 className="text-xl font-semibold text-[#1d1d1f]">本模块资产</h2>
          {assetsLoading ? (
            <p className="mt-4 text-sm text-[#6e6e73]">加载中…</p>
          ) : assets.length === 0 ? (
            <p className="mt-4 text-sm text-[#6e6e73]">
              暂无作品，生成后将显示在这里。
            </p>
          ) : (
            <ul className={`mt-6 ${ECOM_LIBRARY_MEDIA_GRID_CLASS}`}>
              {assets.map((a) => {
                const isVideo = a.kind === "video";
                return (
                  <li key={a.id}>
                    <EcomMediaLibraryTile
                      kind={isVideo ? "video" : "image"}
                      src={a.ossUrl}
                      thumbnailSrc={a.thumbnailUrl}
                      alt={a.title ?? ""}
                      onPreview={() =>
                        isVideo
                          ? setPreviewVideo({ src: a.ossUrl, title: a.title ?? undefined })
                          : setPreviewImage({
                              src: a.thumbnailUrl ?? a.ossUrl,
                              title: a.title ?? undefined,
                            })
                      }
                      onDownload={() =>
                        void downloadMediaUrl(
                          a.ossUrl,
                          mediaDownloadFilename(a.title, a.kind, a.ossUrl),
                        )
                      }
                      onDelete={() => void handleDelete(a)}
                      onPinToAiSpace={() => void handlePin(a)}
                      pinnedToAiSpace={pinnedAssetIds.has(a.id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </EcomWorkspaceLayout>

      {previewVideo ? (
        <EcomVideoPreviewDialog
          src={previewVideo.src}
          title={previewVideo.title}
          open
          onOpenChange={(open) => {
            if (!open) setPreviewVideo(null);
          }}
        />
      ) : null}

      {previewImage ? (
        <EcomImagePreviewDialog
          src={previewImage.src}
          title={previewImage.title}
          open
          onOpenChange={(open) => {
            if (!open) setPreviewImage(null);
          }}
        />
      ) : null}
    </>
  );
}
