"use client";

import {
  type ReactElement,
  type ReactNode,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { looksLikeVideoUrl } from "@/lib/visual-lab-gallery";

function safeHttpUrl(href: string | undefined): string | null {
  if (!href || /^\s*javascript:/i.test(href)) return null;
  if (href.startsWith("data:")) return null;
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return href;
  } catch {
    return null;
  }
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function inferExt(lang: string): string {
  const m: Record<string, string> = {
    js: "js",
    javascript: "js",
    mjs: "mjs",
    ts: "ts",
    typescript: "ts",
    tsx: "tsx",
    jsx: "jsx",
    html: "html",
    htm: "html",
    svg: "svg",
    css: "css",
    scss: "scss",
    json: "json",
    md: "md",
    py: "py",
    python: "py",
    sh: "sh",
    bash: "sh",
    shell: "sh",
    rs: "rs",
    rust: "rs",
    go: "go",
    java: "java",
    sql: "sql",
    yaml: "yaml",
    yml: "yml",
    xml: "xml",
  };
  return m[lang] ?? "txt";
}

/** 片段补全为可放入 iframe 的文档 */
export function toHtmlSrcDoc(fragmentOrFull: string): string {
  const t = fragmentOrFull.trim();
  if (/^<!DOCTYPE/i.test(t) || /<html[\s>]/i.test(t)) return t;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${t}</body></html>`;
}

export function wrapJsInHtml(js: string): string {
  const safe = js.replace(/<\/script/gi, "<\\/script");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JS 预览</title></head><body><script>
try {
${safe}
} catch (e) {
  document.body.innerHTML = '<pre style="color:#b91c1c;padding:1rem;font-family:ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;margin:0">'+String(e)+'</pre>';
}
<\/script></body></html>`;
}

function replyDownloadBasename(): string {
  try {
    const s = new Date().toISOString().replace(/[:-]/g, "").replace("T", "-").slice(0, 15);
    return `visual-lab-reply-${s}`;
  } catch {
    return "visual-lab-reply";
  }
}

function ReplyToolStrip({
  markdown,
  downloadBase,
  variant,
}: {
  markdown: string;
  downloadBase: string;
  variant: "full" | "downloadMdOnly";
}) {
  const label =
    variant === "full" ? "回复导出与复制" : "回复底部：仅下载 Markdown";
  return (
    <div className="vl-analysis-reply-toolbar" role="toolbar" aria-label={label}>
      <button
        type="button"
        className="vl-analysis-code-fence-btn"
        onClick={() => downloadText(`${downloadBase}.md`, markdown, "text/markdown")}
      >
        下载回复（Markdown）
      </button>
      {variant === "full" ? (
        <>
          <button
            type="button"
            className="vl-analysis-code-fence-btn"
            onClick={() => {
              void navigator.clipboard.writeText(markdown).catch(() => {
                /* ignore */
              });
            }}
          >
            复制全文
          </button>
          <button
            type="button"
            className="vl-analysis-code-fence-btn"
            onClick={() => downloadText(`${downloadBase}.txt`, markdown, "text/plain")}
          >
            下载纯文本
          </button>
        </>
      ) : null}
    </div>
  );
}

type PreviewState = { title: string; srcDoc: string };

function HtmlPreviewDialog({ state, onClose }: { state: PreviewState; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="vl-analysis-preview-backdrop" role="presentation" onClick={onClose}>
      <div
        className="vl-analysis-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={state.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="vl-analysis-preview-header">
          <span className="vl-analysis-preview-title">{state.title}</span>
          <button type="button" className="vl-analysis-code-fence-btn" onClick={onClose}>
            关闭
          </button>
        </header>
        <p className="vl-analysis-preview-hint">
          模型输出在浏览器隔离 iframe 中展示（allow-scripts）。请勿运行不可信代码；外链与脚本风险自负。
        </p>
        <iframe
          title={state.title}
          className="vl-analysis-preview-iframe"
          srcDoc={state.srcDoc}
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}

function extractCodeElement(children: ReactNode): ReactElement | null {
  if (isValidElement(children) && children.type === "code") {
    return children;
  }
  if (Array.isArray(children)) {
    for (const c of children) {
      if (isValidElement(c) && c.type === "code") return c;
    }
  }
  return null;
}

function CodeFenceToolbar({
  lang,
  code,
  onOpenPreview,
  placement,
}: {
  lang: string;
  code: string;
  onOpenPreview: (v: PreviewState) => void;
  placement: "top" | "bottom";
}) {
  const onCopy = () => {
    void navigator.clipboard.writeText(code).catch(() => {
      /* ignore */
    });
  };
  const onDownloadSnippet = () => {
    downloadText(`snippet.${inferExt(lang)}`, code, "text/plain");
  };
  const showHtmlPreview = lang === "html" || lang === "htm";
  const showJsRun = lang === "js" || lang === "javascript" || lang === "mjs";

  return (
    <div
      className={
        "vl-analysis-code-fence-toolbar" +
        (placement === "bottom" ? " vl-analysis-code-fence-toolbar--bottom" : "")
      }
      role="toolbar"
      aria-label={placement === "top" ? "代码块顶部操作" : "代码块底部操作"}
    >
      <span className="vl-analysis-code-fence-lang">{lang || "text"}</span>
      <button type="button" className="vl-analysis-code-fence-btn" onClick={onCopy}>
        复制
      </button>
      <button type="button" className="vl-analysis-code-fence-btn" onClick={onDownloadSnippet}>
        下载片段
      </button>
      {showHtmlPreview ? (
        <button
          type="button"
          className="vl-analysis-code-fence-btn vl-analysis-code-fence-btn--accent"
          onClick={() => onOpenPreview({ title: "HTML 预览", srcDoc: toHtmlSrcDoc(code) })}
        >
          预览
        </button>
      ) : null}
      {showJsRun ? (
        <button
          type="button"
          className="vl-analysis-code-fence-btn vl-analysis-code-fence-btn--accent"
          onClick={() => onOpenPreview({ title: "JavaScript 运行", srcDoc: wrapJsInHtml(code) })}
        >
          运行
        </button>
      ) : null}
    </div>
  );
}

function MarkdownCodeFence({
  children,
  onOpenPreview,
  showBottomToolbar = true,
}: {
  children?: ReactNode;
  onOpenPreview: (v: PreviewState) => void;
  /** 流式输出时关底部条，避免容器增高导致跟滚抖动；结束后再显示 */
  showBottomToolbar?: boolean;
}) {
  const codeEl = extractCodeElement(children);
  if (!codeEl) {
    return <pre className="vl-analysis-code-fence-pre vl-analysis-code-fence-pre--raw">{children}</pre>;
  }
  const p = codeEl.props as { className?: string; children?: ReactNode };
  const className = p.className ?? "";
  const code = String(p.children ?? "").replace(/\n$/, "");
  const match = /language-([\w-]+)/i.exec(className);
  const lang = (match?.[1] ?? "").toLowerCase();

  return (
    <div className="vl-analysis-code-fence">
      <CodeFenceToolbar lang={lang} code={code} onOpenPreview={onOpenPreview} placement="top" />
      <pre className="vl-analysis-code-fence-pre">
        <code className={className}>{code}</code>
      </pre>
      {showBottomToolbar ? (
        <CodeFenceToolbar lang={lang} code={code} onOpenPreview={onOpenPreview} placement="bottom" />
      ) : null}
    </div>
  );
}

export type AnalysisReplyMarkdownProps = {
  markdown: string;
  /** 分析室传入；成果展详情不传则隐藏「存入成果」 */
  onSaveReplyMedia?: (url: string, kind: "reply-image" | "reply-video") => Promise<void>;
  /** 成果展弹层内关闭回复级导出条，仅保留代码块工具栏 */
  showReplyExportToolbars?: boolean;
  /** 分析室流式进行中：隐藏代码块底部工具条与回复区底部「下载 Markdown」，减轻跟滚抖动 */
  replyStreaming?: boolean;
};

export function AnalysisReplyMarkdown({
  markdown,
  onSaveReplyMedia,
  showReplyExportToolbars = true,
  replyStreaming = false,
}: AnalysisReplyMarkdownProps) {
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  /* 新一段 reply 时换新前缀，避免连续两轮下载重名；basename 本身与时间有关 */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 依赖 markdown 表示「本轮回复」变化
  const downloadBase = useMemo(() => replyDownloadBasename(), [markdown]);

  const wrapSave = useCallback(
    async (url: string, kind: "reply-image" | "reply-video") => {
      if (!onSaveReplyMedia) return;
      if (busyUrl) return;
      setBusyUrl(url);
      try {
        await onSaveReplyMedia(url, kind);
      } finally {
        setBusyUrl(null);
      }
    },
    [busyUrl, onSaveReplyMedia],
  );

  const components: Partial<Components> = useMemo(
    () => ({
      img: ({ src, alt }) => {
        const u = safeHttpUrl(src ?? undefined);
        if (!u) {
          // eslint-disable-next-line @next/next/no-img-element -- model may return data URLs
          return <img src={src ?? ""} alt={alt ?? ""} className="vl-analysis-md-img" loading="lazy" />;
        }
        if (!onSaveReplyMedia) {
          // eslint-disable-next-line @next/next/no-img-element
          return <img src={u} alt={alt ?? ""} className="vl-analysis-md-img" loading="lazy" />;
        }
        return (
          <span className="vl-analysis-md-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={alt ?? ""} className="vl-analysis-md-img" loading="lazy" />
            <button
              type="button"
              className="vl-analysis-md-save"
              disabled={busyUrl !== null}
              onClick={() => void wrapSave(u, "reply-image")}
            >
              {busyUrl === u ? "…" : "存入成果"}
            </button>
          </span>
        );
      },
      a: ({ href, children }) => {
        const u = safeHttpUrl(href ?? undefined);
        if (u && looksLikeVideoUrl(u)) {
          if (!onSaveReplyMedia) {
            return (
              <span className="vl-analysis-md-figure vl-analysis-md-figure--video">
                <video src={u} className="vl-analysis-md-video" controls playsInline preload="metadata" />
              </span>
            );
          }
          return (
            <span className="vl-analysis-md-figure vl-analysis-md-figure--video">
              <video src={u} className="vl-analysis-md-video" controls playsInline preload="metadata" />
              <button
                type="button"
                className="vl-analysis-md-save"
                disabled={busyUrl !== null}
                onClick={() => void wrapSave(u, "reply-video")}
              >
                {busyUrl === u ? "…" : "存入成果"}
              </button>
            </span>
          );
        }
        if (!u) {
          return <span className="vl-analysis-md-inline-link">{children}</span>;
        }
        return (
          <a href={u} target="_blank" rel="noopener noreferrer" className="vl-analysis-md-a">
            {children}
          </a>
        );
      },
      pre: ({ children }) => (
        <MarkdownCodeFence
          onOpenPreview={setPreview}
          showBottomToolbar={!replyStreaming}
        >
          {children}
        </MarkdownCodeFence>
      ),
    }),
    [busyUrl, onSaveReplyMedia, wrapSave, replyStreaming],
  );

  return (
    <>
      {showReplyExportToolbars ? (
        <ReplyToolStrip markdown={markdown} downloadBase={downloadBase} variant="full" />
      ) : null}
      <div className="vl-analysis-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </ReactMarkdown>
      </div>
      {showReplyExportToolbars && !replyStreaming ? (
        <ReplyToolStrip markdown={markdown} downloadBase={downloadBase} variant="downloadMdOnly" />
      ) : null}
      {preview ? <HtmlPreviewDialog state={preview} onClose={() => setPreview(null)} /> : null}
    </>
  );
}
