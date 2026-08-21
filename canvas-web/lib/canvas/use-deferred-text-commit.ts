"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DEFER_MS = 480;

export type DeferredTextCommitMeta = { commit: boolean };

export type DeferredTextCommitHandler = (
  value: string,
  meta: DeferredTextCommitMeta,
) => void;

/** 切换 source（节点）时：有未发出的 debounce 则冲到旧 handler，并重置 draft */
export function planDeferredCommitOnSourceSwitch(args: {
  prevSourceKey: string | undefined;
  nextSourceKey: string | undefined;
  pendingValue: string | null;
}): { flushValue: string | null; resetDraft: boolean } {
  if (args.nextSourceKey === args.prevSourceKey) {
    return { flushValue: null, resetDraft: false };
  }
  return {
    flushValue: args.pendingValue,
    resetDraft: true,
  };
}

/** 画布文本输入：本地 draft；debounce 写草稿，blur 正式 commit */
export function useDeferredTextCommit(
  value: string,
  onChange: DeferredTextCommitHandler,
  debounceMs = DEFAULT_DEFER_MS,
  sourceKey?: string,
) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const draftRef = useRef(value);
  const pendingHandlerRef = useRef(onChange);
  const sourceKeyRef = useRef(sourceKey);
  const pendingValueRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingValueRef.current = null;
  }, []);

  const flush = useCallback(
    (next: string) => {
      clearTimer();
      draftRef.current = next;
      setDraft(next);
      onChangeRef.current(next, { commit: true });
    },
    [clearTimer],
  );

  const schedule = useCallback(
    (next: string) => {
      draftRef.current = next;
      setDraft(next);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      const handler = onChangeRef.current;
      pendingHandlerRef.current = handler;
      pendingValueRef.current = next;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        pendingValueRef.current = null;
        handler(next, { commit: false });
      }, debounceMs);
    },
    [debounceMs],
  );

  useEffect(() => {
    const plan = planDeferredCommitOnSourceSwitch({
      prevSourceKey: sourceKeyRef.current,
      nextSourceKey: sourceKey,
      pendingValue: pendingValueRef.current,
    });
    sourceKeyRef.current = sourceKey;
    if (!plan.resetDraft) return;
    if (plan.flushValue != null) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingValueRef.current = null;
      pendingHandlerRef.current(plan.flushValue, { commit: true });
    }
    focusedRef.current = false;
    draftRef.current = value;
    setDraft(value);
  }, [sourceKey, value]);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current === null) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      const pending = pendingValueRef.current;
      pendingValueRef.current = null;
      if (pending != null) {
        pendingHandlerRef.current(pending, { commit: true });
      }
    },
    [],
  );

  const onFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const onBlur = useCallback(
    (next: string) => {
      focusedRef.current = false;
      flush(next);
    },
    [flush],
  );

  return {
    draft,
    setDraft,
    schedule,
    flush,
    onFocus,
    onBlur,
    focusedRef,
  };
}
