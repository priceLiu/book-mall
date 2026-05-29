"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { onCanvasFormWheel } from "@/lib/canvas/canvas-form-wheel";
import { RF_FORM_CONTROL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";

type CanvasPromptTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

/** 画布节点内 prompt 输入：IME 组合期间不写 store，避免中文拼音被打断 */
export function CanvasPromptTextarea({
  value,
  onChange,
  className,
  rows,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: CanvasPromptTextareaProps) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);

  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);

  const commit = (next: string) => {
    setDraft(next);
    onChange(next);
  };

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
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (!composingRef.current) onChange(next);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        commit(e.currentTarget.value);
      }}
      onBlur={(e) => {
        if (composingRef.current) return;
        const next = e.currentTarget.value;
        if (next !== value) onChange(next);
      }}
      onKeyDown={stopFlowKeys}
      onKeyUp={stopFlowKeys}
    />
  );
}
