"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DEFER_MS = 480;

export type DeferredTextCommitMeta = { commit: boolean };

export type DeferredTextCommitHandler = (
  value: string,
  meta: DeferredTextCommitMeta,
) => void;

/** 画布文本输入：本地 draft；debounce 写草稿，blur 正式 commit */
export function useDeferredTextCommit(
  value: string,
  onChange: DeferredTextCommitHandler,
  debounceMs = DEFAULT_DEFER_MS,
) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(
    (next: string) => {
      clearTimer();
      setDraft(next);
      onChangeRef.current(next, { commit: true });
    },
    [clearTimer],
  );

  const schedule = useCallback(
    (next: string) => {
      setDraft(next);
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        onChangeRef.current(next, { commit: false });
      }, debounceMs);
    },
    [clearTimer, debounceMs],
  );

  useEffect(() => clearTimer, [clearTimer]);

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
