"use client";

import { useRef, type KeyboardEvent } from "react";
import { onCanvasFormWheel } from "@/lib/canvas/canvas-form-wheel";
import {
  useDeferredTextCommit,
  type DeferredTextCommitMeta,
} from "@/lib/canvas/use-deferred-text-commit";
import { RF_FORM_CONTROL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";

type CanvasPromptTextareaProps = {
  value: string;
  onChange: (value: string, meta?: DeferredTextCommitMeta) => void;
  className?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

/** 画布节点内 prompt 输入：本地 draft + debounce 写 store；IME 组合期间不提交 */
export function CanvasPromptTextarea({
  value,
  onChange,
  className,
  rows,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: CanvasPromptTextareaProps) {
  const { draft, setDraft, schedule, flush, onFocus, onBlur } =
    useDeferredTextCommit(value, onChange);
  const composingRef = useRef(false);

  const stopFlowKeys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
  };

  return (
    <textarea
      value={draft}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        RF_FORM_CONTROL,
        "overflow-y-auto",
        className,
      )}
      onWheel={onCanvasFormWheel}
      onFocus={onFocus}
      onChange={(e) => {
        const next = e.target.value;
        if (composingRef.current) {
          setDraft(next);
          return;
        }
        schedule(next);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        flush(e.currentTarget.value);
      }}
      onBlur={(e) => {
        onBlur(e.currentTarget.value);
      }}
      onKeyDown={stopFlowKeys}
      onKeyUp={stopFlowKeys}
    />
  );
}
