"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, CircleHelp, Loader2 } from "lucide-react";

import { ImageEditorAiGenDisclaimer } from "@/components/image-editor/image-editor-ai-gen-disclaimer";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { fetchImageProcessingModels, submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomMediaFetchUrl } from "@/lib/ecom-media-download";
import {
  IMAGE_EDITOR_OUTPAINT_MODEL,
  IMAGE_EDITOR_OUTPAINT_RATIO_TILES,
  IMAGE_EDITOR_OUTPAINT_SCALE_DEFAULT,
  IMAGE_EDITOR_OUTPAINT_SCALE_MAX,
  IMAGE_EDITOR_OUTPAINT_SCALE_MIN,
  buildImageEditorOutpaintParameters,
  clampOutpaintScalePercent,
  computeImageEditorOutpaintPreviewLayout,
  type ImageEditorOutpaintRatioId,
} from "@/lib/image-editor-outpaint-params";
import { cn } from "@/lib/utils";

const CHECKER: CSSProperties = {
  backgroundColor: "#f4efe8",
  backgroundImage:
    "linear-gradient(45deg, #d9d1c6 25%, transparent 25%), linear-gradient(-45deg, #d9d1c6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d9d1c6 75%), linear-gradient(-45deg, transparent 75%, #d9d1c6 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

type Props = {
  imageUrl: string;
  onCancel: () => void;
  onApply: (url: string) => void;
};

async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    res = await fetch(ecomMediaFetchUrl(url), { credentials: "include" });
  }
  if (!res.ok) throw new Error("读取图片失败");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

async function outpaintSourceImage(url: string): Promise<string> {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  return urlToDataUrl(url);
}

function RatioTile({
  label,
  previewW,
  previewH,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  previewW: number;
  previewH: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const boxH = 22;
  const boxW = Math.max(12, Math.round((previewW / previewH) * boxH));
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-[11px] transition-colors",
        selected
          ? "border-[#0071e3] bg-[#f0f6ff] text-[var(--ie-ink)]"
          : "border-[var(--ie-border-soft)] bg-white text-[var(--ie-muted)] hover:border-[#c4c4c4] hover:text-[var(--ie-ink)]",
        disabled && "opacity-50",
      )}
      onClick={onSelect}
    >
      <span
        className={cn("rounded-[3px] border", selected ? "border-[#0071e3]" : "border-[#b8b8b8]")}
        style={{ width: boxW, height: boxH }}
        aria-hidden
      />
      <span className="leading-none">{label}</span>
    </button>
  );
}

export function ImageEditorOutpaintWorkspace({ imageUrl, onCancel, onApply }: Props) {
  const { alert } = useDialogs();
  const [running, setRunning] = useState(false);
  const [model, setModel] = useState(IMAGE_EDITOR_OUTPAINT_MODEL);
  const [scalePercent, setScalePercent] = useState(IMAGE_EDITOR_OUTPAINT_SCALE_DEFAULT);
  const [ratioId, setRatioId] = useState<ImageEditorOutpaintRatioId>("original");
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [loadError, setLoadError] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneSize, setPaneSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const src = await urlToDataUrl(imageUrl);
        if (cancelled) return;
        setDisplayUrl(src);
        setLoadError(false);
        const img = new Image();
        img.onload = () => {
          if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.onerror = () => {
          if (!cancelled) setLoadError(true);
        };
        img.src = src;
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setDisplayUrl(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    fetchImageProcessingModels()
      .then((data) => {
        if (data.defaults?.outpaint) setModel(data.defaults.outpaint);
      })
      .catch(() => {
        /* 使用默认百炼扩图模型 */
      });
  }, []);

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setPaneSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scaleOnly = ratioId === "original";

  const layout = useMemo(
    () => computeImageEditorOutpaintPreviewLayout(natural.w, natural.h, ratioId, scalePercent),
    [natural.h, natural.w, ratioId, scalePercent],
  );

  const previewTransform = useMemo(() => {
    const pad = 48;
    const maxW = Math.max(1, paneSize.w - pad);
    const maxH = Math.max(1, paneSize.h - pad);
    const fit = Math.min(maxW / layout.frameW, maxH / layout.frameH, 1);
    const framePxW = layout.frameW * fit;
    const framePxH = layout.frameH * fit;
    const imgPxW = layout.imgW * fit;
    const imgPxH = layout.imgH * fit;
    return { fit, framePxW, framePxH, imgPxW, imgPxH };
  }, [layout, paneSize.h, paneSize.w]);

  const setScale = (value: number) => setScalePercent(clampOutpaintScalePercent(value));

  const runGenerate = useCallback(async () => {
    if (!displayUrl || natural.w <= 0) {
      await alert({ title: "无法扩图", message: "图片尚未加载完成，请稍候。", variant: "error" });
      return;
    }
    setRunning(true);
    try {
      const sourceImageDataUrl = await outpaintSourceImage(imageUrl);
      const parameters = buildImageEditorOutpaintParameters(ratioId, scalePercent);
      const res = await submitImageProcessingEdit({
        mode: "outpaint",
        model,
        sourceImageDataUrl,
        parameters,
      });
      const editedUrl = res.imageUrls[0];
      if (!editedUrl) throw new Error("未获得扩图结果");
      onApply(editedUrl);
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        await alert({
          title: "请先登录",
          message: "登录后可使用 AI 扩图。",
          variant: "error",
        });
        return;
      }
      await alert({
        title: "扩图失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRunning(false);
    }
  }, [alert, displayUrl, imageUrl, model, natural.w, onApply, ratioId, scalePercent]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-[var(--ie-cream)]">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-[var(--ie-border-soft)]">
        <div className="flex items-center gap-2 border-b border-[var(--ie-border-soft)] px-3 py-2.5">
          <button
            type="button"
            aria-label="返回"
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)]"
            onClick={onCancel}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <h2 className="text-sm font-semibold text-[var(--ie-ink)]">AI扩图</h2>
          <span title="按选定比例与扩展尺寸向外生成画面">
            <CircleHelp className="h-3.5 w-3.5 text-[var(--ie-muted)]" aria-hidden />
          </span>
        </div>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--ie-ink)]">扩展尺寸</span>
              {!scaleOnly ? (
                <span className="text-[11px] text-[var(--ie-muted)]">指定比例时自动适配</span>
              ) : null}
            </div>
            <div
              className={cn(
                "rounded-xl border border-[var(--ie-border-soft)] bg-white px-3 py-3",
                !scaleOnly && "opacity-55",
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={IMAGE_EDITOR_OUTPAINT_SCALE_MIN}
                  max={IMAGE_EDITOR_OUTPAINT_SCALE_MAX}
                  value={scalePercent}
                  disabled={running || !scaleOnly}
                  aria-label="扩展尺寸百分比"
                  className="min-w-0 flex-1 accent-[#0071e3]"
                  onChange={(e) => setScale(Number(e.target.value))}
                />
                <div className="flex items-center rounded-md border border-[var(--ie-border-soft)] bg-[var(--ie-cream)]">
                  <input
                    type="number"
                    min={IMAGE_EDITOR_OUTPAINT_SCALE_MIN}
                    max={IMAGE_EDITOR_OUTPAINT_SCALE_MAX}
                    value={scalePercent}
                    disabled={running || !scaleOnly}
                    aria-label="扩展尺寸数值"
                    className="w-11 border-0 bg-transparent py-1 text-center text-[12px] text-[var(--ie-ink)] focus:outline-none"
                    onChange={(e) => setScale(Number(e.target.value))}
                  />
                  <span className="pr-2 text-[11px] text-[var(--ie-muted)]">%</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 text-[13px] font-medium text-[var(--ie-ink)]">扩展比例</div>
            <div className="grid grid-cols-4 gap-2">
              {IMAGE_EDITOR_OUTPAINT_RATIO_TILES.map((tile) => (
                <RatioTile
                  key={tile.id}
                  label={tile.label}
                  previewW={tile.previewW}
                  previewH={tile.previewH}
                  selected={ratioId === tile.id}
                  disabled={running}
                  onSelect={() => setRatioId(tile.id)}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-2 border-t border-[var(--ie-border-soft)] p-3">
          <div className="flex gap-2">
            <EcomButtonSecondary type="button" className="h-10 flex-1" disabled={running} onClick={onCancel}>
              退出
            </EcomButtonSecondary>
            <EcomButtonPrimary
              type="button"
              fullWidth
              className="h-10 min-w-0 flex-[1.4] !max-w-none"
              disabled={running || !displayUrl}
              onClick={() => void runGenerate()}
            >
              {running ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  生成中…
                </>
              ) : (
                "立即生成"
              )}
            </EcomButtonPrimary>
          </div>
          <ImageEditorAiGenDisclaimer />
        </div>
      </aside>

      <div
        ref={paneRef}
        className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center p-4"
        style={CHECKER}
      >
        {loadError ? (
          <p className="text-sm text-[var(--ie-muted)]">无法加载图片预览</p>
        ) : displayUrl && natural.w > 0 ? (
          <div
            className="relative"
            style={{ width: previewTransform.framePxW, height: previewTransform.framePxH }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-sm border-2 border-[#0071e3]"
              aria-hidden
            />
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden shadow-sm"
              style={{
                width: previewTransform.imgPxW,
                height: previewTransform.imgPxH,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayUrl}
                alt="扩图预览"
                className="block h-full w-full object-contain"
                draggable={false}
              />
            </div>
          </div>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-[var(--ie-muted)]" aria-label="加载中" />
        )}
      </div>
    </div>
  );
}