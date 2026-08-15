"use client";

import Image from "next/image";
import { Download, Eye, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { uploadHandCraftComposePng } from "@/lib/ecom-hand-craft-api";
import type { HandCraftProject, HandCraftStepId } from "@/lib/hand-craft-types";
import {
  missingRequirements,
  sheetPagesFor,
  stepState,
  type HandCraftStepMeta,
} from "@/lib/hand-craft-workflow";
import {
  HandCraftSheetView,
  handCraftSheetDomId,
  HAND_CRAFT_SHEET_WIDTH,
} from "@/components/hand-craft/hand-craft-sheet-view";
import { cn } from "@/lib/utils";

const ICON_BTN =
  "flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] ring-1 ring-black/10 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  project: HandCraftProject;
  step: HandCraftStepMeta;
  disabled?: boolean;
  onProjectChange: () => void | Promise<void>;
  onPreviewImage?: (src: string, title: string) => void;
  /** 助手点「确认拼版」时递增，自动执行本步拼版 */
  composeRequest?: { stepId: HandCraftStepId; token: number } | null;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * 第 8–10 步拼版：离屏挂载 HandCraftSheetView，html2canvas 抓 PNG 后上传 OSS。
 *
 * 本仓库没有服务端 HTML 渲染器，与微剧故事版的 sheetPngUrl 走同一条链。
 */
export function HandCraftComposePanel({
  project,
  step,
  disabled,
  onProjectChange,
  onPreviewImage,
  composeRequest = null,
  onBusyChange,
}: Props) {
  const { alert } = useDialogs();
  const pages = useMemo(() => sheetPagesFor(step.id), [step.id]);
  const state = stepState(project, step.id);
  const blocked = missingRequirements(project, step.id);
  const [busyPage, setBusyPage] = useState<number | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  /** 抓图期间才把离屏版式挂进 DOM，避免常驻十几张大图拖慢工作区 */
  const [mounted, setMounted] = useState(false);

  const outputByPage = useMemo(
    () => new Map(state.outputs.map((o) => [o.index, o])),
    [state.outputs],
  );
  const done = state.outputs.filter((o) => o.imageUrl).length;
  const locked = Boolean(disabled) || busyPage != null || blocked.length > 0;

  const capturePage = useCallback(async (pageIndex: number): Promise<string> => {
    const el = document.getElementById(handCraftSheetDomId(step.id, pageIndex));
    if (!el) throw new Error("找不到拼版区域");

    const imgs = Array.from(el.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve, reject) => {
            const label = img.alt || "成图";
            let settled = false;
            const finish = (fn: () => void) => {
              if (settled) return;
              settled = true;
              fn();
            };
            if (img.complete && img.naturalHeight > 0) {
              resolve();
              return;
            }
            img.onload = () =>
              finish(() =>
                img.naturalHeight > 0
                  ? resolve()
                  : reject(new Error(`引用图未能加载：${label}`)),
              );
            img.onerror = () =>
              finish(() => reject(new Error(`引用图加载失败：${label}（请稍后重试拼版）`)));
            setTimeout(
              () =>
                finish(() =>
                  img.naturalHeight > 0
                    ? resolve()
                    : reject(new Error(`引用图加载超时：${label}`)),
                ),
              12_000,
            );
          }),
      ),
    );
    await new Promise((r) => setTimeout(r, 300));

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      width: HAND_CRAFT_SHEET_WIDTH,
      windowWidth: HAND_CRAFT_SHEET_WIDTH,
    });
    return canvas.toDataURL("image/png");
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
      onBusyChange?.(true);
      setMounted(true);
      // 等离屏版式完成一次布局与图片挂载
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });

      const failures: string[] = [];
      try {
        for (const [i, pageIndex] of indexes.entries()) {
          setBusyPage(pageIndex);
          setProgress(`正在拼版第 ${pageIndex} 页（${i + 1}/${indexes.length}）…`);
          try {
            const pngBase64 = await capturePage(pageIndex);
            await uploadHandCraftComposePng({
              projectId: project.id,
              stepId: step.id,
              pageIndex,
              pngBase64,
            });
          } catch (e) {
            failures.push(`第 ${pageIndex} 页：${e instanceof Error ? e.message : "未知错误"}`);
          }
        }
      } finally {
        setBusyPage(null);
        setProgress(null);
        setMounted(false);
        onBusyChange?.(false);
        await onProjectChange();
      }

      if (failures.length > 0) {
        await alert({
          title: "部分页拼版失败",
          message: failures.join("\n"),
          variant: "error",
        });
      }
    },
    [alert, blocked, capturePage, onBusyChange, onProjectChange, project.id, step.id],
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
      id={`hand-craft-step-${step.id}`}
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
          step.id === "xhs-long" ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {pages.map((page) => {
          const output = outputByPage.get(page.index);
          const busy = busyPage === page.index;
          const isLongScrollPage = step.id === "xhs-long";
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
                      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#e8e8ed] bg-white/95 p-2 backdrop-blur-sm">
                        {onPreviewImage ? (
                          <button
                            type="button"
                            title="全屏预览"
                            className={cn(ICON_BTN, "h-10 w-10")}
                            onClick={() => onPreviewImage(output.imageUrl, page.title)}
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="下载"
                          className={cn(ICON_BTN, "h-10 w-10")}
                          onClick={() => void handleDownload(page.index)}
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          title="重新拼版"
                          disabled={locked}
                          className={cn(ICON_BTN, "h-10 w-10")}
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
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-10 bg-black/45 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100"
                      />
                      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-3 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100">
                        {onPreviewImage ? (
                          <button
                            type="button"
                            title="预览"
                            className={cn(ICON_BTN, "pointer-events-auto")}
                            onClick={() => onPreviewImage(output.imageUrl, page.title)}
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="下载"
                          className={cn(ICON_BTN, "pointer-events-auto")}
                          onClick={() => void handleDownload(page.index)}
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          title="重新拼版"
                          disabled={locked}
                          className={cn(ICON_BTN, "pointer-events-auto")}
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
      {mounted ? (
        <div
          aria-hidden
          className="pointer-events-none fixed -left-[9999px] top-0 z-0"
          style={{ width: HAND_CRAFT_SHEET_WIDTH }}
        >
          {pages.map((page) => (
            <HandCraftSheetView
              key={page.index}
              project={project}
              stepId={step.id}
              page={page}
              variant="export"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
