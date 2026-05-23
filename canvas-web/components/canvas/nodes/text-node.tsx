"use client";

import { useEffect, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Edit3, FilePlus2 } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { TextNodeData } from "@/lib/canvas/types";
import { CANVAS_TEXT_TEMPLATES } from "@/lib/canvas/text-templates";
import { RF_NODE_SCROLL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { NodeShell } from "../node-shell";

export function TextNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as TextNodeData;
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [tplOpen, setTplOpen] = useState(false);

  // 默认 manual；piped 时显示 runtime.textOutput；用户点 ✎ 切回 manual。
  const mode = d.mode ?? "manual";
  const piped = mode === "piped";
  const displayText = piped
    ? (d.runtime?.textOutput ?? "")
    : (d.text ?? "");

  // 当下游 ai-engine 完成 → run-queue 写 runtime.textOutput；如当前是 manual 模式且 text 为空，自动切到 piped
  useEffect(() => {
    if (mode === "manual" && !d.text && d.runtime?.textOutput) {
      updateNodeData(id, { mode: "piped" });
    }
  }, [mode, d.text, d.runtime?.textOutput, id, updateNodeData]);

  const onTextChange = (next: string) => {
    if (piped) return; // piped 下 readonly
    updateNodeData(id, { text: next });
  };

  const onSwitchToManual = () => {
    // 把 runtime.textOutput 复制到 data.text，切到 manual
    updateNodeData(id, {
      mode: "manual",
      text: displayText,
    });
    requestAnimationFrame(() => {
      taRef.current?.focus();
    });
  };

  const onInsertTemplate = (body: string) => {
    if (piped) {
      // 退出 piped 进入 manual，并填模板
      updateNodeData(id, { mode: "manual", text: body });
      setTplOpen(false);
      return;
    }
    const el = taRef.current;
    const cur = d.text ?? "";
    if (el) {
      const start = el.selectionStart ?? cur.length;
      const end = el.selectionEnd ?? cur.length;
      const next = `${cur.slice(0, start)}${body}${cur.slice(end)}`;
      updateNodeData(id, { text: next });
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + body.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      updateNodeData(id, { text: cur + (cur ? "\n" : "") + body });
    }
    setTplOpen(false);
  };

  return (
    <NodeShell
      title={piped ? "文本 · 接入" : "文本"}
      subtitle={
        piped ? "已接收上游文本（点 ✎ 切到手写）" : "自由文本 / 上游可写入"
      }
      selected={selected}
      runtime={d.runtime}
      minWidth={260}
      minHeight={180}
      inputs={[{ id: "in_text", label: "上游文本", kind: "text" }]}
      outputs={[{ id: "text", label: "文本", kind: "text" }]}
    >
      <div className="flex h-full flex-col gap-2">
        <div className="relative min-h-0 flex-1">
          <textarea
            ref={taRef}
            value={displayText}
            onChange={(e) => onTextChange(e.target.value)}
            readOnly={piped}
            placeholder={piped ? "等待上游 AI 引擎写入…" : "例如：极简风格，紫色主调"}
            className={`${RF_NODE_SCROLL} h-full w-full resize-none rounded-md border border-white/10 bg-black/30 p-2 text-[12px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
          />
          {piped ? (
            <button
              type="button"
              onClick={onSwitchToManual}
              title="覆盖为手写（保留当前内容）"
              className="absolute right-1.5 top-1.5 rounded-md border border-white/10 bg-black/40 p-1 text-white/70 hover:border-white/30 hover:text-white"
            >
              <Edit3 className="size-3" />
            </button>
          ) : null}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setTplOpen((v) => !v)}
            className="nodrag inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/80 hover:border-white/30 hover:text-white"
          >
            <FilePlus2 className="size-3" /> 插入模板
          </button>
          {tplOpen ? (
            <div className={`nodrag absolute bottom-full left-0 z-30 mb-1 w-72 max-h-64 overflow-y-auto rounded-md border border-white/15 bg-black/95 text-[12px] shadow-2xl ${RF_NO_WHEEL}`}>
              {CANVAS_TEXT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onInsertTemplate(t.body)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-white/5 px-3 py-1.5 text-left last:border-b-0 hover:bg-white/10"
                >
                  <span className="font-medium text-white">{t.name}</span>
                  <span className="text-[11px] text-white/60">{t.hint}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </NodeShell>
  );
}
