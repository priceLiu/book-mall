"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
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
  Palette,
  Save,
  Sparkles,
  Type,
  Users,
  Video,
  X,
} from "lucide-react";
import type { CanvasContentNodeType } from "@/lib/canvas/types";
import { hasStoryProPipeline } from "@/lib/canvas/story-pro-workspace-layout";
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
  return (
    <button
      type="button"
      draggable
      onDragStart={(ev) => onDragStart(ev, p.type, p.presetId)}
      onClick={() => onAdd(p.type, p.presetId)}
      aria-label={`${p.label} — ${p.hint}`}
      className={
        proTheme
          ? "group/palette relative flex size-9 shrink-0 items-center justify-center rounded-full text-cyan-100/80 transition hover:bg-cyan-500/20 hover:text-cyan-50"
          : "group/palette relative flex size-9 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-[var(--canvas-accent)]/20 hover:text-white"
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

function PaletteDivider({ vertical = false }: { vertical?: boolean }) {
  if (vertical) {
    return (
      <span
        className="my-0.5 block h-px w-6 shrink-0 bg-white/20"
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
          {p.dividerBefore ? <PaletteDivider vertical={collapsed} /> : null}
          <PaletteIconButton
            p={p}
            collapsed={collapsed}
            onDragStart={onDragStart}
            onAdd={onAdd}
            proTheme={proTheme}
          />
          {p.dividerAfter ? <PaletteDivider vertical={collapsed} /> : null}
        </Fragment>
      ))}
    </>
  );
}

const PALETTE_LABEL_CLASS = "text-[#fb923c]";
const PRO_PALETTE_LABEL_CLASS = "text-cyan-300";

function PalettePill({
  label,
  items,
  collapsed,
  trailing,
  onDragStart,
  onAdd,
  proTheme = false,
}: {
  label?: string;
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
  const labelClass = proTheme ? PRO_PALETTE_LABEL_CLASS : PALETTE_LABEL_CLASS;
  const pillClass = proTheme
    ? "flex items-center gap-1 rounded-full border border-cyan-400/25 bg-gradient-to-r from-cyan-950/40 to-black/75 px-2 py-1.5 shadow-2xl shadow-cyan-950/30 backdrop-blur-md"
    : "flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1.5 shadow-2xl backdrop-blur-md";

  if (collapsed) {
    return (
      <div className="flex w-full flex-col items-center">
        {label ? (
          <span
            className={`mb-1 max-w-[2.5rem] truncate text-center text-[9px] font-medium tracking-wide ${labelClass}`}
          >
            {label}
          </span>
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
      aria-label={label ? `${label}节点` : "画布节点"}
      style={
        proTheme
          ? { boxShadow: `0 0 0 1px ${PRO_NODE_ACCENT}18, 0 8px 32px rgba(0,0,0,0.45)` }
          : undefined
      }
    >
      {label ? (
        <span
          className={`select-none pr-0.5 text-[10px] font-medium tracking-wide ${labelClass}`}
        >
          {label}
        </span>
      ) : null}
      {label ? <PaletteDivider /> : null}
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
    <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/90 shadow-2xl backdrop-blur-lg">
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
  const proOnly = useCanvasStore((s) => hasStoryProPipeline(s.nodes));
  const comicOnly = useCanvasStore((s) => hasStoryComicPipeline(s.nodes));

  const collapsed = dock === "right";

  const proPaletteItems = useMemo(
    () =>
      STORY_PRO_PALETTE.map((item, i) =>
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

  const helpButton = (
    <button
      type="button"
      onClick={() => setHelpOpen((v) => !v)}
      aria-label="操作方式 / 快捷键"
      aria-expanded={helpOpen}
      className={`group/palette relative flex size-9 shrink-0 items-center justify-center rounded-full transition ${
        helpOpen
          ? "bg-[var(--canvas-accent)]/30 text-white"
          : "text-white/80 hover:bg-[var(--canvas-accent)]/20 hover:text-white"
      }`}
    >
      <HelpCircle className="size-[18px]" />
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
      className="group/palette relative flex size-9 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-[var(--canvas-accent)]/20 hover:text-white"
    >
      {collapsed ? (
        <ChevronLeft className="size-[18px]" />
      ) : (
        <ChevronRight className="size-[18px]" />
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
          className="flex shrink-0 items-center justify-center border-b border-white/5 bg-[var(--canvas-surface)]/95 px-3 py-1"
          role="toolbar"
          aria-label={proOnly ? "影视专业版节点面板（已收到右侧）" : "节点面板（已收到右侧）"}
        >
          <button
            type="button"
            onClick={toggleDock}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/75 transition hover:border-white/25 hover:text-white"
          >
            <ChevronLeft className="size-3" />
            节点面板在右侧 · 点击展开到顶部
          </button>
        </div>
        <div
          className="pointer-events-none fixed right-3 top-1/2 z-[100] -translate-y-1/2"
          role="toolbar"
          aria-label={proOnly ? "影视专业版节点面板（右侧）" : "节点面板（右侧）"}
        >
          <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-black/75 py-2 pl-1.5 pr-1 shadow-2xl backdrop-blur-md">
            {collapseButton}
            <PaletteDivider vertical />
            {proOnly ? (
              <PalettePill
                label="影视专业版"
                items={proPaletteItems}
                collapsed
                proTheme
                onDragStart={onDragStart}
                onAdd={onAdd}
              />
            ) : (
              <>
                <PalettePill
                  label="海报创作"
                  items={CANVAS_PALETTE}
                  collapsed
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
                <PaletteDivider vertical />
                <PalettePill
                  label="故事创作"
                  items={STORY_PALETTE}
                  collapsed
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
                <PaletteDivider vertical />
                {!comicOnly ? (
                  <PalettePill
                    label="影视专业版"
                    items={STORY_PRO_PALETTE}
                    collapsed
                    proTheme
                    onDragStart={onDragStart}
                    onAdd={onAdd}
                  />
                ) : null}
                <PaletteDivider vertical />
                <PalettePill
                  label="参考生视频"
                  items={REF_VIDEO_PALETTE}
                  collapsed
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
              </>
            )}
            <PaletteDivider vertical />
            {helpButton}
          </div>
        </div>
        </>
      ) : (
        <div
          className="relative flex shrink-0 justify-center border-b border-white/5 bg-[var(--canvas-surface)]/95 px-3 py-1.5"
          role="toolbar"
          aria-label={proOnly ? "影视专业版节点面板" : "节点面板"}
        >
          <div className="flex items-center gap-8">
            {proOnly ? (
              <PalettePill
                label="影视专业版"
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
                  label="海报创作"
                  items={CANVAS_PALETTE}
                  collapsed={false}
                  trailing={canvasTrailing}
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
                <PalettePill
                  label="故事创作"
                  items={STORY_PALETTE}
                  collapsed={false}
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
                {!comicOnly ? (
                  <PalettePill
                    label="影视专业版"
                    items={STORY_PRO_PALETTE}
                    collapsed={false}
                    proTheme
                    onDragStart={onDragStart}
                    onAdd={onAdd}
                  />
                ) : null}
                <PalettePill
                  label="参考生视频"
                  items={REF_VIDEO_PALETTE}
                  collapsed={false}
                  onDragStart={onDragStart}
                  onAdd={onAdd}
                />
              </>
            )}
          </div>

          {helpOpen ? (
            <div
              className="pointer-events-auto absolute left-1/2 top-full z-[100] mt-2 w-[420px] max-w-[92vw] -translate-x-1/2"
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
