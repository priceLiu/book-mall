"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Shuffle,
  Sparkles,
  Trash2,
} from "lucide-react";

import { ImageEditorAiGenDisclaimer } from "@/components/image-editor/image-editor-ai-gen-disclaimer";
import { ImageEditorAiGenStyleModal } from "@/components/image-editor/image-editor-ai-gen-style-modal";
import { ImageEditorAiGenStyleQuickTile } from "@/components/image-editor/image-editor-ai-gen-style-quick-tile";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  IMAGE_EDITOR_AI_GEN_ASPECTS,
  IMAGE_EDITOR_AI_GEN_COUNTS,
  IMAGE_EDITOR_AI_GEN_PROMPT_HINTS,
  IMAGE_EDITOR_AI_GEN_PROMPT_MAX,
  IMAGE_EDITOR_AI_GEN_PROMPT_SNIPPETS,
} from "@/lib/image-editor-ai-gen-catalog";
import {
  IMAGE_EDITOR_AI_GEN_FEATURED_IDS,
  getAiGenStyleModel,
  resolveAiGenStylePrompt,
  type AiGenStyleModel,
} from "@/lib/image-editor-ai-gen-style-models";
import { fetchImageProcessingModels, submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomMediaFetchUrl } from "@/lib/ecom-media-download";
import { cn } from "@/lib/utils";

const FALLBACK_MODEL = "doubao-seedream-5-0-lite";

type Props = {
  /** 画布当前图，可选作参考图 */
  canvasImageUrl?: string | null;
  onCancel: () => void;
  onApply: (url: string) => void;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function AspectWire({ w, h }: { w: number; h: number }) {
  const max = 22;
  const scale = max / Math.max(w, h);
  const bw = Math.round(w * scale);
  const bh = Math.round(h * scale);
  return (
    <span
      className="inline-block shrink-0 rounded-sm border-2 border-current"
      style={{ width: bw, height: bh }}
      aria-hidden
    />
  );
}

export function ImageEditorAiGenWorkspace({ canvasImageUrl, onCancel, onApply }: Props) {
  const { alert } = useDialogs();
  const refInputRef = useRef<HTMLInputElement>(null);

  const [model, setModel] = useState(FALLBACK_MODEL);
  const [prompt, setPrompt] = useState("");
  const [styleKey, setStyleKey] = useState<string>(IMAGE_EDITOR_AI_GEN_FEATURED_IDS[0]);
  const [quickStyleIds, setQuickStyleIds] = useState<string[]>(() => [...IMAGE_EDITOR_AI_GEN_FEATURED_IDS]);
  const [aspect, setAspect] = useState<(typeof IMAGE_EDITOR_AI_GEN_ASPECTS)[number]["id"]>("3:4");
  const [imageCount, setImageCount] = useState<(typeof IMAGE_EDITOR_AI_GEN_COUNTS)[number]>("4");
  const [refDataUrl, setRefDataUrl] = useState<string | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [stylesOpen, setStylesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchImageProcessingModels()
      .then((data) => {
        if (cancelled) return;
        const key = data.defaults?.imageGenerator?.trim();
        if (key) setModel(key);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pickRefFile = () => refInputRef.current?.click();

  const selectStyle = useCallback((model: AiGenStyleModel) => {
    setStyleKey(model.id);
    setQuickStyleIds((prev) => {
      if (prev.includes(model.id)) return prev;
      const next = [...prev];
      next[next.length - 1] = model.id;
      return next;
    });
  }, []);

  const onRefFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setRefDataUrl(dataUrl);
      setRefPreview(dataUrl);
    } catch {
      await alert({ title: "上传失败", message: "无法读取该图片。", variant: "error" });
    }
  };

  const useCanvasAsRef = useCallback(async () => {
    if (!canvasImageUrl) {
      await alert({ title: "无画布图片", message: "请先在编辑器中打开一张图片。", variant: "error" });
      return;
    }
    if (canvasImageUrl.startsWith("data:") || canvasImageUrl.startsWith("blob:")) {
      setRefDataUrl(canvasImageUrl);
      setRefPreview(canvasImageUrl);
      return;
    }
    try {
      const res = await fetch(ecomMediaFetchUrl(canvasImageUrl), { credentials: "include" });
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const dataUrl = await fileToDataUrl(new File([blob], "ref.jpg", { type: blob.type || "image/jpeg" }));
      setRefDataUrl(dataUrl);
      setRefPreview(dataUrl);
    } catch {
      setRefDataUrl(canvasImageUrl);
      setRefPreview(ecomMediaFetchUrl(canvasImageUrl));
    }
  }, [alert, canvasImageUrl]);

  const generate = useCallback(async () => {
    const text = prompt.trim();
    if (!text) {
      await alert({ title: "请填写提示词", message: "描述你想要的画面内容。", variant: "error" });
      return;
    }
    setRunning(true);
    const { prompt: styledPrompt, styleId } = resolveAiGenStylePrompt(text, styleKey);
    const n = Number(imageCount) || 1;
    try {
      const res = await submitImageProcessingEdit({
        mode: "image-generator",
        prompt: styledPrompt,
        generativeModel: model,
        styleId,
        styleImageDataUrl: refDataUrl ?? undefined,
        parameters: {
          aspect_ratio: aspect,
          n,
        },
      });
      const urls = res.imageUrls.filter(Boolean);
      if (urls.length === 0) throw new Error("未获得生成结果");
      setResults(urls);
      setSelected(0);
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        await alert({ title: "请先登录", message: "登录后可使用 AI 生图。", variant: "error" });
        return;
      }
      await alert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRunning(false);
    }
  }, [alert, aspect, imageCount, model, prompt, refDataUrl, styleKey]);

  const currentUrl = results[selected] ?? null;

  const downloadCurrent = async () => {
    if (!currentUrl) return;
    try {
      const res = await fetch(ecomMediaFetchUrl(currentUrl), { credentials: "include" });
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `ai-gen-${selected + 1}.png`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      await alert({ title: "下载失败", message: "请检查网络后重试。", variant: "error" });
    }
  };

  const applySelected = () => {
    if (!currentUrl) {
      void alert({ title: "暂无结果", message: "请先生成图片。", variant: "error" });
      return;
    }
    onApply(currentUrl);
  };

  const insertSnippet = (snippet: string) => {
    setPrompt((prev) => {
      const next = prev.trim() ? `${prev.trim()}，${snippet}` : snippet;
      return next.slice(0, IMAGE_EDITOR_AI_GEN_PROMPT_MAX);
    });
  };

  const shufflePrompt = () => {
    const pick = IMAGE_EDITOR_AI_GEN_PROMPT_HINTS[Math.floor(Math.random() * IMAGE_EDITOR_AI_GEN_PROMPT_HINTS.length)]!;
    setPrompt(pick.slice(0, IMAGE_EDITOR_AI_GEN_PROMPT_MAX));
  };

  const smartSuggest = () => {
    const pick = IMAGE_EDITOR_AI_GEN_PROMPT_SNIPPETS[Math.floor(Math.random() * IMAGE_EDITOR_AI_GEN_PROMPT_SNIPPETS.length)]!;
    insertSnippet(pick);
  };

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
          <h2 className="text-sm font-semibold text-[var(--ie-ink)]">AI生图</h2>
        </div>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
          <section>
            <div className="mb-1.5 text-[13px] font-medium text-[var(--ie-ink)]">提示词</div>
            <div className="rounded-xl border border-[var(--ie-border-soft)] bg-white p-2.5">
              <textarea
                value={prompt}
                disabled={running}
                rows={4}
                maxLength={IMAGE_EDITOR_AI_GEN_PROMPT_MAX}
                placeholder="请输入你的创意。双引号可加文字，如“新年快乐”。括号可加权重，如(中国风)。"
                className="w-full resize-none border-0 bg-transparent text-[13px] text-[var(--ie-ink)] placeholder:text-[var(--ie-muted)] focus:outline-none disabled:opacity-50"
                onChange={(e) => setPrompt(e.target.value.slice(0, IMAGE_EDITOR_AI_GEN_PROMPT_MAX))}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--ie-border-soft)] pt-2">
                <button
                  type="button"
                  disabled={running}
                  className="rounded-md bg-[var(--ie-cream-muted)] px-2 py-1 text-[11px] text-[var(--ie-ink)] disabled:opacity-40"
                  onClick={smartSuggest}
                >
                  智能联想
                </button>
                <button
                  type="button"
                  disabled={running}
                  className="rounded-md bg-[var(--ie-cream-muted)] px-2 py-1 text-[11px] text-[var(--ie-ink)] disabled:opacity-40"
                  onClick={() => insertSnippet(IMAGE_EDITOR_AI_GEN_PROMPT_SNIPPETS[0]!)}
                >
                  词库
                </button>
                <button
                  type="button"
                  disabled={running}
                  aria-label="随机示例"
                  className="ml-auto grid h-7 w-7 place-items-center rounded-md text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
                  onClick={shufflePrompt}
                >
                  <Shuffle className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="tabular-nums text-[11px] text-[var(--ie-muted)]">
                  {prompt.length} / {IMAGE_EDITOR_AI_GEN_PROMPT_MAX}
                </span>
                <button
                  type="button"
                  disabled={running || !prompt}
                  aria-label="清空提示词"
                  className="grid h-7 w-7 place-items-center rounded-md text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
                  onClick={() => setPrompt("")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          </section>

          <section>
            <button
              type="button"
              disabled={running}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--ie-border-soft)] bg-white px-3 py-2.5 text-left disabled:opacity-50"
              onClick={pickRefFile}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashed border-[#93c5fd] bg-[#eff6ff]">
                {refPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={refPreview} alt="" className="h-full w-full rounded-lg object-cover" />
                ) : (
                  <Plus className="h-5 w-5 rounded-full border border-[#93c5fd] p-0.5 text-[#3b82f6]" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1 text-[13px] text-[var(--ie-ink)]">选择参考图</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ie-muted)]" aria-hidden />
            </button>
            {canvasImageUrl ? (
              <button
                type="button"
                disabled={running}
                className="mt-1.5 w-full text-left text-[11px] text-[#0071e3] hover:underline disabled:opacity-40"
                onClick={() => void useCanvasAsRef()}
              >
                使用当前画布图片作参考
              </button>
            ) : null}
            <input
              ref={refInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                void onRefFile(f);
                e.target.value = "";
              }}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--ie-ink)]">选择风格</span>
              <button
                type="button"
                className="text-[12px] text-[#0071e3]"
                onClick={() => setStylesOpen(true)}
              >
                查看更多
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {quickStyleIds.map((id) => {
                const item = getAiGenStyleModel(id);
                if (!item) return null;
                return (
                  <ImageEditorAiGenStyleQuickTile
                    key={id}
                    model={item}
                    selected={styleKey === item.id}
                    disabled={running}
                    onSelect={() => setStyleKey(item.id)}
                  />
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 text-[13px] font-medium text-[var(--ie-ink)]">比例</div>
            <div className="grid grid-cols-4 gap-2">
              {IMAGE_EDITOR_AI_GEN_ASPECTS.map((item) => {
                const on = aspect === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={running}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] disabled:opacity-50",
                      on
                        ? "border-[#0071e3] bg-white text-[#0071e3]"
                        : "border-transparent bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]",
                    )}
                    onClick={() => setAspect(item.id)}
                  >
                    <AspectWire w={item.w} h={item.h} />
                    {item.id}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 text-[13px] font-medium text-[var(--ie-ink)]">张数</div>
            <div className="grid grid-cols-4 gap-2">
              {IMAGE_EDITOR_AI_GEN_COUNTS.map((n) => {
                const on = imageCount === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={running}
                    className={cn(
                      "h-9 rounded-lg border text-[13px] disabled:opacity-50",
                      on
                        ? "border-[#0071e3] bg-white font-medium text-[#0071e3]"
                        : "border-transparent bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]",
                    )}
                    onClick={() => setImageCount(n)}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="relative z-20 space-y-2 overflow-visible border-t border-[var(--ie-border-soft)] p-3">
          <div className="flex gap-2">
            <EcomButtonSecondary type="button" className="h-10 flex-1" disabled={running} onClick={applySelected}>
              应用
            </EcomButtonSecondary>
            <EcomButtonPrimary
              type="button"
              fullWidth
              className="h-10 min-w-0 flex-[1.4] !max-w-none"
              disabled={running || !prompt.trim()}
              onClick={() => void generate()}
            >
              {running ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                  {results.length > 0 ? "再次生成" : "立即生成"}
                </>
              )}
            </EcomButtonPrimary>
          </div>
          <ImageEditorAiGenDisclaimer />
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--ie-cream-deep)] p-4">
        {currentUrl ? (
          <>
            <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center">
              <button
                type="button"
                aria-label="下载当前图"
                className="absolute right-0 top-0 z-10 grid h-9 w-9 place-items-center rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm"
                onClick={() => void downloadCurrent()}
              >
                <Download className="h-4 w-4 text-[var(--ie-ink)]" aria-hidden />
              </button>
              {results.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="上一张"
                    disabled={selected <= 0}
                    className="absolute left-0 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[var(--ie-border-soft)] bg-white shadow disabled:opacity-30"
                    onClick={() => setSelected((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="下一张"
                    disabled={selected >= results.length - 1}
                    className="absolute right-0 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[var(--ie-border-soft)] bg-white shadow disabled:opacity-30"
                    onClick={() => setSelected((i) => Math.min(results.length - 1, i + 1))}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ecomMediaFetchUrl(currentUrl)}
                alt="生成结果"
                className="max-h-full max-w-full rounded-xl border border-[var(--ie-border-soft)] object-contain shadow-sm"
              />
            </div>
            {results.length > 1 ? (
              <div className="mx-auto mt-3 flex max-w-3xl flex-wrap justify-center gap-2">
                {results.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    className={cn(
                      "h-16 w-16 overflow-hidden rounded-lg border-2",
                      idx === selected ? "border-[#0071e3]" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                    onClick={() => setSelected(idx)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ecomMediaFetchUrl(url)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-[var(--ie-muted)]">
            {running ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-[#0071e3]" aria-hidden />
                <p className="text-sm">正在生成…</p>
              </>
            ) : (
              <p className="text-sm">填写提示词并点击「立即生成」，结果将显示在右侧</p>
            )}
          </div>
        )}
      </div>

      <ImageEditorAiGenStyleModal
        open={stylesOpen}
        selectedId={styleKey}
        onOpenChange={setStylesOpen}
        onSelect={selectStyle}
      />
    </div>
  );
}