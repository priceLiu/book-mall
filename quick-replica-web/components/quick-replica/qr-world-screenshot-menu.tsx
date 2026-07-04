"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Globe2 } from "lucide-react";

type Props = {
  disabled?: boolean;
  onScreenshot: () => void;
  onPanoramaScreenshot: () => void;
};

export function QrWorldScreenshotMenu({
  disabled,
  onScreenshot,
  onPanoramaScreenshot,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div
          className="absolute bottom-full left-1/2 z-[110] mb-2 min-w-[168px] -translate-x-1/2 overflow-hidden rounded-lg border border-white/10 bg-[#1a1f28]/95 py-1 shadow-xl backdrop-blur-md"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onScreenshot();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-white/90 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Camera className="h-4 w-4 shrink-0 text-white/70" />
            Screenshot
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onPanoramaScreenshot();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-white/90 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Globe2 className="h-4 w-4 shrink-0 text-white/70" />
            Panorama screenshot
          </button>
        </div>
      ) : null}

      <button
        type="button"
        title="截图"
        aria-label="截图"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
      >
        <Camera className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
