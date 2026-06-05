"use client";

import { useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StoryboardPanel } from "@/lib/storyboard-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: StoryboardPanel | null;
  onSave: (panel: StoryboardPanel) => void | Promise<void>;
  saving?: boolean;
};

const FIELDS: Array<{
  key: keyof StoryboardPanel | "visual";
  label: string;
  multiline?: boolean;
}> = [
  { key: "timeline", label: "时间轴" },
  { key: "shotType", label: "景别" },
  { key: "camera", label: "运镜" },
  { key: "visual", label: "画面内容", multiline: true },
  { key: "emotion", label: "情绪" },
  { key: "dialogue", label: "口播台词", multiline: true },
];

export function StoryboardPanelEditDialog({
  open,
  onOpenChange,
  panel,
  onSave,
  saving,
}: Props) {
  const [draft, setDraft] = useState<StoryboardPanel | null>(panel);

  useEffect(() => {
    if (open && panel) setDraft({ ...panel });
  }, [open, panel]);

  if (!draft) return null;

  const visual = `${draft.scene}\n${draft.action}`.trim();

  function setField(key: string, value: string) {
    if (key === "visual") {
      const first = value.split("\n")[0]?.trim() || value.trim() || "—";
      setDraft((d) =>
        d ? { ...d, scene: first, action: value.trim() || first } : d,
      );
      return;
    }
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleSave() {
    if (!draft) return;
    const normalized: StoryboardPanel = {
      ...draft,
      shotType: draft.shotType?.trim() || "中景",
      scene: draft.scene?.trim() || "—",
      action: draft.action?.trim() || draft.scene?.trim() || "—",
    };
    await onSave(normalized);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>修改镜头 {draft.index}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {FIELDS.map(({ key, label, multiline }) => (
            <label key={key} className="block space-y-1.5">
              <span className="text-sm font-medium text-[#1d1d1f]">{label}</span>
              {multiline ? (
                <textarea
                  className="w-full min-h-[88px] resize-y rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30"
                  value={key === "visual" ? visual : String(draft[key as keyof StoryboardPanel] ?? "")}
                  onChange={(e) => setField(key, e.target.value)}
                />
              ) : (
                <input
                  className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30"
                  value={String(draft[key as keyof StoryboardPanel] ?? "")}
                  onChange={(e) => setField(key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>

        <DialogFooter>
          <EcomButtonSecondary
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
