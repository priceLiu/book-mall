"use client";

import { useCallback, useState } from "react";
import { BookOpen, FileText, PenLine, Sparkles } from "lucide-react";

import {
  defaultPro2ScriptCategoryDocBody,
  resolvePro2ScriptCategoryDocBody,
  resolvePro2ScriptCategoryDocTitle,
  shouldShowPro2ScriptPromptTemplateChip,
} from "@/lib/canvas/pro2-script-category-doc";
import {
  PRO2_SCRIPT_CATEGORY_PRESETS,
  pro2ScriptCategoryPreset,
  type Pro2ScriptCategoryId,
} from "@/lib/canvas/pro2-script-category-presets";
import type { Pro2DockUpstreamLink } from "@/lib/canvas/pro2-dock-upstream-links";
import {
  PRO2_DOCK_ACTIVE_REF_BORDER_CLASS,
  PRO2_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import { useLibtvDockRefThumbMetrics } from "@/lib/canvas/use-libtv-dock-ref-thumb-metrics";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { cn } from "@/lib/utils";

import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "../sbv1/sbv1-toolbar-anchor-popover";
import { Pro2ScriptCategoryDocModal } from "./pro2-script-category-doc-modal";

const TEMPLATE_ICONS: Record<
  Pro2ScriptCategoryId,
  typeof BookOpen
> = {
  "gu-feng-tian-chong": BookOpen,
  "default-master": Sparkles,
  "custom-prompt": PenLine,
};

export function Pro2ScriptCategoryDocChip({
  hubData,
  upstreamLinks: _upstreamLinks,
  disabled,
  onSaveBody,
  onSaveCustomPrompt,
  onCategoryApply,
}: {
  hubData: StoryProScriptHubNodeData;
  upstreamLinks: Pro2DockUpstreamLink[];
  disabled?: boolean;
  onSaveBody: (body: string) => void;
  onSaveCustomPrompt: (body: string) => void;
  onCategoryApply: (categoryId: Pro2ScriptCategoryId) => void;
}) {
  const [docModalOpen, setDocModalOpen] = useState(false);
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();
  const { thumbPx, logoIconPx, badgeFontPx } = useLibtvDockRefThumbMetrics();

  const activeCategoryId = hubData.scriptCategoryId;
  const activePreset = activeCategoryId
    ? pro2ScriptCategoryPreset(activeCategoryId)
    : undefined;
  const chipLabel =
    activePreset?.label.replace(/剧本$/, "") ??
    hubData.scriptCategoryLabel?.replace(/剧本$/, "") ??
    "提示词";

  const categoryDocBody = resolvePro2ScriptCategoryDocBody(hubData);
  const categoryDocTitle = resolvePro2ScriptCategoryDocTitle(hubData);

  const onPickTemplate = useCallback(
    (categoryId: Pro2ScriptCategoryId) => {
      if (disabled) return;
      onCategoryApply(categoryId);
      setOpen(false);
    },
    [disabled, onCategoryApply, setOpen],
  );

  const onOpenDocModal = useCallback(() => {
    if (disabled || !activeCategoryId) return;
    setOpen(false);
    setDocModalOpen(true);
  }, [disabled, activeCategoryId, setOpen]);

  if (!shouldShowPro2ScriptPromptTemplateChip()) return null;

  const ActiveIcon = activeCategoryId ? TEMPLATE_ICONS[activeCategoryId] : FileText;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-lg border bg-white/[0.04] transition-shadow",
          open || docModalOpen
            ? PRO2_DOCK_ACTIVE_REF_BORDER_CLASS
            : PRO2_DOCK_REF_IDLE_BORDER_CLASS,
          disabled ? "cursor-not-allowed opacity-40" : "hover:border-white/25",
        )}
        style={{ width: thumbPx, height: thumbPx }}
        title="选择提示词模板"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-violet-200/80">
          <ActiveIcon style={{ width: logoIconPx, height: logoIconPx }} />
          <span
            className="max-w-full truncate px-0.5 leading-none text-white/50"
            style={{ fontSize: badgeFontPx }}
          >
            {chipLabel.slice(0, 4)}
          </span>
        </div>
      </button>

      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        align="end"
        placement="above"
        estimatedHeight={220}
        className="min-w-[11rem] overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1f] py-1 shadow-xl"
      >
        <p className="px-2.5 pb-1 pt-0.5 text-[9px] font-medium uppercase tracking-wide text-white/35">
          提示词模板
        </p>
        {PRO2_SCRIPT_CATEGORY_PRESETS.map((preset) => {
          const Icon = TEMPLATE_ICONS[preset.id];
          const selected = preset.id === activeCategoryId;
          return (
            <button
              key={preset.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition",
                selected
                  ? "bg-violet-500/15 text-violet-100"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white/90",
              )}
              onClick={() => onPickTemplate(preset.id)}
            >
              <Icon className="size-3 shrink-0 opacity-70" />
              <span className="min-w-0 truncate">{preset.label}</span>
            </button>
          );
        })}
        {activeCategoryId === "gu-feng-tian-chong" && categoryDocBody ? (
          <>
            <div className="my-1 border-t border-white/10" />
            <button
              type="button"
              className="flex w-full px-2.5 py-1.5 text-left text-[11px] text-white/60 hover:bg-white/[0.06] hover:text-white/85"
              onClick={onOpenDocModal}
            >
              预览 / 编辑类别参考…
            </button>
          </>
        ) : null}
        {activeCategoryId === "custom-prompt" ? (
          <>
            <div className="my-1 border-t border-white/10" />
            <button
              type="button"
              className="flex w-full px-2.5 py-1.5 text-left text-[11px] text-white/60 hover:bg-white/[0.06] hover:text-white/85"
              onClick={onOpenDocModal}
            >
              编辑自编提示词…
            </button>
          </>
        ) : null}
      </Sbv1ToolbarDropdown>

      {activeCategoryId === "gu-feng-tian-chong" && categoryDocBody ? (
        <Pro2ScriptCategoryDocModal
          open={docModalOpen}
          title={`${categoryDocTitle} · 类别参考`}
          value={categoryDocBody}
          defaultBody={
            defaultPro2ScriptCategoryDocBody("gu-feng-tian-chong") ?? ""
          }
          onClose={() => setDocModalOpen(false)}
          onSave={onSaveBody}
        />
      ) : null}

      {activeCategoryId === "custom-prompt" && docModalOpen ? (
        <Pro2ScriptCategoryDocModal
          open={docModalOpen}
          title="自己编写提示词"
          value={hubData.dockInput ?? ""}
          onClose={() => setDocModalOpen(false)}
          onSave={onSaveCustomPrompt}
        />
      ) : null}
    </>
  );
}
