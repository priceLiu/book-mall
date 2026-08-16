"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Native `<audio controls>` — mount on client only.
 * Browsers inject control UI (often `<div>`) into `<audio>`, which breaks SSR hydration.
 */
export function AiSpaceAudioControls({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={cn("min-h-8 bg-[#f6f8fa]", className)} aria-hidden />;
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio className={className} controls preload="none" src={src} />
  );
}
