"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ensureTagRichTextHtmlDocument,
  isTagRichTextHtml,
  normalizeTagRichTextBody,
} from "./tag-rich-text-migrate";
import { useCanvasStore } from "./store";

const DEFAULT_DEBOUNCE_MS = 300;

function initialDraftFromStore(storedBody: string): string {
  if (isTagRichTextHtml(storedBody)) {
    return ensureTagRichTextHtmlDocument(storedBody);
  }
  return normalizeTagRichTextBody(storedBody);
}

/** 标签节点 body · 本地 draft + debounce 写 store（取消选中 / 卸载时 flush） */
export function useTagRichTextCommit(
  nodeId: string,
  storedBody: string,
  debounceMs = DEFAULT_DEBOUNCE_MS,
) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const storedIsHtml = isTagRichTextHtml(storedBody);

  const normalizedStored = useMemo(
    () => initialDraftFromStore(storedBody),
    [storedBody],
  );

  const [draft, setDraft] = useState(normalizedStored);
  const draftRef = useRef(normalizedStored);
  const lastCommittedRef = useRef(normalizedStored);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const writeStore = useCallback(
    (html: string, commit: boolean) => {
      const doc = ensureTagRichTextHtmlDocument(html);
      if (doc === lastCommittedRef.current) return;
      lastCommittedRef.current = doc;
      updateNodeData(nodeId, { body: doc }, { commit });
    },
    [nodeId, updateNodeData],
  );

  const flush = useCallback(
    (next?: string) => {
      clearTimer();
      pendingRef.current = null;
      const doc = ensureTagRichTextHtmlDocument(next ?? draftRef.current);
      draftRef.current = doc;
      setDraft(doc);
      writeStore(doc, true);
    },
    [clearTimer, writeStore],
  );

  const schedule = useCallback(
    (next: string) => {
      const doc = ensureTagRichTextHtmlDocument(next);
      draftRef.current = doc;
      setDraft(doc);
      pendingRef.current = doc;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending == null) return;
        const html = ensureTagRichTextHtmlDocument(pending);
        draftRef.current = html;
        setDraft(html);
        writeStore(html, false);
      }, debounceMs);
    },
    [clearTimer, debounceMs, writeStore],
  );

  useEffect(() => {
    if (pendingRef.current !== null || timerRef.current !== null) return;
    lastCommittedRef.current = normalizedStored;
    draftRef.current = normalizedStored;
    setDraft(normalizedStored);
  }, [normalizedStored, nodeId]);

  useEffect(
    () => () => {
      if (timerRef.current === null && pendingRef.current === null) return;
      clearTimer();
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending == null) return;
      const html = ensureTagRichTextHtmlDocument(pending);
      if (html === lastCommittedRef.current) return;
      lastCommittedRef.current = html;
      updateNodeData(nodeId, { body: html }, { commit: true });
    },
    [clearTimer, nodeId, updateNodeData],
  );

  return { draft, schedule, flush, storedIsHtml };
}
