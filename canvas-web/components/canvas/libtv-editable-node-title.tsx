"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useCanvasStore } from "@/lib/canvas/store";
import { cn } from "@/lib/utils";

/** 节点标题栏 · 双击编辑自定义名称（写入 `data.label`） */
export function LibtvEditableNodeTitle({
  nodeId,
  defaultLabel,
  className,
  textClassName,
  children,
}: {
  nodeId: string;
  defaultLabel: string;
  className?: string;
  textClassName?: string;
  children?: ReactNode;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const storedLabel = useCanvasStore(
    useCallback(
      (s) =>
        String(
          (s.nodes.find((n) => n.id === nodeId)?.data as { label?: string })
            ?.label ?? "",
        ).trim(),
      [nodeId],
    ),
  );
  const displayLabel = storedLabel || defaultLabel;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayLabel);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(displayLabel);
  }, [displayLabel, editing]);

  const commit = useCallback(() => {
    const next = draft.trim();
    updateNodeData(nodeId, { label: next || undefined });
    setEditing(false);
  }, [draft, nodeId, updateNodeData]);

  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-1.5", className)}>
      {children}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className={cn(
            "nodrag min-w-0 flex-1 rounded border border-white/20 bg-black/30 px-1.5 py-0.5",
            "text-[11px] text-white outline-none focus:border-white/35",
            textClassName,
          )}
          value={draft}
          maxLength={80}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(displayLabel);
              setEditing(false);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={cn(
            "nodrag min-w-0 flex-1 truncate",
            textClassName ?? "text-[11px] text-white",
          )}
          title={`${displayLabel} · 双击编辑标题`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
            requestAnimationFrame(() => inputRef.current?.select());
          }}
        >
          {displayLabel}
        </span>
      )}
    </div>
  );
}
