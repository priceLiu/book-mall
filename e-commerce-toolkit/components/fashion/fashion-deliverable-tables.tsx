"use client";

import { Check, Loader2, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { FashionPanelRow, FashionSellpoint, FashionVersionKey } from "@/lib/fashion-types";
import type { ProPanelRow } from "@/lib/pro-vertical/types";
import { normalizeFashionOpsPack } from "@/lib/fashion-ops-pack-format";

type StoryboardPanelRow = FashionPanelRow | ProPanelRow;
import { nextFashionSellpointId } from "@/lib/fashion-workflow";
import { cn } from "@/lib/utils";

function escCell(text: unknown): string {
  const s = text == null ? "" : String(text);
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

const LAYER_LABELS: Record<string, string> = {
  core: "核心",
  visual: "视觉",
  aux: "辅助",
};

export function FashionParamsTable({
  dimensions,
  dimensionLabels,
}: {
  dimensions: Partial<Record<string, string>>;
  /** 七维列 label；未传时用服装默认 */
  dimensionLabels?: Array<{ key: string; label: string }>;
}) {
  const rows = dimensionLabels?.length
    ? dimensionLabels.map(({ key, label }) => [label, dimensions[key]] as const)
    : [
        ["性别品类", dimensions.genderCategory],
        ["款式品类", dimensions.styleCategory],
        ["风格属性", dimensions.styleAttribute],
        ["档次定位", dimensions.tier],
        ["自定义场景", dimensions.customScene],
        ["发布平台", dimensions.platform],
        ["输出语言", dimensions.outputLanguage],
      ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-[#f0f0f2]">
              <td className="py-2 pr-4 text-xs font-medium text-[#6e6e73]">{label}</td>
              <td className="py-2 text-[#1d1d1f]">{value?.trim() || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LAYER_OPTIONS: Array<{ value: FashionSellpoint["layer"]; label: string }> = [
  { value: "core", label: "核心" },
  { value: "visual", label: "视觉" },
  { value: "aux", label: "辅助" },
];

function FashionEditableTextCell({
  value,
  editable,
  saving,
  editTitle = "编辑",
  rows = 2,
  onSave,
}: {
  value: string;
  editable?: boolean;
  saving?: boolean;
  editTitle?: string;
  rows?: number;
  onSave: (text: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  async function commit() {
    const next = draft.trim();
    if (!next || next === value.trim()) {
      setDraft(value);
      setEditing(false);
      return;
    }
    await onSave(next);
    setEditing(false);
  }

  if (!editable) {
    return <span>{value}</span>;
  }

  if (editing) {
    return (
      <div className="relative z-10 w-full min-w-0 max-w-full space-y-1">
        <textarea
          className="box-border w-full max-w-full min-w-0 resize-y rounded-lg border border-[#0071e3]/40 bg-white px-2 py-1.5 text-sm text-[#1d1d1f] outline-none ring-2 ring-[#0071e3]/15"
          rows={rows}
          value={draft}
          disabled={saving}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
        />
        <div className="flex flex-wrap gap-1">
          <EcomButtonPrimary
            size="sm"
            type="button"
            className="h-7 px-2 text-[11px]"
            disabled={saving}
            onClick={() => void commit()}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            保存
          </EcomButtonPrimary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            className="h-7 px-2 text-[11px]"
            disabled={saving}
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
          >
            取消
          </EcomButtonSecondary>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-start gap-1">
      <span className="min-w-0 flex-1 break-words">{value}</span>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-[#86868b] opacity-0 transition hover:bg-[#f0f0f2] hover:text-[#1d1d1f] group-hover:opacity-100"
        title={editTitle}
        disabled={saving}
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function FashionSellpointsTable({
  sellpoints,
  editable = false,
  saving = false,
  onSaveSellpoints,
}: {
  sellpoints: FashionSellpoint[];
  editable?: boolean;
  saving?: boolean;
  onSaveSellpoints?: (sellpoints: FashionSellpoint[]) => void | Promise<void>;
}) {
  if (!sellpoints.length && !editable) return <p className="text-sm text-[#86868b]">暂无卖点</p>;

  function handleAddRow() {
    if (!onSaveSellpoints) return;
    const id = nextFashionSellpointId(sellpoints);
    void onSaveSellpoints([
      ...sellpoints,
      { id, text: "新卖点", layer: "core", source: "user" },
    ]);
  }

  if (!sellpoints.length && editable) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#86868b]">尚未添加卖点，请逐条填写您的核心卖点。</p>
        <button
          type="button"
          className="rounded-lg border border-[#d2d2d7] bg-white px-3 py-1.5 text-sm text-[#1d1d1f] hover:border-[#0071e3]"
          disabled={saving}
          onClick={handleAddRow}
        >
          添加卖点
        </button>
      </div>
    );
  }

  function patchSellpoint(id: string, patch: Partial<FashionSellpoint>) {
    if (!onSaveSellpoints) return;
    const next = sellpoints.map((sp) => {
      if (sp.id !== id) return sp;
      const merged = { ...sp, ...patch };
      if (patch.text != null && patch.text.trim() !== sp.text.trim()) {
        merged.source = "user";
      }
      return merged;
    });
    void onSaveSellpoints(next);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#e8e8ed] text-left text-xs text-[#6e6e73]">
              <th className="py-2 pr-2">ID</th>
              <th className="py-2 pr-2">卖点</th>
              <th className="py-2 pr-2">分层</th>
              <th className="py-2">来源</th>
            </tr>
          </thead>
          <tbody>
            {sellpoints.map((sp) => (
              <tr key={sp.id} className="border-b border-[#f0f0f2] align-top">
                <td className="py-2 pr-2 font-mono text-xs">{sp.id}</td>
                <td className="py-2 pr-2">
                  <FashionEditableTextCell
                    value={sp.text}
                    editable={editable}
                    saving={saving}
                    editTitle="编辑卖点"
                    onSave={(text) => patchSellpoint(sp.id, { text })}
                  />
                </td>
                <td className="py-2 pr-2">
                  {editable ? (
                    <select
                      className="rounded-lg border border-[#d2d2d7] bg-white px-2 py-1 text-xs outline-none focus:border-[#0071e3]"
                      value={sp.layer}
                      disabled={saving}
                      onChange={(e) =>
                        patchSellpoint(sp.id, {
                          layer: e.target.value as FashionSellpoint["layer"],
                        })
                      }
                    >
                      {LAYER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    LAYER_LABELS[sp.layer] ?? sp.layer
                  )}
                </td>
                <td className="py-2">
                  {sp.source === "user" ? "用户" : sp.source === "ai" ? "AI" : "补充"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <EcomButtonSecondary
          type="button"
          size="sm"
          className={cn("gap-1", saving && "pointer-events-none opacity-60")}
          disabled={saving}
          onClick={handleAddRow}
        >
          <Plus className="h-3.5 w-3.5" />
          新增卖点
        </EcomButtonSecondary>
      ) : null}
    </div>
  );
}

/** 会话区只读展示：已定稿 / 已选版分镜脚本 */
export function FashionStoryboardResultBlock({
  versionKey,
  title,
  panels,
  sellpoints,
  locked = false,
}: {
  versionKey: FashionVersionKey;
  title?: string;
  panels: StoryboardPanelRow[];
  sellpoints?: FashionSellpoint[];
  locked?: boolean;
}) {
  if (!panels.length) return null;
  return (
    <div className="rounded-lg border border-[#e8e8ed] bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-[#6e6e73]">
        12.1 · 分镜脚本表（{versionKey}版{title ? ` · ${title}` : ""}
        {locked ? " · 已定稿" : ""}）
      </p>
      <FashionPanelsTable panels={panels} sellpoints={sellpoints} />
    </div>
  );
}

export function FashionPanelsTable({
  panels,
  sellpoints,
  panelFocusLabel = "展示重点",
  editable = false,
  saving = false,
  onSavePanels,
}: {
  panels: StoryboardPanelRow[];
  sellpoints?: FashionSellpoint[];
  panelFocusLabel?: string;
  editable?: boolean;
  saving?: boolean;
  onSavePanels?: (panels: FashionPanelRow[]) => void | Promise<void>;
}) {
  const spMap = new Map((sellpoints ?? []).map((sp) => [sp.id, sp.text]));
  if (!panels.length) return <p className="text-sm text-[#86868b]">暂无分镜</p>;

  function patchPanel(index: FashionPanelRow["index"], patch: Partial<FashionPanelRow>) {
    if (!onSavePanels) return;
    const next = panels.map((p) => (p.index === index ? { ...p, ...patch } : p));
    void onSavePanels(next as FashionPanelRow[]);
  }

  function parseSellpointIds(raw: string): string[] {
    return raw
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[72rem] table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-10" />
          <col className="w-16" />
          <col className="w-12" />
          <col className="w-16" />
          <col className="w-32" />
          <col className="w-40" />
          <col className="w-48" />
          <col className="w-48" />
          <col className="w-32" />
          <col className="w-32" />
          <col className="w-32" />
          <col className="w-24" />
        </colgroup>
        <thead>
          <tr className="border-b border-[#e8e8ed] text-left text-[#6e6e73]">
            {[
              "镜号",
              "景别",
              "时长",
              "运镜",
              "场景",
              "场景Prompt",
              "生图Prompt",
              "生视频Prompt",
              "动作",
              panelFocusLabel,
              "口播",
              "卖点ID",
            ].map((h) => (
              <th key={h} className="px-1 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {panels.map((p) => (
            <tr key={p.index} className="border-b border-[#f0f0f2] align-top text-[#1d1d1f]">
              <td className="min-w-0 px-1 py-2">{p.index}</td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.shotScale)}
                    editable
                    saving={saving}
                    editTitle="编辑景别"
                    onSave={(text) => patchPanel(p.index, { shotScale: text })}
                  />
                ) : (
                  escCell(p.shotScale)
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={String(p.durationSec)}
                    editable
                    saving={saving}
                    editTitle="编辑时长"
                    onSave={(text) => {
                      const n = Number.parseInt(text, 10);
                      if (Number.isFinite(n) && n > 0) patchPanel(p.index, { durationSec: n });
                    }}
                  />
                ) : (
                  `${p.durationSec}s`
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.cameraMove)}
                    editable
                    saving={saving}
                    editTitle="编辑运镜"
                    onSave={(text) => patchPanel(p.index, { cameraMove: text })}
                  />
                ) : (
                  escCell(p.cameraMove)
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.sceneDesc)}
                    editable
                    saving={saving}
                    editTitle="编辑场景"
                    onSave={(text) => patchPanel(p.index, { sceneDesc: text })}
                  />
                ) : (
                  escCell(p.sceneDesc)
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.scenePrompt)}
                    editable
                    saving={saving}
                    editTitle="编辑场景 Prompt"
                    onSave={(text) => patchPanel(p.index, { scenePrompt: text })}
                  />
                ) : (
                  escCell(p.scenePrompt)
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.imagePrompt)}
                    editable
                    saving={saving}
                    rows={4}
                    editTitle="编辑生图 Prompt"
                    onSave={(text) => patchPanel(p.index, { imagePrompt: text })}
                  />
                ) : (
                  escCell(p.imagePrompt)
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.videoPrompt)}
                    editable
                    saving={saving}
                    rows={4}
                    editTitle="编辑生视频 Prompt"
                    onSave={(text) => patchPanel(p.index, { videoPrompt: text })}
                  />
                ) : (
                  escCell(p.videoPrompt)
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.modelAction)}
                    editable
                    saving={saving}
                    editTitle="编辑动作"
                    onSave={(text) => patchPanel(p.index, { modelAction: text })}
                  />
                ) : (
                  escCell(p.modelAction)
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.productFocus ?? p.garmentFocus ?? "")}
                    editable
                    saving={saving}
                    editTitle="编辑展示重点"
                    onSave={(text) =>
                      patchPanel(p.index, {
                        productFocus: text,
                        garmentFocus: text,
                      })
                    }
                  />
                ) : (
                  escCell(p.productFocus ?? p.garmentFocus ?? "")
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={escCell(p.dialogue ?? "")}
                    editable
                    saving={saving}
                    editTitle="编辑口播"
                    onSave={(text) => patchPanel(p.index, { dialogue: text })}
                  />
                ) : (
                  escCell(p.dialogue)
                )}
              </td>
              <td className="min-w-0 px-1 py-2">
                {editable ? (
                  <FashionEditableTextCell
                    value={p.sellpointIds.join("、")}
                    editable
                    saving={saving}
                    editTitle="编辑卖点ID"
                    onSave={(text) => patchPanel(p.index, { sellpointIds: parseSellpointIds(text) })}
                  />
                ) : (
                  p.sellpointIds.map((id) => spMap.get(id) ?? id).join("、") || "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FashionCoverageTable({
  sellpoints,
  panels,
}: {
  sellpoints: FashionSellpoint[];
  panels: StoryboardPanelRow[];
}) {
  const coreVisual = sellpoints.filter((sp) => sp.layer !== "aux");
  if (!coreVisual.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[24rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#e8e8ed] text-left text-xs text-[#6e6e73]">
            <th className="py-2 pr-2">卖点ID</th>
            <th className="py-2 pr-2">内容</th>
            <th className="py-2 pr-2">分层</th>
            <th className="py-2 pr-2">镜号</th>
            <th className="py-2">落地</th>
          </tr>
        </thead>
        <tbody>
          {coreVisual.map((sp) => {
            const indexes = panels
              .filter((p) => p.sellpointIds.includes(sp.id))
              .map((p) => p.index);
            return (
              <tr key={sp.id} className="border-b border-[#f0f0f2]">
                <td className="py-2 pr-2 font-mono text-xs">{sp.id}</td>
                <td className="py-2 pr-2">{sp.text}</td>
                <td className="py-2 pr-2">{LAYER_LABELS[sp.layer] ?? sp.layer}</td>
                <td className="py-2 pr-2">{indexes.join(",") || "—"}</td>
                <td className="py-2">{indexes.length ? "✅" : "❌"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FashionOpsPackBlock({
  ops,
}: {
  ops?: {
    titles?: unknown[];
    coverWords?: unknown[];
    tags?: unknown[];
    xiaohongshuBody?: unknown;
    detailBullets?: unknown[];
  };
}) {
  const normalized = normalizeFashionOpsPack(
    ops as Parameters<typeof normalizeFashionOpsPack>[0],
  );
  if (
    !normalized ||
    (!normalized.titles?.length &&
      !normalized.coverWords?.length &&
      !normalized.tags?.length &&
      !normalized.xiaohongshuBody &&
      !normalized.detailBullets?.length)
  ) {
    return <p className="text-sm text-[#86868b]">运营包待生成</p>;
  }
  return (
    <div className="space-y-4 text-sm text-[#1d1d1f]">
      {normalized.titles?.length ? (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-[#6e6e73]">爆款标题</h4>
          <ul className="list-inside list-disc space-y-0.5">
            {normalized.titles.map((t, i) => (
              <li key={`${t}-${i}`}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {normalized.coverWords?.length ? (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-[#6e6e73]">封面词</h4>
          <p>{normalized.coverWords.join(" · ")}</p>
        </div>
      ) : null}
      {normalized.tags?.length ? (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-[#6e6e73]">标签</h4>
          <p>{normalized.tags.join(" ")}</p>
        </div>
      ) : null}
      {normalized.xiaohongshuBody ? (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-[#6e6e73]">小红书正文</h4>
          <p className="whitespace-pre-wrap">{normalized.xiaohongshuBody}</p>
        </div>
      ) : null}
      {normalized.detailBullets?.length ? (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-[#6e6e73]">详情要点</h4>
          <ul className="list-inside list-disc space-y-0.5">
            {normalized.detailBullets.map((t, i) => (
              <li key={`${t}-${i}`}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
