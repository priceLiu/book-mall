"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Brain,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  Download,
  FileText,
  Film,
  HelpCircle,
  Image as ImageIcon,
  ImagePlus,
  LayoutGrid,
  MapPin,
  Mic,
  Music,
  Palette,
  Save,
  Sparkles,
  Type,
  Users,
  Video,
  Wind,
  X,
} from "lucide-react";
import type { CanvasContentNodeType } from "@/lib/canvas/types";
import { hasStoryProPipeline } from "@/lib/canvas/story-pro-workspace-layout";
import { hasStoryPro2Pipeline } from "@/lib/canvas/story-pro2-workspace-layout";
import { hasStoryComicPipeline } from "@/lib/canvas/story-comic-layout";
import { useCanvasStore } from "@/lib/canvas/store";
import { PRO_NODE_ACCENT } from "@/lib/canvas/story-pro-node-chrome";

export type PaletteItem = {
  type: CanvasContentNodeType;
  label: string;
  icon: React.ReactNode;
  hint: string;
  presetId?: string;
  dividerBefore?: boolean;
  dividerAfter?: boolean;
};

/**
 * 通用画布节点（海报 / 方案 / 生图工作流）。
 */
const CANVAS_PALETTE: PaletteItem[] = [
  {
    type: "image",
    label: "图片",
    icon: <ImageIcon className="size-[18px]" />,
    hint: "上传 / 拖入参考图",
  },
  {
    type: "text",
    label: "文本",
    icon: <Type className="size-[18px]" />,
    hint: "可手写 / 接 AI 引擎下游",
  },
  {
    type: "text",
    label: "参数",
    icon: <ClipboardList className="size-[18px]" />,
    hint: "产品参数（品牌 / 规格 / 卖点 / 价格）",
    presetId: "product-params",
  },
  {
    type: "ai-engine",
    label: "AI 引擎",
    icon: <Brain className="size-[18px]" />,
    hint: "调 LLM 出方案文本",
    dividerBefore: true,
  },
  {
    type: "image-engine",
    label: "生图引擎",
    icon: <ImagePlus className="size-[18px]" />,
    hint: "调图像模型出图",
  },
  {
    type: "output",
    label: "输出",
    icon: <Save className="size-[18px]" />,
    hint: "导出 / 入画作库",
    dividerBefore: true,
  },
  {
    type: "jianying-export",
    label: "剪映",
    icon: <Download className="size-[18px]" />,
    hint: "分镜包 / 草稿 ZIP",
  },
];

/** 故事 / 分镜全链路节点（与通用画布分栏展示）。 */
const STORY_PALETTE: PaletteItem[] = [
  {
    type: "story-comic-starter",
    label: "故事主题",
    icon: <Clapperboard className="size-[18px]" />,
    hint: "主题 + 模型 → 创作剧本",
  },
  {
    type: "story-script-hub",
    label: "故事大纲",
    icon: <FileText className="size-[18px]" />,
    hint: "大纲 · 角色 · 分镜 · 对白",
    dividerBefore: true,
  },
  {
    type: "story-character-column",
    label: "角色设定与三视图",
    icon: <Users className="size-[18px]" />,
    hint: "三视图批量",
  },
  {
    type: "story-frame-column",
    label: "分镜脚本",
    icon: <Film className="size-[18px]" />,
    hint: "场景·镜头描述·生成视频",
  },
  {
    type: "story-video-column",
    label: "分镜视频",
    icon: <Video className="size-[18px]" />,
    hint: "视频 + 配音",
  },
  {
    type: "tts-engine",
    label: "语音",
    icon: <Mic className="size-[18px]" />,
    hint: "各镜成片预览",
  },
  {
    type: "jianying-export",
    label: "剪映",
    icon: <Download className="size-[18px]" />,
    hint: "分镜包 / 草稿 ZIP",
    dividerBefore: true,
  },
];

/** 影视专业版 · 五阶段工作流（与快手版完全隔离） */
const STORY_PRO_PALETTE: PaletteItem[] = [
  {
    type: "story-pro-starter",
    label: "影视专业 · 启动",
    icon: <Clapperboard className="size-[18px]" />,
    hint: "五阶段 SOP · 风格锚定",
    dividerBefore: true,
  },
  {
    type: "story-pro-script-hub",
    label: "故事剧本",
    icon: <ClipboardList className="size-[18px]" />,
    hint: "大纲 + 可行性",
  },
  {
    type: "story-pro-style",
    label: "风格定义",
    icon: <Palette className="size-[18px]" />,
    hint: "锚定词 · 参考图",
  },
  {
    type: "story-pro-character",
    label: "人物设计",
    icon: <Users className="size-[18px]" />,
    hint: "三视图",
  },
  {
    type: "story-pro-scene",
    label: "场景设计",
    icon: <MapPin className="size-[18px]" />,
    hint: "场景资产",
  },
  {
    type: "story-pro-frame",
    label: "分镜脚本",
    icon: <Film className="size-[18px]" />,
    hint: "镜号/景别/运镜",
  },
  {
    type: "story-pro-video",
    label: "分镜视频",
    icon: <Video className="size-[18px]" />,
    hint: "视频 + 配音",
  },
  {
    type: "jianying-export-pro",
    label: "剪映 · 专业版",
    icon: <Download className="size-[18px]" />,
    hint: "导出 ZIP",
    dividerBefore: true,
  },
];

/** 影视专业版 2.0 · LibTV 薄卡工作流 */
const STORY_PRO2_PALETTE: PaletteItem[] = [
  {
    type: "story-pro2-starter",
    label: "影视专业 2.0 · 启动",
    icon: <Clapperboard className="size-[18px]" />,
    hint: "薄卡 + 检视面板",
    dividerBefore: true,
  },
  {
    type: "story-pro2-script-hub",
    label: "故事剧本",
    icon: <ClipboardList className="size-[18px]" />,
    hint: "大纲 + 可行性",
  },
  {
    type: "story-pro2-style",
    label: "风格定义",
    icon: <Palette className="size-[18px]" />,
    hint: "锚定词 · 参考图",
  },
  {
    type: "story-pro2-character",
    label: "人物设计",
    icon: <Users className="size-[18px]" />,
    hint: "三视图",
  },
  {
    type: "story-pro2-scene",
    label: "场景设计",
    icon: <MapPin className="size-[18px]" />,
    hint: "场景资产",
  },
  {
    type: "story-pro2-frame",
    label: "分镜脚本",
    icon: <Film className="size-[18px]" />,
    hint: "镜号/景别/运镜",
  },
  {
    type: "story-pro2-video",
    label: "分镜视频",
    icon: <Video className="size-[18px]" />,
    hint: "视频 + 配音",
  },
  {
    type: "story-pro2-prop",
    label: "道具设计",
    icon: <Box className="size-[18px]" />,
    hint: "占位 · 功能待开发",
    dividerBefore: true,
  },
  {
    type: "story-pro2-mood",
    label: "氛围设计",
    icon: <Wind className="size-[18px]" />,
    hint: "占位 · 功能待开发",
  },
  {
    type: "story-pro2-audio",
    label: "音效设计",
    icon: <Music className="size-[18px]" />,
    hint: "占位 · 功能待开发",
  },
  {
    type: "jianying-export-pro2",
    label: "导出剪辑 · 2.0",
    icon: <Download className="size-[18px]" />,
    hint: "剪映 ZIP 导出",
    dividerBefore: true,
  },
  {
    type: "jianying-auto-render-pro2",
    label: "自动成片 · 2.0",
    icon: <Clapperboard className="size-[18px]" />,
    hint: "云端剪辑 MP4",
  },
];

/** 参考生视频 · 宫格 → AI 视频引擎 → 视频生成 */
const REF_VIDEO_PALETTE: PaletteItem[] = [
  {
    type: "ref-grid-4",
    label: "四宫格",
    icon: <LayoutGrid className="size-[18px]" />,
    hint: "4 格参考图",
  },
  {
    type: "ref-grid-6",
    label: "六宫格",
    icon: <LayoutGrid className="size-[18px]" />,
    hint: "6 格参考图",
  },
  {
    type: "ref-grid-9",
    label: "九宫格",
    icon: <LayoutGrid className="size-[18px]" />,
    hint: "9 格参考图",
  },
  {
    type: "ai-video-engine",
    label: "AI 视频引擎",
    icon: <Sparkles className="size-[18px]" />,
    hint: "参考生视频 · 选模型",
    dividerBefore: true,
  },
  {
    type: "video-generate",
    label: "视频生成",
    icon: <Video className="size-[18px]" />,
    hint: "成片预览",
  },
];

const PALETTE_COLLAPSED_KEY = "canvas-node-palette-collapsed";
const PALETTE_DOCK_KEY = "canvas-node-palette-dock";

type PaletteDock = "top" | "right";

function readPaletteDock(): PaletteDock {
  try {
    const dock = localStorage.getItem(PALETTE_DOCK_KEY);
    if (dock === "top" || dock === "right") return dock;
    return localStorage.getItem(PALETTE_COLLAPSED_KEY) === "1" ? "right" : "top";
  } catch {
    return "top";
  }
}

function writePaletteDock(dock: PaletteDock) {
  try {
    localStorage.setItem(PALETTE_DOCK_KEY, dock);
    localStorage.setItem(PALETTE_COLLAPSED_KEY, dock === "right" ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function PaletteIconButton({
  p,
  collapsed,
  onDragStart,
  onAdd,
  proTheme = false,
}: {
  p: PaletteItem;
  collapsed: boolean;
  onDragStart: (
    event: React.DragEvent<HTMLButtonElement>,
    type: CanvasContentNodeType,
    presetId?: string,
  ) => void;
  onAdd: (type: CanvasContentNodeType, presetId?: string) => void;
  proTheme?: boolean;
}) {
  const btnSize = collapsed ? PALETTE_DOCK_NODE_BTN : "size-9";
  const iconScale = collapsed ? PALETTE_DOCK_NODE_ICON : "[&_svg]:!size-[18px]";
  return (
    <button
      type="button"
      draggable
      onDragStart={(ev) => onDragStart(ev, p.type, p.presetId)}
      onClick={() => onAdd(p.type, p.presetId)}
      aria-label={`${p.label} — ${p.hint}`}
      className={
        proTheme
          ? `group/palette relative flex ${btnSize} shrink-0 items-center justify-center rounded-full text-cyan-100/80 transition hover:bg-cyan-500/20 hover:text-cyan-50 ${iconScale}`
          : `group/palette relative flex ${btnSize} shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-[var(--canvas-accent)]/20 hover:text-white ${iconScale}`
      }
    >
      {p.icon}
      <span
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover/palette:opacity-100 ${
          collapsed
            ? "right-full top-1/2 mr-2 -translate-y-1/2"
            : "left-1/2 top-full mt-2 -translate-x-1/2"
        }`}
        role="tooltip"
      >
        <span className="font-medium">{p.label}</span>
        <span className="ml-1 text-white/55">· {p.hint}</span>
      </span>
    </button>
  );
}

function PaletteDivider({
  vertical = false,
  compact = false,
}: {
  vertical?: boolean;
  compact?: boolean;
}) {
  if (vertical) {
    return (
      <span
        className={`my-0.5 block h-px shrink-0 bg-white/20 ${
          compact ? "w-5" : "w-6"
        }`}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="select-none px-0.5 text-[16px] font-extralight leading-none text-white/45"
      aria-hidden
    >
      |
    </span>
  );
}

function PaletteItemsRow({
  items,
  collapsed,
  onDragStart,
  onAdd,
  proTheme = false,
}: {
  items: PaletteItem[];
  collapsed: boolean;
  onDragStart: (
    event: React.DragEvent<HTMLButtonElement>,
    type: CanvasContentNodeType,
    presetId?: string,
  ) => void;
  onAdd: (type: CanvasContentNodeType, presetId?: string) => void;
  proTheme?: boolean;
}) {
  return (
    <>
      {items.map((p) => (
        <Fragment key={`${p.type}/${p.presetId ?? "_"}`}>
          {p.dividerBefore ? (
            <PaletteDivider vertical={collapsed} compact={collapsed} />
          ) : null}
          <PaletteIconButton
            p={p}
            collapsed={collapsed}
            onDragStart={onDragStart}
            onAdd={onAdd}
            proTheme={proTheme}
          />
          {p.dividerAfter ? (
            <PaletteDivider vertical={collapsed} compact={collapsed} />
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

/** 标准版顶部节点面板 · 视觉与布局见 `docs/design.md` §3.6 */
/** 右侧 dock · 节点拖入钮 22px */
const PALETTE_DOCK_NODE_BTN = "size-[22px]";
const PALETTE_DOCK_NODE_ICON = "[&_svg]:!size-3";

const PALETTE_BADGE_CLASS = "text-[#fb923c]";
const PRO_PALETTE_BADGE_CLASS = "text-cyan-300";

/** 分组徽标（替代「海报创作」等文字标签） */
const PALETTE_GROUPS = {
  poster: {
    label: "海报创作",
    icon: <Palette className="size-[18px]" aria-hidden />,
  },
  story: {
    label: "故事创作",
    icon: <Clapperboard className="size-[18px]" aria-hidden />,
  },
  refVideo: {
    label: "参考生视频",
    icon: <Video className="size-[18px]" aria-hidden />,
  },
  pro: {
    label: "影视专业版",
    icon: <Sparkles className="size-[18px]" aria-hidden />,
  },
} as const;

function PaletteGroupBadge({
  label,
  icon,
  collapsed,
  proTheme = false,
}: {
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  proTheme?: boolean;
}) {
  const colorClass = proTheme ? PRO_PALETTE_BADGE_CLASS : PALETTE_BADGE_CLASS;
  const iconScale = collapsed ? "[&_svg]:!size-3.5" : "[&_svg]:!size-[18px]";
  return (
    <span
      className={`group/badge relative inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] ${
        collapsed ? `mb-1 ${PALETTE_DOCK_NODE_BTN}` : "size-9"
      } ${colorClass} ${iconScale}`}
      title={label}
      aria-label={label}
    >
      {icon}
      <span
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover/badge:opacity-100 ${
          collapsed
            ? "right-full top-1/2 mr-2 -translate-y-1/2"
            : "left-1/2 top-full mt-2 -translate-x-1/2"
        }`}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}

function PalettePill({
  groupLabel,
  groupIcon,
  items,
  collapsed,
  trailing,
  onDragStart,
  onAdd,
  proTheme = false,
}: {
  groupLabel?: string;
  groupIcon?: React.ReactNode;
  items: PaletteItem[];
  collapsed: boolean;
  trailing?: React.ReactNode;
  onDragStart: (
    event: React.DragEvent<HTMLButtonElement>,
    type: CanvasContentNodeType,
    presetId?: string,
  ) => void;
  onAdd: (type: CanvasContentNodeType, presetId?: string) => void;
  proTheme?: boolean;
}) {
  const pillClass = proTheme
    ? "inline-flex w-fit max-w-full items-center gap-0.5 rounded-full border border-cyan-400/25 bg-[var(--canvas-surface)]/95 px-1 py-0.5 shadow-md"
    : "inline-flex w-fit max-w-full items-center gap-0.5 rounded-full border border-white/12 bg-[var(--canvas-surface)]/92 px-1 py-0.5 shadow-md";

  if (collapsed) {
    return (
      <div className="flex flex-col items-center">
        {groupLabel && groupIcon ? (
          <PaletteGroupBadge
            label={groupLabel}
            icon={groupIcon}
            collapsed
            proTheme={proTheme}
          />
        ) : null}
        <PaletteItemsRow
          items={items}
          collapsed
          onDragStart={onDragStart}
          onAdd={onAdd}
          proTheme={proTheme}
        />
      </div>
    );
  }

  return (
    <div
      className={pillClass}
      role="group"
      aria-label={groupLabel ? `${groupLabel}节点` : "画布节点"}
      style={
        proTheme
          ? { boxShadow: `0 0 0 1px ${PRO_NODE_ACCENT}18, 0 8px 32px rgba(0,0,0,0.45)` }
          : undefined
      }
    >
      {groupLabel && groupIcon ? (
        <>
          <PaletteGroupBadge
            label={groupLabel}
            icon={groupIcon}
            collapsed={false}
            proTheme={proTheme}
          />
          <PaletteDivider />
        </>
      ) : null}
      <PaletteItemsRow
        items={items}
        collapsed={false}
        onDragStart={onDragStart}
        onAdd={onAdd}
        proTheme={proTheme}
      />
      {trailing}
    </div>
  );
}

const SHORTCUTS: Array<{ keys: string[]; desc: string }> = [
  { keys: ["拖空白处"], desc: "框选多个节点" },
  { keys: ["中键 / 右键 拖"], desc: "平移画布" },
  { keys: ["Space", "+ 拖"], desc: "平移画布" },
  { keys: ["节点标题栏", "⋮⋮"], desc: "拖动节点（内容区为编辑/滚动）" },
  { keys: ["滚轮 / 触控板"], desc: "缩放画布" },
  { keys: ["⌘", "或", "⇧", "+ 点击"], desc: "添加 / 移除 多选" },
  { keys: ["⌘", "Z"], desc: "撤销" },
  { keys: ["⌘", "⇧", "Z"], desc: "重做" },
  { keys: ["Backspace", "Delete"], desc: "删除选中节点" },
  { keys: ["拖入图片文件"], desc: "在画布生成「图片」节点并自动上传到 OSS" },
  { keys: ["从顶部工具条拖到画布"], desc: "新建对应类型节点" },
];

function HelpShortcutsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#101012]/96 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] text-white">
          <HelpCircle className="size-4 text-[var(--canvas-accent)]" />
          <span className="font-medium">操作方式 · 快捷键</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="divide-y divide-white/5">
        {SHORTCUTS.map((s, idx) => (
          <li
            key={idx}
            className="flex items-center justify-between gap-3 px-4 py-2 text-[12px]"
          >
            <div className="flex flex-wrap items-center gap-1">
              {s.keys.map((k, i) => (
                <span
                  key={i}
                  className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-white"
                >
                  {k}
                </span>
              ))}
            </div>
            <span className="text-white/70">{s.desc}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 px-4 py-2 text-[11px] text-white/45">
        提示：选中 ≥2 个节点会在选区上方浮出「分组 / 自动整理 / 删除」。故事 / 分镜节点在右侧工具条。
      </div>
    </div>
  );
}

/**
 * 顶部节点面板：位于项目工具栏下方（文档流），避免生成中 fitView 时大节点盖住 fixed 浮层。
 */
export function NodePalette({
  onAdd,
}: {
  onAdd: (type: CanvasContentNodeType, presetId?: string) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [dock, setDock] = useState<PaletteDock>("top");
  const pro2Only = useCanvasStore((s) => hasStoryPro2Pipeline(s.nodes));
  const proOnly =
    useCanvasStore((s) => hasStoryProPipeline(s.nodes)) && !pro2Only;
  const comicOnly = useCanvasStore((s) => hasStoryComicPipeline(s.nodes));

  const collapsed = dock === "right";

  const proPaletteItems = useMemo(
    () =>
      STORY_PRO_PALETTE.map((item, i) =>
        i === 0 ? { ...item, dividerBefore: false } : item,
      ),
    [],
  );

  const pro2PaletteItems = useMemo(
    () =>
      STORY_PRO2_PALETTE.map((item, i) =>
        i === 0 ? { ...item, dividerBefore: false } : item,
      ),
    [],
  );

  useEffect(() => {
    setDock(readPaletteDock());
  }, []);

  const setDockPersist = useCallback((next: PaletteDock) => {
    setDock(next);
    writePaletteDock(next);
    setHelpOpen(false);
  }, []);

  const toggleDock = useCallback(() => {
    setDockPersist(dock === "top" ? "right" : "top");
  }, [dock, setDockPersist]);

  const onDragStart = useCallback(
    (
      event: React.DragEvent<HTMLButtonElement>,
      type: CanvasContentNodeType,
      presetId?: string,
    ) => {
      event.dataTransfer.setData("application/canvas-node-type", type);
      if (presetId) {
        event.dataTransfer.setData("application/canvas-node-preset", presetId);
      }
      event.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  const dockChromeBtn = `${PALETTE_DOCK_NODE_BTN} ${PALETTE_DOCK_NODE_ICON}`;
  const topChromeBtn = "size-9 [&_svg]:!size-[18px]";
  const dockExpandBtn =
    "size-10 border border-emerald-400/35 bg-emerald-500/15 text-emerald-100 shadow-md hover:border-emerald-400/55 hover:bg-emerald-500/25 [&_svg]:!size-[18px]";

  const helpButton = (
    <button
      type="button"
      onClick={() => setHelpOpen((v) => !v)}
      aria-label="操作方式 / 快捷键"
      aria-expanded={helpOpen}
      className={`group/palette relative flex shrink-0 items-center justify-center rounded-full transition ${
        collapsed ? dockChromeBtn : topChromeBtn
      } ${
        helpOpen
          ? "bg-[var(--canvas-accent)]/30 text-white"
          : "text-white/80 hover:bg-[var(--canvas-accent)]/20 hover:text-white"
      }`}
    >
      <HelpCircle className="size-[18px]" aria-hidden />
      <span
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover/palette:opacity-100 ${
          collapsed
            ? "right-full top-1/2 mr-2 -translate-y-1/2"
            : "left-1/2 top-full mt-2 -translate-x-1/2"
        }`}
        role="tooltip"
      >
        <span className="font-medium">操作方式</span>
        <span className="ml-1 text-white/55">· 快捷键 & 用法</span>
      </span>
    </button>
  );

  const collapseButton = (
    <button
      type="button"
      onClick={toggleDock}
      aria-label={collapsed ? "移到顶部" : "收到右侧"}
      title={collapsed ? "移到顶部" : "收到右侧"}
      className={`group/palette relative flex shrink-0 items-center justify-center rounded-full transition ${
        collapsed
          ? dockExpandBtn
          : `text-white/80 hover:bg-[var(--canvas-accent)]/20 hover:text-white ${topChromeBtn}`
      }`}
    >
      {collapsed ? (
        <ChevronLeft className="size-[18px]" aria-hidden />
      ) : (
        <ChevronRight className="size-[18px]" aria-hidden />
      )}
      <span
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover/palette:opacity-100 ${
          collapsed
            ? "right-full top-1/2 mr-2 -translate-y-1/2"
            : "left-1/2 top-full mt-2 -translate-x-1/2"
        }`}
        role="tooltip"
      >
        {collapsed ? "移到顶部" : "收到右侧"}
      </span>
    </button>
  );

  const canvasTrailing = collapsed ? null : (
    <>
      <PaletteDivider />
      {helpButton}
      <PaletteDivider />
      {collapseButton}
    </>
  );

  return (
    <>
      {collapsed ? (
        <>
        <div
          className="pointer-events-none fixed right-2 top-1/2 z-[100] flex -translate-y-1/2 flex-row items-center gap-1"
          role="toolbar"
          aria-label={
            pro2Only
              ? "影视专业版 2.0 节点面板（右侧）"
              : proOnly
                ? "影视专业版节点面板（右侧）"
                : "节点面板（右侧）"
          }
        >
          {/* 移到顶部：工具条左侧、与整列垂直居中 */}
          <div className="pointer-events-auto shrink-0 self-center rounded-full bg-[var(--canvas-surface)]/95 p-0.5 shadow-md">
            {collapseButton}
          </div>
          <div className="pointer-events-auto flex flex-col rounded-xl border border-white/12 bg-[var(--canvas-surface)]/95 shadow-md">
            <div className="nodrag flex flex-col items-center gap-1 py-1.5 pl-1 pr-1">
                {pro2Only ? (
                  <PalettePill
                    groupLabel="影视专业 2.0"
                    groupIcon={PALETTE_GROUPS.pro.icon}
                    items={pro2PaletteItems}
                    collapsed
                    proTheme
                    onDragStart={onDragStart}
                    onAdd={onAdd}
                  />
                ) : proOnly ? (
                  <PalettePill
                    groupLabel={PALETTE_GROUPS.pro.label}
                    groupIcon={PALETTE_GROUPS.pro.icon}
                    items={proPaletteItems}
                    collapsed
                    proTheme
                    onDragStart={onDragStart}
                    onAdd={onAdd}
                  />
                ) : (
                  <>
                    <PalettePill
                      groupLabel={PALETTE_GROUPS.poster.label}
                      groupIcon={PALETTE_GROUPS.poster.icon}
                      items={CANVAS_PALETTE}
                      collapsed
                      onDragStart={onDragStart}
                      onAdd={onAdd}
                    />
                    <PaletteDivider vertical compact />
                    <PalettePill
                      groupLabel={PALETTE_GROUPS.story.label}
                      groupIcon={PALETTE_GROUPS.story.icon}
                      items={STORY_PALETTE}
                      collapsed
                      onDragStart={onDragStart}
                      onAdd={onAdd}
                    />
                    <PaletteDivider vertical compact />
                    <PalettePill
                      groupLabel={PALETTE_GROUPS.refVideo.label}
                      groupIcon={PALETTE_GROUPS.refVideo.icon}
                      items={REF_VIDEO_PALETTE}
                      collapsed
                      onDragStart={onDragStart}
                      onAdd={onAdd}
                    />
                  </>
                )}
            </div>
            <div className="nodrag flex shrink-0 flex-col items-center border-t border-white/10 py-1.5">
              {helpButton}
            </div>
          </div>
        </div>
        </>
      ) : (
        <div
          className="pointer-events-auto relative"
          role="toolbar"
          aria-label={
            pro2Only
              ? "影视专业版 2.0 节点面板"
              : proOnly
                ? "影视专业版节点面板"
                : "节点面板"
          }
        >
          <div className="inline-flex w-fit max-w-[min(100%,calc(100vw-1.5rem))] flex-wrap items-center justify-center gap-1.5">
            {pro2Only ? (
              <PalettePill
                groupLabel="影视专业 2.0"
                groupIcon={PALETTE_GROUPS.pro.icon}
                items={pro2PaletteItems}
                collapsed={false}
                proTheme
                trailing={canvasTrailing}
                onDragStart={onDragStart}
                onAdd={onAdd}
              />
            ) : proOnly ? (
              <PalettePill
                groupLabel={PALETTE_GROUPS.pro.label}
                groupIcon={PALETTE_GROUPS.pro.icon}
                items={proPaletteItems}
                collapsed={false}
                proTheme
                trailing={canvasTrailing}
                onDragStart={onDragStart}
                onAdd={onAdd}
              />
            ) : (
              <>
                <PalettePill
                  groupLabel={PALETTE_GROUPS.poster.label}
                  groupIcon={PALETTE_GROUPS.poster.icon}
                  items={CANVAS_PALETTE}
                  collapsed={false}
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
                <PalettePill
                  groupLabel={PALETTE_GROUPS.story.label}
                  groupIcon={PALETTE_GROUPS.story.icon}
                  items={STORY_PALETTE}
                  collapsed={false}
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
                <PalettePill
                  groupLabel={PALETTE_GROUPS.refVideo.label}
                  groupIcon={PALETTE_GROUPS.refVideo.icon}
                  items={REF_VIDEO_PALETTE}
                  collapsed={false}
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
                {canvasTrailing}
              </>
            )}
          </div>

          {helpOpen ? (
            <div
              className="pointer-events-auto absolute left-1/2 top-[calc(100%+0.5rem)] z-[100] w-[420px] max-w-[92vw] -translate-x-1/2"
              role="dialog"
              aria-label="操作方式"
            >
              <HelpShortcutsPanel onClose={() => setHelpOpen(false)} />
            </div>
          ) : null}
        </div>
      )}

      {helpOpen && collapsed ? (
        <div
          className="pointer-events-auto fixed right-16 top-1/2 z-[100] w-[420px] max-w-[92vw] -translate-y-1/2"
          role="dialog"
          aria-label="操作方式"
        >
          <HelpShortcutsPanel onClose={() => setHelpOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
