"use client";

import Image from "next/image";
import { Download, Eye, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import {
  ECOM_HOVER_PREVIEW_BTN_SIZE_CLASS,
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_MEDIA_TILE_PREVIEW_EYE_CLASS,
  ECOM_SLOT_HOVER_ACTION_BTN_CLASS,
  ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS,
  ECOM_SLOT_HOVER_OVERLAY_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { uploadBrandViComposePng } from "@/lib/ecom-brand-vi-api";
import type { BrandViProject, BrandViStepId } from "@/lib/brand-vi-types";
import {
  missingRequirements,
  sheetPagesFor,
  stepState,
  type BrandViStepMeta,
} from "@/lib/brand-vi-workflow";
import {
  BrandViSheetView,
  brandViSheetDomId,
  BRAND_VI_SHEET_WIDTH,
} from "@/components/brand-vi/brand-vi-sheet-view";
import {
  composeCanvasMostlyBlank,
  composeHtml2CanvasScale,
  preloadComposeSheetImages,
  revokeComposeSheetBlobUrls,
} from "@/lib/ecom-compose-image-preload";
import { cn } from "@/lib/utils";

const COMPOSE_ICON_BTN = cn(
  ECOM_SLOT_HOVER_ACTION_BTN_CLASS,
  "inline-flex items-center justify-center",
);
const COMPOSE_PREVIEW_BTN = cn(
  "inline-flex items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] ring-1 ring-black/10 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50",
  ECOM_HOVER_PREVIEW_BTN_SIZE_CLASS,
);

type Props = {
  project: BrandViProject;
  step: BrandViStepMeta;
  disabled?: boolean;
  onProjectChange: () => void | Promise<void>;
  onApplyProject?: (project: BrandViProject) => void | Promise<void>;
  onPreviewImage?: (src: string, title: string) => void;
  /** 助手点「确认拼版」时递增，自动执行本步拼版 */
  composeRequest?: { stepId: BrandViStepId; token: number } | null;
  onBusyChange?: (busy: boolean, detail?: string) => void;
};

/**
 * 第 8–8 步拼版：离屏挂载 BrandViSheetView，html2canvas 抓 PNG 后上传 OSS。
 *
 * 本仓库没有服务端 HTML 渲染器，与微剧故事版的 sheetPngUrl 走同一条链。
 */
export function BrandViComposePanel({
  project,
  step,
  disabled,
  onProjectChange,
  onApplyProject,
  onPreviewImage,
  composeRequest = null,
  onBusyChange,
}: Props) {
  const { alert, toast } = useDialogs();
  const pages = useMemo(() => sheetPagesFor(step.id), [step.id]);
  const state = stepState(project, step.id);
  const blocked = missingRequirements(project, step.id);
  const [busyPage, setBusyPage] = useState<number | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  /** 抓图期间只挂载当前页离屏版式 */
  const [exportPageIndex, setExportPageIndex] = useState<number | null>(null);

  const outputByPage = useMemo(
    () => new Map(state.outputs.map((o) => [o.index, o])),
    [state.outputs],
  );
  const done = state.outputs.filter((o) => o.imageUrl).length;
  const locked = Boolean(disabled) || busyPage != null || blocked.length > 0;

  const reportBusyDetail = useCallback(
    (detail: string) => {
      onBusyChange?.(true, detail);
    },
    [onBusyChange],
  );

  const capturePage = useCallback(
    async (pageIndex: number): Promise<string> => {
      const el = document.getElementById(brandViSheetDomId(step.id, pageIndex));
      if (!el) throw new Error("找不到拼版区域");

      const { blobUrls, imageCount } = await preloadComposeSheetImages(el, {
        onProgress: ({ done, total, label }) => {
          reportBusyDetail(
            total > 1
              ? `加载引用图 ${done}/${total}（${label}）…`
              : `加载引用图（${label}）…`,
          );
        },
      });
      try {
        reportBusyDetail("浏览器正在排版抓图…");
        await new Promise((r) => setTimeout(r, 300));

        let scrollHeight = Math.max(el.scrollHeight, el.offsetHeight, 1);
        if (scrollHeight < 200 && step.id === "portfolio") {
          await new Promise((r) => setTimeout(r, 400));
          scrollHeight = Math.max(el.scrollHeight, el.offsetHeight, 1);
        }
        const scale = composeHtml2CanvasScale(step.id, imageCount);
        const { default: html2canvas } = await import("html2canvas");
        const html2canvasOpts = {
          scale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          width: BRAND_VI_SHEET_WIDTH,
          height: scrollHeight,
          windowWidth: BRAND_VI_SHEET_WIDTH,
          windowHeight: scrollHeight,
          scrollX: 0,
          scrollY: 0,
        };
        let canvas = await html2canvas(el, html2canvasOpts);
        if (composeCanvasMostlyBlank(canvas)) {
          await new Promise((r) => setTimeout(r, 400));
          canvas = await html2canvas(el, html2canvasOpts);
          if (composeCanvasMostlyBlank(canvas)) {
            if (scrollHeight < 200) {
              throw new Error(
                "拼版区域未正确排版（高度过小），请刷新页面后重试；若仍失败请联系支持",
              );
            }
            throw new Error("拼版抓图为空白，请确认前序成图已加载后重试");
          }
        }
        reportBusyDetail("正在上传拼版 PNG…");
        return canvas.toDataURL("image/png");
      } finally {
        revokeComposeSheetBlobUrls(blobUrls);
      }
    },
    [reportBusyDetail, step.id],
  );

  const waitForExportSheetMount = useCallback(async () => {
    await new Promise<void>((r) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
    });
    await new Promise((r) =>
      setTimeout(r, step.id === "portfolio" || step.id === "vi-spec" ? 200 : 80),
    );
  }, [step.id]);

  const composePages = useCallback(
    async (indexes: number[]) => {
      if (indexes.length === 0) return;
      if (blocked.length > 0) {
        await alert({
          title: "还不能拼版",
          message: `请先完成：${blocked.join("、")}`,
          variant: "error",
        });
        return;
      }
      onBusyChange?.(true, "准备拼版…");

      const failures: string[] = [];
      try {
        for (const [i, pageIndex] of indexes.entries()) {
          setBusyPage(pageIndex);
          setProgress(`正在拼版第 ${pageIndex} 页（${i + 1}/${indexes.length}）…`);
          setExportPageIndex(pageIndex);
          await waitForExportSheetMount();
          try {
            const pngBase64 = await capturePage(pageIndex);
            const { project: fresh } = await uploadBrandViComposePng({
              projectId: project.id,
              stepId: step.id,
              pageIndex,
              pngBase64,
            });
            if (onApplyProject) await onApplyProject(fresh);
          } catch (e) {
            failures.push(`第 ${pageIndex} 页：${e instanceof Error ? e.message : "未知错误"}`);
          }
        }
      } finally {
        setBusyPage(null);
        setProgress(null);
        setExportPageIndex(null);
        onBusyChange?.(false, undefined);
        await onProjectChange();
      }

      if (failures.length > 0) {
        await alert({
          title: "部分页拼版失败",
          message: failures.join("\n"),
          variant: "error",
        });
      } else if (indexes.length > 0) {
        void toast({
          title: `${step.label} 拼版完成`,
          message: `共 ${indexes.length} 页已上传并写入项目。`,
          variant: "success",
        });
      }
    },
    [
      alert,
      blocked,
      capturePage,
      onApplyProject,
      onBusyChange,
      onProjectChange,
      project.id,
      step.id,
      step.label,
      toast,
      waitForExportSheetMount,
    ],
  );

  const exportPage = useMemo(
    () =>
      exportPageIndex != null
        ? pages.find((p) => p.index === exportPageIndex)
        : undefined,
    [exportPageIndex, pages],
  );

  const composeTokenRef = useRef(composeRequest?.token ?? 0);
  useEffect(() => {
    if (!composeRequest || composeRequest.stepId !== step.id) return;
    if (composeRequest.token === composeTokenRef.current) return;
    composeTokenRef.current = composeRequest.token;
    const pending = pages
      .filter((p) => !outputByPage.get(p.index)?.imageUrl)
      .map((p) => p.index);
    const indexes = pending.length > 0 ? pending : pages.map((p) => p.index);
    void composePages(indexes);
  }, [composePages, composeRequest, outputByPage, pages, step.id]);

  async function handleDownload(pageIndex: number) {
    const url = outputByPage.get(pageIndex)?.imageUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.download = `${step.id}-p${String(pageIndex).padStart(2, "0")}.png`;
    a.click();
  }

  return (
    <section
      id={`brand-vi-step-${step.id}`}
      className="scroll-mt-20 rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">
            第 {step.no} 步 · {step.label}
          </h3>
          <p className="mt-0.5 text-[11px] text-[#6e6e73]">
            {step.summary} · 版式由代码排版，浏览器抓图后存入云端
            <span className="ml-1">
              已拼 {done}/{pages.length || step.count}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {done > 0 ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={locked}
              onClick={() => void composePages(pages.map((p) => p.index))}
            >
              全部重拼
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={locked}
            onClick={() =>
              void composePages(
                pages.filter((p) => !outputByPage.get(p.index)?.imageUrl).map((p) => p.index),
              )
            }
          >
            {done === 0
              ? `生成拼版 (${pages.length})`
              : `补齐剩余 (${pages.length - done})`}
          </EcomButtonPrimary>
        </div>
      </div>

      {blocked.length > 0 ? (
        <p className="mb-3 rounded-lg border border-[#ffd8a8] bg-[#fff8f0] px-3 py-2 text-[11px] text-[#8a5a00]">
          本步要引用前序成图，尚缺：{blocked.join("、")}。补齐后按钮才会解锁。
        </p>
      ) : null}

      <div
        className={cn(
          "grid gap-3",
          step.id === "portfolio" ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {pages.map((page) => {
          const output = outputByPage.get(page.index);
          const busy = busyPage === page.index;
          const isLongScrollPage = step.id === "portfolio";
          return (
            <article
              key={page.index}
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e8e8ed] bg-white"
            >
              <div className="flex items-center gap-1.5 border-b border-[#f0f0f2] px-2.5 py-1.5">
                <span className="shrink-0 text-[10px] font-semibold text-[#86868b]">
                  P{String(page.index).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#1d1d1f]">
                  {page.title}
                </span>
              </div>

              <div
                className={cn(
                  "group/image relative w-full shrink-0 bg-[#f5f5f7]",
                  isLongScrollPage
                    ? "max-h-[min(72vh,880px)] overflow-y-auto overscroll-y-contain"
                    : "overflow-hidden",
                )}
                style={isLongScrollPage ? undefined : { aspectRatio: "3 / 4" }}
              >
                {busy ? (
                  <EcomMediaGeneratingBusy
                    className={isLongScrollPage ? "min-h-[240px]" : "absolute inset-0"}
                  />
                ) : output?.imageUrl ? (
                  isLongScrollPage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={output.imageUrl}
                        alt={page.title}
                        className="block w-full h-auto"
                      />
                      <div className="sticky bottom-0 flex flex-wrap justify-end gap-1.5 border-t border-[#e8e8ed] bg-white/95 p-2 backdrop-blur-sm sm:gap-2">
                        {onPreviewImage ? (
                          <button
                            type="button"
                            title="全屏预览"
                            className={COMPOSE_PREVIEW_BTN}
                            onClick={() => onPreviewImage(output.imageUrl, page.title)}
                          >
                            <Eye className={ECOM_MEDIA_TILE_PREVIEW_EYE_CLASS} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="下载"
                          className={COMPOSE_ICON_BTN}
                          onClick={() => void handleDownload(page.index)}
                        >
                          <Download className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
                        </button>
                        <button
                          type="button"
                          title="重新拼版"
                          disabled={locked}
                          className={COMPOSE_ICON_BTN}
                          onClick={() => void composePages([page.index])}
                        >
                          <span className="text-[10px] font-semibold">重拼</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Image
                        src={output.imageUrl}
                        alt={page.title}
                        fill
                        className="object-contain"
                        sizes="(max-width: 1024px) 33vw, 280px"
                        unoptimized
                      />
                      <div aria-hidden className={ECOM_SLOT_HOVER_OVERLAY_CLASS} />
                      <div className={ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS}>
                        {onPreviewImage ? (
                          <button
                            type="button"
                            title="预览"
                            className={cn(COMPOSE_PREVIEW_BTN, "pointer-events-auto")}
                            onClick={() => onPreviewImage(output.imageUrl, page.title)}
                          >
                            <Eye className={ECOM_MEDIA_TILE_PREVIEW_EYE_CLASS} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="下载"
                          className={cn(COMPOSE_ICON_BTN, "pointer-events-auto")}
                          onClick={() => void handleDownload(page.index)}
                        >
                          <Download className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
                        </button>
                        <button
                          type="button"
                          title="重新拼版"
                          disabled={locked}
                          className={cn(COMPOSE_ICON_BTN, "pointer-events-auto")}
                          onClick={() => void composePages([page.index])}
                        >
                          <span className="text-[11px] font-semibold">重拼</span>
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={locked}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-1 text-[11px] text-[#6e6e73] disabled:cursor-not-allowed disabled:opacity-60",
                      isLongScrollPage ? "min-h-[240px]" : "h-full",
                    )}
                    onClick={() => void composePages([page.index])}
                  >
                    <span className="text-sm font-semibold text-[#1d1d1f]">拼版本页</span>
                    <span>引用前序成图自动排版</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {progress ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-[#6e6e73]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {progress}
        </p>
      ) : null}

      {/* 离屏版式：宽度固定，位置移出视口，仅抓图期间挂载 */}
      {exportPage ? (
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 -z-10"
          style={{
            width: BRAND_VI_SHEET_WIDTH,
            opacity: 0,
            overflow: "visible",
          }}
        >
          <BrandViSheetView
            key={exportPage.index}
            project={project}
            stepId={step.id}
            page={exportPage}
            variant="export"
          />
        </div>
      ) : null}
    </section>
  );
}
