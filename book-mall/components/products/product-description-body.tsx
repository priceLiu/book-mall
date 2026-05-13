"use client";

import ReactMarkdown from "react-markdown";
import type { ProductDescriptionFormat } from "@prisma/client";
import { cn } from "@/lib/utils";

export function ProductDescriptionBody({
  description,
  format,
  className,
}: {
  description: string;
  format: ProductDescriptionFormat;
  className?: string;
}) {
  if (format === "MARKDOWN") {
    return (
      <div
        className={cn(
          "max-w-none text-sm leading-relaxed text-muted-foreground",
          className,
        )}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            ul: ({ children }) => (
              <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            a: ({ href, children }) => (
              <a
                href={href ?? "#"}
                className="text-primary underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            ),
            code: ({ children }) => (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            ),
            h1: ({ children }) => (
              <h3 className="mb-2 mt-5 text-base font-semibold text-foreground first:mt-0">
                {children}
              </h3>
            ),
            h2: ({ children }) => (
              <h3 className="mb-2 mt-5 text-base font-semibold text-foreground first:mt-0">
                {children}
              </h3>
            ),
            h3: ({ children }) => (
              <h4 className="mb-1.5 mt-4 text-sm font-semibold text-foreground first:mt-0">
                {children}
              </h4>
            ),
          }}
        >
          {description}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {description}
    </div>
  );
}
