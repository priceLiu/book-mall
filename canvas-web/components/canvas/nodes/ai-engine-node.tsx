"use client";

import { useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Play, RefreshCw, Sparkles } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { AiEngineNodeData } from "@/lib/canvas/types";
import { resolveReferencedNodeIds } from "@/lib/canvas/referenced-nodes";
import { RF_FORM_CONTROL, RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { NodeShell } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { PromptTemplatePicker } from "../prompt-template-picker";
import type { AppliedPromptTemplate } from "@/lib/canvas-prompt-templates-api";
import {
  MentionsTextarea,
  type MentionableItem,
} from "../mentions/MentionsTextarea";
import {
  UpstreamChipRow,
  useUpstreamChips,
  sortUpstreamChips,
  type UpstreamChip,
} from "../upstream-chips";

/** 模板正文 + 上游文本节点内容（换行追加） */
function buildPromptWithUpstreamParams(
  template: string,
  chips: UpstreamChip[],
): { prompt: string; textNodeIds: string[] } {
  const base = template.trim();
  const textChips = chips.filter((c) => c.kind === "text" && c.fullText?.trim());
  if (textChips.length === 0) {
    return { prompt: base, textNodeIds: [] };
  }
  const blocks = textChips.map((c) => c.fullText!.trim());
  return {
    prompt: `${base}\n\n${blocks.join("\n\n")}`,
    textNodeIds: textChips.map((c) => c.id),
  };
}

/** AI 引擎节点（双引擎之一）。 */
export function AiEngineNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const d = data as unknown as AiEngineNodeData;

  const chips = sortUpstreamChips(useUpstreamChips(id));
  const mentionables = useMemo<MentionableItem[]>(
    () => chips.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    [chips],
  );

  const referenced = useMemo(
    () => resolveReferencedNodeIds(d.prompt ?? "", chips),
    [d.prompt, chips],
  );

  const onPickEngine = (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => {
    updateNodeData(id, {
      providerId: next.providerId,
      modelKey: next.modelKey,
      params: next.params,
    });
  };

  const onPromptChange = (value: string) => {
    const refs = resolveReferencedNodeIds(value, chips);
    updateNodeData(id, {
      prompt: value,
      referencedNodeIds: refs,
    });
  };

  const onApplyTemplate = (tpl: AppliedPromptTemplate) => {
    const { prompt, textNodeIds } = buildPromptWithUpstreamParams(
      tpl.content,
      chips,
    );
    const refs = Array.from(
      new Set([...resolveReferencedNodeIds(prompt, chips), ...textNodeIds]),
    );
    updateNodeData(id, {
      prompt,
      referencedNodeIds: refs,
      promptTemplateId: tpl.id,
      promptTemplateNameSnap: tpl.name,
    });
  };

  const text = d.runtime?.textOutput;
  const hasGenerated =
    Boolean(text?.trim()) || d.runtime?.status === "done";
  const isGenerating =
    d.runtime?.status === "running" || d.runtime?.status === "pending";

  return (
    <NodeShell
      title="AI 引擎"
      subtitle={d.modelKey || "未选模型"}
      selected={selected}
      runtime={d.runtime}
      engine
      minWidth={360}
      minHeight={420}
      inputs={[
        { id: "in_text", label: "上游文本", kind: "text" },
        { id: "in_image", label: "上游图片", kind: "image" },
      ]}
      outputs={[{ id: "text", label: "设计方案", kind: "text" }]}
      footer={
        <div className="flex items-center justify-between">
          <span>
            <Sparkles className="inline size-3" /> 输入 @ 引用上游
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--canvas-muted)]">
            LLM
          </span>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        {chips.length > 0 ? (
          <UpstreamChipRow chips={chips} referenced={referenced} />
        ) : (
          <p className="shrink-0 text-[10px] text-[var(--canvas-muted)]">
            （连入图片 / 文本 / 产品参数节点 即可在此引用）
          </p>
        )}

        <div className="min-h-0 flex-1">
          <MentionsTextarea
            value={d.prompt ?? ""}
            onChange={onPromptChange}
            mentionables={mentionables}
            placeholder="连接产品图 + 风格图后，选用提示词模板或自行编辑；@ 可引用上游节点"
            wrapperClassName="flex h-full min-h-0 flex-col"
            className={`${RF_FORM_CONTROL} h-full min-h-[120px] w-full flex-1 resize-none rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[12px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
          />
        </div>

        <div className="shrink-0 space-y-1">
          <PromptTemplatePicker
            engine="LLM"
            currentPrompt={d.prompt ?? ""}
            onApply={onApplyTemplate}
          />
          {d.promptTemplateNameSnap ? (
            <p className="text-[10px] text-white/40">
              模板：{d.promptTemplateNameSnap}
            </p>
          ) : null}
        </div>

        {d.runtime?.failMessage ? (
          <p className="shrink-0 rounded-md border border-red-400/30 bg-red-500/10 p-2 text-[10px] text-red-200">
            {d.runtime?.failCode ? <code className="mr-1">{d.runtime.failCode}</code> : null}
            {d.runtime.failMessage}
          </p>
        ) : null}

        {text ? (
          <div className={`max-h-[100px] shrink-0 overflow-auto rounded-md border border-emerald-500/20 bg-black/40 p-2 text-[11px] leading-relaxed text-white/90 ${RF_NODE_SCROLL}`}>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-emerald-300/80">
              输出 · 设计方案
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans">{text}</pre>
          </div>
        ) : null}

        <div className="mt-auto shrink-0 space-y-1.5 border-t border-white/5 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
            选择模型
          </p>
          <EnginePicker
            role="LLM"
            providerId={d.providerId}
            modelKey={d.modelKey}
            params={d.params ?? {}}
            onChange={onPickEngine}
          />
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("canvas:run-node", {
                  detail: { nodeId: id, forceFresh: hasGenerated },
                }),
              );
            }}
            disabled={!d.providerId || !d.modelKey || isGenerating}
            title={
              isGenerating
                ? "生成进行中"
                : hasGenerated
                  ? "跳过缓存，强制创建新任务"
                  : undefined
            }
            className="nodrag inline-flex w-full items-center justify-center gap-1 rounded-md bg-[var(--canvas-accent)] px-2 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="size-3 animate-spin" /> 生成中…
              </>
            ) : hasGenerated ? (
              <>
                <RefreshCw className="size-3" /> 重新生成
              </>
            ) : (
              <>
                <Play className="size-3" /> 生成
              </>
            )}
          </button>
        </div>
      </div>
    </NodeShell>
  );
}
