"use client";

/**
 * 作品墙只读渲染：编辑器的「预览」模式与公开分享页共用同一份实现。
 *
 * 用 CSS Grid 而非 react-grid-layout —— 公开页不需要拖拽逻辑，
 * 也就不必为访客加载栅格库。
 */

import { useState } from "react";

import type { AiSpacePageDto } from "@/lib/ai-space/ai-space-space-types";
import { SPACE_THEME_TOKENS } from "@/lib/ai-space/space-blocks/theme";

import { SpaceBlockContent } from "../space-blocks/renderers";
import { SpaceLightbox, type SpaceLightboxState } from "./space-lightbox";
import "./space-canvas.css";

export function SpaceCanvasView({
  page,
  className,
}: {
  page: AiSpacePageDto;
  className?: string;
}) {
  const [lightbox, setLightbox] = useState<SpaceLightboxState>(null);
  const theme = SPACE_THEME_TOKENS[page.theme.preset];

  if (page.blocks.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed p-10 text-center text-sm"
        style={{ borderColor: theme.border, color: theme.mutedText }}
      >
        这个空间还没有布置内容。
      </div>
    );
  }

  return (
    <>
      <div className={className}>
        <div className="space-canvas-grid">
          {page.blocks.map((block) => (
            <div
              key={block.id}
              className="space-canvas-item"
              style={
                {
                  "--space-x": block.layoutX + 1,
                  "--space-y": block.layoutY + 1,
                  "--space-w": block.layoutW,
                  "--space-h": block.layoutH,
                  "--space-order": block.mobileOrder,
                } as React.CSSProperties
              }
            >
              <SpaceBlockContent
                block={block}
                readOnly
                theme={theme}
                accent={page.theme.accent}
                page={{ pageTitle: page.title, pageBio: page.bio }}
                onOpenLightbox={(refs, index) => setLightbox({ refs, index })}
              />
            </div>
          ))}
        </div>
      </div>

      <SpaceLightbox state={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
