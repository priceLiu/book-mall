"use client";

/**
 * 属性面板：尺寸档位选择器 + 块外框设置 + 挂件专属 Inspector + 已引用素材列表。
 *
 * 挂件专属部分一律经 SpaceBlockInspectorBody 从注册表取，
 * 这里 **不得** 出现 blockType 分支。
 */

import type { AiSpaceBlockDto } from "@/lib/ai-space/ai-space-space-types";
import {
  SPACE_SIZE_TIERS,
  type SpaceSizeTierKey,
} from "@/lib/ai-space/space-blocks/size-tiers";
import { getSpaceBlockDef } from "@/lib/ai-space/space-blocks/types";
import { cn } from "@/lib/utils";

import {
  InspectorRow,
  InspectorSection,
  InspectorText,
  InspectorToggle,
} from "../space-blocks/block-kit";
import { SpaceBlockInspectorBody } from "../space-blocks/renderers";

export function SpaceBlockInspector({
  block,
  busy,
  onConfigChange,
  onContentChange,
  onTierChange,
  onRemoveRef,
  onMoveRef,
}: {
  block: AiSpaceBlockDto | null;
  busy: boolean;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onContentChange: (text: string) => void;
  onTierChange: (tier: SpaceSizeTierKey) => void;
  onRemoveRef: (refId: string) => void;
  onMoveRef: (refId: string, delta: number) => void;
}) {
  if (!block) {
    return (
      <p className="rounded-md border border-dashed border-[#d0d7de] p-4 text-center text-xs leading-relaxed text-[#656d76]">
        选中画布上的一个块来编辑它的尺寸与设置。
      </p>
    );
  }

  const def = getSpaceBlockDef(block.blockType);
  if (!def) {
    return <p className="text-xs text-[#656d76]">该挂件类型已下线。</p>;
  }

  const title = typeof block.config.title === "string" ? block.config.title : "";
  const framed = block.config.framed !== false;

  return (
    <div className={cn("space-y-5", busy ? "pointer-events-none opacity-60" : null)}>
      <div>
        <p className="text-sm font-semibold text-[#1f2328]">{def.label}</p>
        <p className="mt-0.5 text-[11px] text-[#656d76]">{def.description}</p>
      </div>

      <InspectorSection title="尺寸档位">
        <div className="grid grid-cols-2 gap-1.5">
          {def.allowedTiers.map((key) => {
            const tier = SPACE_SIZE_TIERS[key];
            const active = block.sizeTier === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTierChange(key)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-left",
                  active
                    ? "border-[#0969da] bg-[#f0f6ff]"
                    : "border-[#d0d7de] hover:border-[#8c959f]",
                )}
              >
                <p className="text-xs font-medium text-[#1f2328]">{tier.label}</p>
                <p className="text-[10px] text-[#8c959f]">
                  {tier.w} × {def.maxH ? Math.min(tier.h, def.maxH) : tier.h} 格
                </p>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-[#8c959f]">
          块只能取固定档位，不支持自由拉伸——这样窄屏才能可靠地降级成单列。
        </p>
      </InspectorSection>

      <InspectorSection title="外框">
        <InspectorRow label="块内标题">
          <InspectorText
            value={title}
            placeholder="可留空"
            maxLength={120}
            onChange={(v) => onConfigChange({ title: v })}
          />
        </InspectorRow>
        <InspectorRow label="显示卡片边框">
          <InspectorToggle
            checked={framed}
            onChange={(v) => onConfigChange({ framed: v })}
          />
        </InspectorRow>
      </InspectorSection>

      <SpaceBlockInspectorBody
        block={block}
        onConfigChange={onConfigChange}
        onContentChange={onContentChange}
      />

      {def.refs.max > 0 ? (
        <InspectorSection
          title={`已放素材 ${block.refs.length} / ${def.refs.max}`}
        >
          {block.refs.length === 0 ? (
            <p className="text-[11px] text-[#8c959f]">
              在「素材」面板点资产即可放进这个块。
            </p>
          ) : (
            <ul className="space-y-1">
              {block.refs.map((ref, i) => {
                const slot = def.slots?.find((s) => s.key === ref.slotKey);
                return (
                  <li
                    key={ref.id}
                    className="flex items-center gap-1.5 rounded border border-[#d0d7de] p-1"
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-[#f6f8fa]">
                      {ref.resolved?.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ref.resolved.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] text-[#1f2328]">
                        {ref.caption ?? ref.resolved?.title ?? "未命名"}
                      </p>
                      <p className="truncate text-[10px] text-[#8c959f]">
                        {ref.resolved ? (slot?.label ?? "") : "素材已删除"}
                      </p>
                    </div>
                    {def.refs.max > 1 ? (
                      <>
                        <button
                          type="button"
                          aria-label="上移"
                          disabled={i === 0}
                          onClick={() => onMoveRef(ref.id, -1)}
                          className="px-1 text-[10px] text-[#656d76] disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="下移"
                          disabled={i === block.refs.length - 1}
                          onClick={() => onMoveRef(ref.id, 1)}
                          className="px-1 text-[10px] text-[#656d76] disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRemoveRef(ref.id)}
                      className="px-1 text-[10px] text-[#656d76] hover:text-destructive"
                    >
                      移除
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </InspectorSection>
      ) : null}
    </div>
  );
}
