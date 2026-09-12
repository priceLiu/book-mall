"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMagicEditFrameScreenAnchor,
  type MagicEditFrameScreenAnchor,
} from "./libtv-magic-edit-frame-anchor";

export const LIBTV_FRAME_DOCK_GAP_PX = 8;

export function useMagicEditFrameDockPlacement(
  nodeId: string,
  active: boolean,
): MagicEditFrameScreenAnchor | null {
  const [placement, setPlacement] = useState<MagicEditFrameScreenAnchor | null>(
    null,
  );
  const lastRef = useRef<MagicEditFrameScreenAnchor | null>(null);

  useEffect(() => {
    if (!active) {
      setPlacement(null);
      return;
    }

    let raf = 0;
    const tick = () => {
      const anchor = getMagicEditFrameScreenAnchor(nodeId);
      if (anchor) {
        lastRef.current = anchor;
        setPlacement(anchor);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nodeId, active]);

  return placement ?? lastRef.current;
}
