"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { deleteCanvasTemplate } from "@/lib/canvas-api";
import { cn } from "@/lib/utils";

type Props = {
  templateId: string;
  templateName: string;
  onDeleted: () => void;
  className?: string;
};

/** 管理员 · 门户首页删除社区/精选模板（二次确认） */
export function TemplateAdminDeleteButton({
  templateId,
  templateName,
  onDeleted,
  className,
}: Props) {
  const base = useBookMallBaseUrl();
  const { doubleConfirm, alert } = useDialogs();
  const [deleting, setDeleting] = useState(false);

  return (
    <button
      type="button"
      disabled={deleting}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-red-400/25 px-2 py-1 text-[11px] text-red-300/90 hover:border-red-400/45 hover:bg-red-500/10 disabled:opacity-50",
        className,
      )}
      onClick={() => {
        void (async () => {
          if (!base?.trim()) return;
          const ok = await doubleConfirm({
            first: {
              title: `删除模板「${templateName}」？`,
              message: "将从首页社区/精选列表移除该模板。",
              confirmLabel: "继续",
              danger: true,
            },
            second: {
              title: "再次确认 · 不可恢复",
              message:
                "将永久删除模板记录；他人已复制到画布的副本不受影响。",
              confirmLabel: "永久删除",
              danger: true,
            },
          });
          if (!ok) return;
          setDeleting(true);
          try {
            await deleteCanvasTemplate(base, templateId);
            onDeleted();
          } catch (e) {
            await alert({
              title: "删除失败",
              message: e instanceof Error ? e.message : "请稍后重试",
              variant: "error",
            });
          } finally {
            setDeleting(false);
          }
        })();
      }}
    >
      {deleting ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Trash2 className="size-3" />
      )}
      删除模板
    </button>
  );
}
