"use client";

import { useEffect, useState } from "react";

/** Marble 风格快门闪光：截图瞬间全屏白闪 */
export function QrWorldShutterFlash({ trigger }: { trigger: number }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setActive(true);
    const t = window.setTimeout(() => setActive(false), 380);
    return () => window.clearTimeout(t);
  }, [trigger]);

  if (!active) return null;

  return (
    <div
      className="qr-world-shutter-flash pointer-events-none absolute inset-0 z-[120]"
      aria-hidden
    />
  );
}
