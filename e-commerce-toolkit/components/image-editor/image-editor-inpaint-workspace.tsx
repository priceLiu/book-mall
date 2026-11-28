"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brush, CircleHelp, Eraser, Loader2 } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { ImageMaskCanvas, type ImageMaskCanvasHandle } from "@/components/image-processing/image-mask-canvas";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomMediaFetchUrl } from "@/lib/ecom-media-download";
import {
  missingLocalEditSelectionMessage,
  resolveLocalEditSelectionPayload,
} from "@/lib/image-layer-local-edit-payload";
import { cn } from "@/lib/utils";

const RETOUCH_MODEL = "qwen-image-edit-max";

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

async function retouchSourceImage(url: string): Promise<string> {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  return urlToDataUrl(url);
}

export function ImageEditorInpaintWorkspace({ imageUrl, onCancel, onApply }: Props) {
  const { alert } = useDialogs();
  const canvasRef = useRef<ImageMaskCanvasHandle>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [paneBox, setPaneBox] = useState<{ w: number; h: number } | null>(null);
  const [maskTool, setMaskTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(30);
  const [hasMask, setHasMask] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const url =
          imageUrl.startsWith("http") || imageUrl.startsWith("data:")
            ? imageUrl
            : await urlToDataUrl(imageUrl);
        if (!cancelled) {
          setDisplayUrl(url);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setDisplayUrl(null);
          setLoadError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const update = () => {
      setPaneBox({ w: Math.max(200, el.clientWidth - 48), h: Math.max(200, el.clientHeight - 48) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setSize = (value: number) => setBrushSize(Math.min(80, Math.max(8, Math.round(value) || 8)));

  const clearMask = useCallback(() => {
    canvasRef.current?.clearMask();
    setHasMask(false);
  }, []);

  const runGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      await alert({
        title: "请描述你的创意",
        message: "说明涂抹区域要修改成什么内容。",
        variant: "error",
      });
      return;
    }
    const selection = resolveLocalEditSelectionPayload({
      model: RETOUCH_MODEL,
      mask: canvasRef.current?.getMaskDataUrl() ?? undefined,
      natural: canvasRef.current?.getNaturalSize(),
    });
    if (!selection.maskImageDataUrl && !selection.bbox) {
      const missing = missingLocalEditSelectionMessage(RETOUCH_MODEL);
      await alert({ ...missing, variant: "error" });
      return;
    }
    setRunning(true);
    try {
      const sourceImageDataUrl = await retouchSourceImage(imageUrl);
      const res = await submitImageProcessingEdit({
        mode: "retouch",
        model: RETOUCH_MODEL,
        generativeModel: RETOUCH_MODEL,
        prompt: prompt.trim(),
        sourceImageDataUrl,
        maskImageDataUrl: selection.maskImageDataUrl,
        bbox: selection.bbox,
      });
      const editedUrl = res.imageUrls[0];
      if (!editedUrl) throw new Error("未获得重绘结果");
      onApply(editedUrl);
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        await alert({
          title: "请先登录",
          message: "登录后可使用局部重绘。",
          variant: "error",
        });
        return;
      }
      await alert({
        title: "局部重绘失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRunning(false);
    }
  }, [alert, imageUrl, onApply, prompt]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-[var(--ie-cream)]">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-[var(--ie-border-soft)]">
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="text-sm font-semibold text-[var(--ie-ink)]">局部重绘</h2>
            <span title="涂抹要修改的区域并描述期望效果">
              <CircleHelp className="h-3.5 w-3.5 shrink-0 text-[var(--ie-muted)]" aria-hidden />
            </span>
          </div>
        </div>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--ie-ink)]">涂抹选区</span>
              <button
                type="button"
                disabled={running || !hasMask}
                className="text-[12px] text-[var(--ie-muted)] hover:text-[var(--ie-ink)] disabled:opacity-40"
                onClick={clearMask}
              >
                重置
              </button>
            </div>
            <div className="rounded-xl border border-[var(--ie-border-soft)] bg-white p-3">
              <div className="flex items-center gap-2">
                <EcomIconButton
                  label="笔刷涂抹"
                  icon={Brush}
                  variant={maskTool === "brush" ? "accent" : "default"}
                  disabled={running}
                  onClick={() => setMaskTool("brush")}
                />
                <EcomIconButton
                  label="橡皮擦"
                  icon={Eraser}
                  variant={maskTool === "eraser" ? "accent" : "default"}
                  disabled={running}
                  onClick={() => setMaskTool("eraser")}
                />
                <input
                  type="range"
                  min={8}
                  max={80}
                  value={brushSize}
                  disabled={running}
                  aria-label="画笔大小"
                  className="min-w-0 flex-1 accent-[#0071e3]"
                  onChange={(e) => setSize(Number(e.target.value))}
                />
                <input
                  type="number"
                  min={8}
                  max={80}
                  value={brushSize}
                  disabled={running}
                  aria-label="画笔大小数值"
                  className="w-11 rounded-md border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] py-1 text-center text-[12px] text-[var(--ie-ink)]"
                  onChange={(e) => setSize(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <section>
            <label className="block text-[13px] font-medium text-[var(--ie-ink)]">请描述你的创意</label>
            <textarea
              value={prompt}
              disabled={running}
              rows={5}
              placeholder="请描述你要修改的画面内容。"
              className="mt-2 w-full resize-none rounded-xl border border-[var(--ie-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[var(--ie-ink)] placeholder:text-[var(--ie-muted)] focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3] disabled:opacity-50"
              onChange={(e) => setPrompt(e.target.value)}
            />
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
              disabled={running || !prompt.trim()}
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
          <p className="text-center text-[10px] text-[var(--ie-muted)]">
            生成结果由 AI 产出，仅供参考
          </p>
        </div>
      </aside>

      <div
        ref={paneRef}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-[var(--ie-cream-deep)] p-4"
      >
        {loadError ? (
          <p className="text-sm text-[var(--ie-muted)]">无法加载图片预览</p>
        ) : displayUrl ? (
          <ImageMaskCanvas
            ref={canvasRef}
            imageDataUrl={displayUrl}
            brushSize={brushSize}
            showTransparentMask={false}
            maskTool={maskTool}
            mode="mask"
            hideFooter
            maxCssSize={paneBox}
            className="mx-auto"
            onMaskChange={setHasMask}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--ie-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            加载中…
          </div>
        )}
        {running ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-4 rounded-xl ring-2 ring-[#0071e3]/30",
              "bg-[var(--ie-cream-deep)]/40",
            )}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}