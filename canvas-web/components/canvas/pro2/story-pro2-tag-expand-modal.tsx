"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Editor } from "@tiptap/react";

import {
  CANVAS_MODAL_BACKDROP_CLASS,
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import { ensureTagRichTextHtmlDocument } from "@/lib/canvas/tag-rich-text-migrate";
import { TagRichTextEditor } from "./tag-rich-text-editor.client";
import { TagRichTextToolbar } from "./tag-rich-text-toolbar";

export function StoryPro2TagExpandModal({
  open,
  title,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onSave: (body: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editor, setEditor] = useState<Editor | null>(null);
  const html = useMemo(() => ensureTagRichTextHtmlDocument(draft), [draft]);
  const mounted = useClientPortalMounted();
  useModalBodyScrollLock(open);
  useModalEscapeClose(onClose, { active: open });

  useEffect(() => {
    if (!open) return;
    setDraft(ensureTagRichTextHtmlDocument(value));
  }, [open, value]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={`${CANVAS_MODAL_BACKDROP_CLASS} z-[1200] flex flex-col`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="nodrag flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-white/90">{title}</p>
        <button
          type="button"
          className="nodrag rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          onClick={() => {
            onSave(html);
            onClose();
          }}
        >
          完成
        </button>
        <button
          type="button"
          className="nodrag inline-flex size-9 items-center justify-center rounded-lg border border-white/15 text-white/80 hover:bg-white/10"
          aria-label="关闭"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="nodrag flex min-h-0 flex-1 flex-col gap-3 p-4">
        <TagRichTextToolbar editor={editor} />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#141418] p-4">
          <TagRichTextEditor
            content={html}
            editable
            className="text-sm"
            placeholder="输入标注内容…"
            onUpdate={setDraft}
            onEditor={setEditor}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
