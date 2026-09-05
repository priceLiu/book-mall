"use client";

/**
 * 五套整页版式模板选择：左侧列表选中、右侧看骨架快照，确认后再套用。
 * 套用会重排所有块位置，因此调用方仍走二次确认。
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  SPACE_PAGE_TEMPLATE_LIST,
  type SpacePageTemplateKey,
} from "@/lib/ai-space/space-blocks/page-templates";
import { cn } from "@/lib/utils";

import { AiSpaceOverlay } from "../ai-space-overlay";
import { SpaceTemplatePreview } from "./space-template-preview";

export function SpaceTemplatePicker({
  current,
  busy,
  onApply,
  onClose,
}: {
  current: SpacePageTemplateKey;
  busy: boolean;
  onApply: (key: SpacePageTemplateKey) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<SpacePageTemplateKey>(current);

  return (
    <AiSpaceOverlay label="选择整页版式" onClose={busy ? undefined : onClose}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[#d0d7de] bg-white shadow-xl">
        <div className="border-b border-[#eaeef2] px-5 py-4">
          <h2 className="text-base font-semibold text-[#1f2328]">选择整页版式</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#656d76]">
            版式提供骨架：套用后会按版式重排现有块的位置与尺寸档位，
            <strong>不会删除任何块</strong>；版式里用不到的块追加到页面末尾。
          </p>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ul className="min-h-0 space-y-2 overflow-y-auto border-b border-[#eaeef2] p-4 md:border-b-0 md:border-r">
            {SPACE_PAGE_TEMPLATE_LIST.map((tpl) => (
              <li key={tpl.key}>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={tpl.key === picked}
                  onClick={() => setPicked(tpl.key)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition",
                    tpl.key === picked
                      ? "border-[#0969da] bg-[#f0f6ff]"
                      : "border-[#d0d7de] hover:border-[#8c959f]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1f2328]">
                      {tpl.label}
                    </span>
                    {tpl.key === current ? (
                      <span className="rounded bg-[#0969da] px-1.5 py-0.5 text-[10px] text-white">
                        当前
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#656d76]">
                    {tpl.description}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          <div className="min-h-0 overflow-y-auto bg-[#f6f8fa] p-4">
            <p className="mb-2 text-xs font-medium text-[#1f2328]">版式快照</p>
            <SpaceTemplatePreview templateKey={picked} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#eaeef2] px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            关闭
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onApply(picked)}
          >
            套用此版式
          </Button>
        </div>
      </div>
    </AiSpaceOverlay>
  );
}
