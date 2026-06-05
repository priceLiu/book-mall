"use client";

import { useEffect, useRef, useState } from "react";

import { StoryboardProSheetView } from "@/components/storyboard/storyboard-pro-sheet-view";
import type { StoryboardReference, StoryboardSheet } from "@/lib/storyboard-types";

type Props = {
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  /** 缩略图容器 id 前缀，避免与导出区冲突 */
  thumbId?: string;
};

/** 分镜图设计稿固定渲染宽度（与 StoryboardProSheetView 一致） */
const SHEET_WIDTH = 1200;

/** 完整分镜图实时缩略（直接用 panel.imageUrl，不依赖合成 PNG） */
export function StoryboardSheetLiveThumb({
  sheet,
  references,
  productName,
  productHighlight,
  projectKeywords,
  thumbId = "storyboard-sheet-thumb",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // 等比缩放铺满容器（contain），避免固定 0.3 缩放显得过小
  const [layout, setLayout] = useState({ scale: 0.3, left: 0, top: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const recompute = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const contentH = content.scrollHeight || content.offsetHeight || 0;
      if (cw <= 0 || ch <= 0 || contentH <= 0) return;
      const scale = Math.min(cw / SHEET_WIDTH, ch / contentH);
      const left = Math.max(0, (cw - SHEET_WIDTH * scale) / 2);
      const top = Math.max(0, (ch - contentH * scale) / 2);
      setLayout({ scale, left, top });
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    ro.observe(content);
    return () => ro.disconnect();
  }, [sheet, references, productName, productHighlight, projectKeywords]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-white">
      <div
        ref={contentRef}
        className="pointer-events-none absolute origin-top-left will-change-transform"
        style={{
          width: SHEET_WIDTH,
          left: layout.left,
          top: layout.top,
          transform: `scale(${layout.scale})`,
        }}
      >
        <StoryboardProSheetView
          sheet={sheet}
          references={references}
          productName={productName}
          productHighlight={productHighlight}
          projectKeywords={projectKeywords}
          exportRootId={thumbId}
          variant="preview"
        />
      </div>
    </div>
  );
}
