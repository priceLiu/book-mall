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

function inferExt(lang: string): string {
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
function toHtmlSrcDoc(fragmentOrFull: string): string {
  const t = fragmentOrFull.trim();
  if (/^<!DOCTYPE/i.test(t) || /<html[\s>]/i.test(t)) return t;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${t}</body></html>`;
}

function wrapJsInHtml(js: string): string {
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
    <div
      className="vl-analysis-preview-backdrop"
      role="presentation"
      onClick={onClose}
    >
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

function MarkdownCodeFence({
  children,
  onOpenPreview,
}: {
  children?: ReactNode;
  onOpenPreview: (v: PreviewState) => void;
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
    <div className="vl-analysis-code-fence">
      <div className="vl-analysis-code-fence-toolbar">
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
      <pre className="vl-analysis-code-fence-pre">
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

export function AnalysisReplyMarkdown({
  markdown,
  onSaveReplyMedia,
}: {
  markdown: string;
  onSaveReplyMedia: (url: string, kind: "reply-image" | "reply-video") => Promise<void>;
}) {
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const wrapSave = useCallback(
    async (url: string, kind: "reply-image" | "reply-video") => {
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
      pre: ({ children }) => <MarkdownCodeFence onOpenPreview={setPreview}>{children}</MarkdownCodeFence>,
    }),
    [busyUrl, wrapSave],
  );

  return (
    <>
      <div className="vl-analysis-reply-toolbar">
        <button
          type="button"
          className="vl-analysis-code-fence-btn"
          onClick={() => downloadText(`${replyDownloadBasename()}.md`, markdown, "text/markdown")}
        >
          下载回复（Markdown）
        </button>
      </div>
      <div className="vl-analysis-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </ReactMarkdown>
      </div>
      {preview ? <HtmlPreviewDialog state={preview} onClose={() => setPreview(null)} /> : null}
    </>
  );
}
