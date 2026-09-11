"use client";

import { Loader2, ScanEye, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { OutfitModelRefsPanel } from "@/components/outfit-video/outfit-model-refs-panel";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import type { OutfitClothAnalyseMeta } from "@/lib/ecom-outfit-video-api";
import type {
  OutfitModelGalleryItem,
  OutfitSceneLibraryPreset,
  WorkflowRefImage,
} from "@/lib/video-workflow/shot-spine";

type Props = {
  gallery: OutfitModelGalleryItem[];
  sceneRef?: WorkflowRefImage | null;
  sceneLibraryPreset?: OutfitSceneLibraryPreset | null;
  refsLocked?: boolean;
  busy?: boolean;
  modelUploading?: boolean;
  modelUploadLabel?: string;
  sceneUploading?: boolean;
  sceneUploadLabel?: string;
  userSellPoint?: string;
  clothAnalyse?: OutfitClothAnalyseMeta | null;
  clothAnalyseBusy?: boolean;
  onUserSellPointChange: (value: string) => void;
  onSaveUserSellPoint: (value: string) => Promise<void>;
  onAnalyseCloth: () => Promise<void>;
  onUploadModelGallery: (files: File[]) => Promise<void>;
  onAttachModelGalleryFromAssets: (
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => Promise<void>;
  onRemoveModelGalleryItem: (refId: string) => Promise<void>;
  onUploadGlobalSceneRef: (file: File) => Promise<void>;
  onAttachGlobalSceneRefFromAssets: (
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => Promise<void>;
  onPickGlobalSceneLibraryPreset: (preset: OutfitSceneLibraryPreset) => Promise<void>;
  onRemoveGlobalSceneRef: () => Promise<void>;
  productionGenerating?: boolean;
  productionStale?: boolean;
  onGenerateProductionStoryboard: () => Promise<void>;
};

export function OutfitRefSetupPanel({
  gallery,
  sceneRef,
  sceneLibraryPreset,
  refsLocked,
  busy,
  modelUploading,
  modelUploadLabel,
  sceneUploading,
  sceneUploadLabel,
  userSellPoint = "",
  clothAnalyse,
  clothAnalyseBusy,
  onUserSellPointChange,
  onSaveUserSellPoint,
  onAnalyseCloth,
  onUploadModelGallery,
  onAttachModelGalleryFromAssets,
  onRemoveModelGalleryItem,
  onUploadGlobalSceneRef,
  onAttachGlobalSceneRefFromAssets,
  onPickGlobalSceneLibraryPreset,
  onRemoveGlobalSceneRef,
  productionGenerating,
  productionStale,
  onGenerateProductionStoryboard,
}: Props) {
  const [sellDraft, setSellDraft] = useState(userSellPoint);
  const hasGallery = gallery.length > 0;
  const analyseBusy = Boolean(clothAnalyseBusy || clothAnalyse?.status === "generating");
  const clothReady = clothAnalyse?.status === "success";

  useEffect(() => {
    setSellDraft(userSellPoint);
  }, [userSellPoint]);

  return (
    <div className="space-y-3">
      <OutfitModelRefsPanel
        gallery={gallery}
        sceneRef={sceneRef}
        sceneLibraryPreset={sceneLibraryPreset}
        refsLocked={refsLocked}
        busy={busy}
        modelUploading={modelUploading}
        modelUploadLabel={modelUploadLabel}
        sceneUploading={sceneUploading}
        sceneUploadLabel={sceneUploadLabel}
        onUploadModelFiles={onUploadModelGallery}
        onAttachModelAssets={onAttachModelGalleryFromAssets}
        onRemoveModelItem={onRemoveModelGalleryItem}
        onUploadSceneRef={onUploadGlobalSceneRef}
        onAttachSceneAsset={onAttachGlobalSceneRefFromAssets}
        onPickSceneLibraryPreset={onPickGlobalSceneLibraryPreset}
        onRemoveSceneRef={onRemoveGlobalSceneRef}
      />

      <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">卖点与服装识别</h2>
          <p className="mt-1 text-xs text-[#6e6e73]">
            卖点选填；留空时 AI 将根据识别结果自动推导展示重点。识别完成后可一键生成下方「分镜制作表」。
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#1d1d1f]">全局卖点（选填）</span>
          <textarea
            className="ecom-scrollbar-overlay min-h-[4.5rem] w-full resize-y rounded-lg border border-[#d2d2d7] px-3 py-2 text-xs text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 disabled:opacity-50"
            placeholder="例如：垂感面料、收腰显高、后背蝴蝶结设计…"
            value={sellDraft}
            disabled={busy}
            onChange={(e) => {
              setSellDraft(e.target.value);
              onUserSellPointChange(e.target.value);
            }}
            onBlur={() => {
              if (sellDraft.trim() !== userSellPoint.trim()) {
                void onSaveUserSellPoint(sellDraft);
              }
            }}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={!hasGallery || analyseBusy || busy}
            onClick={() => void onAnalyseCloth()}
          >
            {analyseBusy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanEye className="mr-1 h-3.5 w-3.5" />
            )}
            {clothAnalyse?.status === "success" ? "重新识别服装" : "识别服装"}
          </EcomButtonPrimary>
          {clothAnalyse?.status === "success" ? (
            <span className="text-[11px] text-[#34c759]">识别完成</span>
          ) : clothAnalyse?.status === "stale" ? (
            <span className="text-[11px] text-[#8a6d3b]">
              {clothAnalyse.failReason ?? "参考图已变更，请重新识别"}
            </span>
          ) : clothAnalyse?.status === "failed" ? (
            <span className="text-[11px] text-[#ff3b30]">
              {clothAnalyse.failReason ?? "识别失败"}
            </span>
          ) : null}
        </div>

        {clothAnalyse?.status === "success" && clothAnalyse.structuredText ? (
          <pre className="ecom-scrollbar-overlay max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3 text-[11px] leading-relaxed text-[#1d1d1f]">
            {clothAnalyse.structuredText}
          </pre>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">生成分镜制作表</h2>
          <p className="mt-1 text-xs text-[#6e6e73]">
            将「拆解分镜表」+ 服装识别 + 卖点提交 AI，批量生成可编辑的分镜制作表；动作/场景/Prompt 支持 @图片N 引用上方参考资产。
          </p>
        </div>
        {productionStale ? (
          <p className="rounded-lg border border-[#ffe8bf] bg-[#fffbf0] px-3 py-2 text-xs text-[#8a6d3b]">
            拆解或识别信息已变更，建议重新生成分镜制作表。
          </p>
        ) : null}
        <EcomButtonPrimary
          type="button"
          size="sm"
          disabled={!hasGallery || !clothReady || analyseBusy || busy || productionGenerating}
          onClick={() => void onGenerateProductionStoryboard()}
        >
          {productionGenerating ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              生成中…
            </>
          ) : (
            <>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              生成分镜制作表
            </>
          )}
        </EcomButtonPrimary>
      </section>
    </div>
  );
}
