"use client";

import { useCallback, useState } from "react";
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

export function AnalysisReplyMarkdown({
  markdown,
  onSaveReplyMedia,
}: {
  markdown: string;
  onSaveReplyMedia: (url: string, kind: "reply-image" | "reply-video") => Promise<void>;
}) {
  const [busyUrl, setBusyUrl] = useState<string | null>(null);

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

  const components: Components = {
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
  };

  return (
    <div className="vl-analysis-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
