"use client";

import { useState } from "react";

import { aiGenStyleThumbUrl, type AiGenStyleModel } from "@/lib/image-editor-ai-gen-style-models";
import { cn } from "@/lib/utils";

const FALLBACK_GRADIENT =
  "linear-gradient(145deg, var(--ie-cream-muted, #e8e4dc), var(--ie-cream-deep, #d9d1c6))";

type Props = {
  model: AiGenStyleModel;
  className?: string;
  imgClassName?: string;
  /** 侧栏六格用正方形；弹层卡片用竖版比例 */
  shape?: "square" | "portrait";
};

export function ImageEditorAiGenStyleThumb({
  model,
  className,
  imgClassName,
  shape = "portrait",
}: Props) {
  const [failed, setFailed] = useState(false);
  const src = aiGenStyleThumbUrl(model.id);
  const isSquare = shape === "square";

  if (failed) {
    return (
      <span
        className={cn(
          "block w-full",
          isSquare ? "h-full min-h-0" : "aspect-[204/288]",
          className,
        )}
        style={{ background: FALLBACK_GRADIENT }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn(
        "block w-full object-cover",
        isSquare ? "h-full min-h-0" : "aspect-[204/288]",
        imgClassName,
        className,
      )}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}