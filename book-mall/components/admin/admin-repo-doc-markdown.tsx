"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import { AdminDocMarkdownImage } from "@/components/admin/admin-doc-markdown-image";
import { resolveRepoDocAssetPath } from "@/lib/admin/read-repo-doc-path";
import { cn } from "@/lib/utils";

function docAssetApiUrl(docPath: string, src: string | undefined): string | undefined {
  if (!src) return undefined;
  const assetPath = resolveRepoDocAssetPath(docPath, src);
  if (!assetPath) return src;
  return `/api/admin/pending-features/doc/asset?path=${encodeURIComponent(assetPath)}`;
}

function buildMarkdownComponents(docPath?: string): Components {
  return {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-8 border-b border-[#d0d7de] pb-2 text-2xl font-bold text-[#1f2328] first:mt-0 sm:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-8 text-xl font-semibold text-[#1f2328] first:mt-0 sm:text-2xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-lg font-semibold text-[#1f2328] first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-5 text-base font-semibold text-[#1f2328] first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-4 leading-7 text-[#1f2328] last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-6 leading-7 text-[#1f2328]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-1.5 pl-6 leading-7 text-[#1f2328]">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-4 border-[#0969da]/40 bg-[#f6f8fa] px-4 py-3 text-[#424a53]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-[#d0d7de]" />,
  a: ({ href, children }) => (
    <a
      href={href ?? "#"}
      className="text-[#0969da] underline underline-offset-2 hover:text-[#0550ae]"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-[#1f2328]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, "");
    const isBlock = Boolean(className?.startsWith("language-"));
    if (isBlock) {
      return (
        <code className="block overflow-x-auto whitespace-pre font-mono text-[0.8125rem] leading-relaxed text-[#1f2328]">
          {text}
        </code>
      );
    }
    return (
      <code className="rounded bg-[#eef1f4] px-1.5 py-0.5 font-mono text-[0.875em] text-[#1f2328]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg border border-[#d0d7de] bg-[#f6f8fa] p-4">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-[#d0d7de]">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#f6f8fa]">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-[#d0d7de]">{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-[#fafbfc]">{children}</tr>,
  th: ({ children }) => (
    <th className="border border-[#d0d7de] px-3 py-2 text-left text-xs font-semibold text-[#1f2328] whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-[#d0d7de] px-3 py-2 align-top text-xs leading-relaxed text-[#424a53] whitespace-normal break-words min-w-[6rem] max-w-[28rem]">
      {children}
    </td>
  ),
  img: ({ src, alt }) => {
    const resolved = docPath ? docAssetApiUrl(docPath, src) : src;
    if (!resolved) return null;
    return <AdminDocMarkdownImage src={resolved} alt={alt ?? ""} />;
  },
  };
}

export function AdminRepoDocMarkdown({
  content,
  docPath,
  className,
}: {
  content: string;
  /** 当前 Markdown 在仓库内的相对路径，用于解析 `./foo.png` */
  docPath?: string;
  className?: string;
}) {
  return (
    <article className={cn("w-full min-w-0 text-[#1f2328]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={buildMarkdownComponents(docPath)}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
