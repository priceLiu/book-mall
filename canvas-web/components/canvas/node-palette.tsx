"use client";

import { useCallback, useState } from "react";
import {
  Brain,
  ClipboardList,
  HelpCircle,
  Image as ImageIcon,
  ImagePlus,
  Save,
  Type,
  X,
} from "lucide-react";
import type { CanvasContentNodeType } from "@/lib/canvas/types";

/**
 * 顶部 palette 项。
 * - `presetId` 可选：对应 `lib/canvas/text-templates.ts` 中模板的 id；
 *   设了之后该按钮会创建 text 节点并预填该模板内容。
 *   （这是"产品参数"等"快捷入口"的实现方式：节点类型仍是 text，避免再回到 v1 多 type 模型。）
 */
const PALETTE: Array<{
  type: CanvasContentNodeType;
  label: string;
  icon: React.ReactNode;
  hint: string;
  presetId?: string;
}> = [
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
  },
];

const SHORTCUTS: Array<{ keys: string[]; desc: string }> = [
  { keys: ["拖空白处"], desc: "框选多个节点" },
  { keys: ["中键 / 右键 拖"], desc: "平移画布" },
  { keys: ["滚轮 / 触控板"], desc: "缩放画布" },
  { keys: ["⌘", "或", "⇧", "+ 点击"], desc: "添加 / 移除 多选" },
  { keys: ["⌘", "Z"], desc: "撤销" },
  { keys: ["⌘", "⇧", "Z"], desc: "重做" },
  { keys: ["Backspace", "Delete"], desc: "删除选中节点" },
  { keys: ["拖入图片文件"], desc: "在画布生成「图片」节点并自动上传到 OSS" },
  { keys: ["从顶部 logo 拖到画布"], desc: "新建对应类型节点" },
];

/**
 * 顶部居中浮动节点面板：圆形 icon 按钮 + ? 帮助按钮。
 * - 拖到画布：用 dataTransfer 协议（`application/canvas-node-type` + `application/canvas-node-preset`）
 * - 点击：直接 onAdd(type, presetId?)
 * - hover 出气泡（label + hint）
 * - ? 按钮点击弹出快捷键卡片
 */
export function NodePalette({
  onAdd,
}: {
  onAdd: (type: CanvasContentNodeType, presetId?: string) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

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

  return (
    <>
      <div
        className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2"
        role="toolbar"
        aria-label="节点面板"
      >
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-1.5 shadow-2xl backdrop-blur-md">
          {PALETTE.map((p) => (
            <button
              key={`${p.type}/${p.presetId ?? "_"}`}
              type="button"
              draggable
              onDragStart={(ev) => onDragStart(ev, p.type, p.presetId)}
              onClick={() => onAdd(p.type, p.presetId)}
              aria-label={`${p.label} — ${p.hint}`}
              className="group/palette relative flex size-9 cursor-grab items-center justify-center rounded-full text-white/80 transition hover:bg-[var(--canvas-accent)]/20 hover:text-white active:cursor-grabbing"
            >
              {p.icon}
              <span
                className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover/palette:opacity-100"
                role="tooltip"
              >
                <span className="font-medium">{p.label}</span>
                <span className="ml-1 text-white/55">· {p.hint}</span>
              </span>
            </button>
          ))}
          {/* 分隔线 */}
          <span className="mx-0.5 h-5 w-px bg-white/10" />
          {/* 快捷键 / 操作方式 */}
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-label="操作方式 / 快捷键"
            aria-expanded={helpOpen}
            className={`group/palette relative flex size-9 items-center justify-center rounded-full transition ${
              helpOpen
                ? "bg-[var(--canvas-accent)]/30 text-white"
                : "text-white/80 hover:bg-[var(--canvas-accent)]/20 hover:text-white"
            }`}
          >
            <HelpCircle className="size-[18px]" />
            <span
              className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover/palette:opacity-100"
              role="tooltip"
            >
              <span className="font-medium">操作方式</span>
              <span className="ml-1 text-white/55">· 快捷键 & 用法</span>
            </span>
          </button>
        </div>
      </div>

      {/* 快捷键卡片（点 ? 切换） */}
      {helpOpen ? (
        <div
          className="pointer-events-auto absolute left-1/2 top-[52px] z-40 w-[420px] max-w-[92vw] -translate-x-1/2"
          role="dialog"
          aria-label="操作方式"
        >
          <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/90 shadow-2xl backdrop-blur-lg">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-2 text-[13px] text-white">
                <HelpCircle className="size-4 text-[var(--canvas-accent)]" />
                <span className="font-medium">操作方式 · 快捷键</span>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
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
              提示：选中 ≥2 个节点会在选区上方浮出「分组 / 自动整理 / 删除」。
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
