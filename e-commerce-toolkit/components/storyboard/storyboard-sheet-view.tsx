"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  StoryboardReference,
  StoryboardSheet,
} from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  editable?: boolean;
  onChange?: (sheet: StoryboardSheet) => void;
  className?: string;
  exportRootId?: string;
};

function normalizePanelFields(sheet: StoryboardSheet): StoryboardSheet {
  return {
    ...sheet,
    panels: sheet.panels.map((p) => ({
      ...p,
      shotType: p.shotType?.trim() || "中景",
      scene: p.scene?.trim() || "—",
      action: p.action?.trim() || p.scene?.trim() || "—",
    })),
  };
}

export function StoryboardSheetView({
  sheet,
  references,
  editable,
  onChange,
  className,
  exportRootId = "storyboard-sheet-export",
}: Props) {
  const [draft, setDraft] = useState(() => normalizePanelFields(sheet));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef(false);
  const lastSavedSig = useRef(JSON.stringify(normalizePanelFields(sheet)));

  const refMap = new Map(references.map((r) => [r.id, r]));

  useEffect(() => {
    const sig = JSON.stringify(sheet);
    if (sig === lastSavedSig.current) {
      editingRef.current = false;
    }
    if (!editingRef.current) {
      setDraft(normalizePanelFields(sheet));
      lastSavedSig.current = sig;
    }
  }, [sheet]);

  const scheduleSave = useCallback(
    (next: StoryboardSheet) => {
      if (!onChange) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const normalized = normalizePanelFields(next);
        lastSavedSig.current = JSON.stringify(normalized);
        editingRef.current = false;
        onChange(normalized);
      }, 500);
    },
    [onChange],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function updatePanel(
    index: number,
    patch: Partial<StoryboardSheet["panels"][0]>,
  ) {
    editingRef.current = true;
    const panels = draft.panels.map((p) =>
      p.index === index ? { ...p, ...patch } : p,
    );
    const next = { ...draft, panels };
    setDraft(next);
    scheduleSave(next);
  }

  function commitField(index: number, field: "shotType" | "scene" | "action", raw: string) {
    const value = raw.trim() || (field === "shotType" ? "中景" : "—");
    updatePanel(index, { [field]: value });
  }

  return (
    <div
      id={exportRootId}
      className={cn(
        "w-full max-w-[1920px] bg-white p-8 text-[#1d1d1f]",
        className,
      )}
    >
      <header className="mb-6 border-b border-[#e8e8ed] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {draft.overview.title}
        </h1>
        <p className="mt-2 text-sm text-[#6e6e73]">{draft.overview.logline}</p>
        {draft.overview.productHighlight ? (
          <div className="mt-4 rounded-lg border-l-4 border-[#0071e3] bg-[#f5f5f7] px-4 py-3 text-sm">
            <span className="font-medium">商品卖点：</span>
            {draft.overview.productHighlight}
          </div>
        ) : null}
      </header>

      {draft.cast.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold">角色参考</h2>
          <div className="flex flex-wrap gap-4">
            {draft.cast.map((c) => {
              const ref = c.refId ? refMap.get(c.refId) : undefined;
              return (
                <div
                  key={`${c.name}-${c.role}`}
                  className="flex items-center gap-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-3"
                >
                  {ref ? (
                    <Image
                      src={ref.ossUrl}
                      alt={c.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-lg object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e8e8ed] text-xs text-[#6e6e73]">
                      无图
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-[#6e6e73]">{c.role}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-base font-semibold">分镜表</h2>
        <div className="overflow-x-auto rounded-xl border border-[#e8e8ed]">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#1d1d1f] text-white">
                <th className="px-3 py-2.5 font-medium">镜头编号</th>
                <th className="px-3 py-2.5 font-medium">时间轴</th>
                <th className="px-3 py-2.5 font-medium">景别</th>
                <th className="px-3 py-2.5 font-medium">运镜</th>
                <th className="px-3 py-2.5 font-medium">画面内容</th>
                <th className="px-3 py-2.5 font-medium">情绪</th>
                <th className="px-3 py-2.5 font-medium">口播台词</th>
              </tr>
            </thead>
            <tbody>
              {draft.panels.map((p) => (
                <tr key={p.index} className="border-t border-[#e8e8ed]">
                  <td className="px-3 py-2.5 align-top font-medium">{p.index}</td>
                  <td className="px-3 py-2.5 align-top text-[#6e6e73]">
                    {editable ? (
                      <input
                        className="w-full min-w-[4rem] rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30"
                        value={p.timeline ?? ""}
                        onChange={(e) =>
                          updatePanel(p.index, { timeline: e.target.value })
                        }
                      />
                    ) : (
                      (p.timeline ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {editable ? (
                      <input
                        className="w-full min-w-[3rem] rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30"
                        value={p.shotType}
                        onChange={(e) =>
                          updatePanel(p.index, { shotType: e.target.value })
                        }
                        onBlur={(e) =>
                          commitField(p.index, "shotType", e.target.value)
                        }
                      />
                    ) : (
                      p.shotType
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {editable ? (
                      <input
                        className="w-full min-w-[3rem] rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30"
                        value={p.camera ?? ""}
                        onChange={(e) =>
                          updatePanel(p.index, { camera: e.target.value })
                        }
                      />
                    ) : (
                      (p.camera ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {editable ? (
                      <textarea
                        className="w-full min-h-[72px] resize-y rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-sm leading-relaxed outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30"
                        value={`${p.scene}\n${p.action}`.trim()}
                        onChange={(e) => {
                          const v = e.target.value;
                          const firstLine = v.split("\n")[0]?.trim() || v.trim() || "—";
                          updatePanel(p.index, {
                            scene: firstLine,
                            action: v.trim() || firstLine,
                          });
                        }}
                      />
                    ) : (
                      <>
                        <div>{p.scene}</div>
                        <div className="text-[#6e6e73]">{p.action}</div>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {editable ? (
                      <input
                        className="w-full min-w-[4rem] rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30"
                        value={p.emotion ?? ""}
                        onChange={(e) =>
                          updatePanel(p.index, { emotion: e.target.value })
                        }
                      />
                    ) : (
                      (p.emotion ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {editable ? (
                      <textarea
                        className="w-full min-h-[72px] resize-y rounded border border-[#d2d2d7] bg-white px-2 py-1.5 text-sm leading-relaxed outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/30"
                        value={p.dialogue ?? ""}
                        onChange={(e) =>
                          updatePanel(p.index, { dialogue: e.target.value })
                        }
                      />
                    ) : (
                      (p.dialogue ?? "—")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {draft.totalDurationHintSec ? (
          <p className="mt-3 text-xs text-[#6e6e73]">
            建议总时长约 {draft.totalDurationHintSec} 秒
          </p>
        ) : null}
      </section>
    </div>
  );
}
