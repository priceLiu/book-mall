"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export function ProductHeroMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("text-muted-foreground", className)}>
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-4 text-base leading-[1.85] last:mb-0 md:text-[1.0625rem] md:leading-[1.8]">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
