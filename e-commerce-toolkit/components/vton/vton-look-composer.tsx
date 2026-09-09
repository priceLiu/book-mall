"use client";

import { useEffect, useRef } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomRefImageThumb } from "@/components/media/ecom-ref-image-thumb";
import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  VTON_GARMENT_KIND_LABELS,
  VTON_LOOK_KIND_LABELS,
  type VtonGarmentItem,
  type VtonLookKind,
  type VtonLookSpec,
} from "@/lib/vton-types";
import { cn } from "@/lib/utils";

type Props = {
  looks: VtonLookSpec[];
  pool: VtonGarmentItem[];
  selectedLookIds: string[];
  onToggleLookSelection: (lookId: string) => void;
  onSelectAllLooks: () => void;
  onClearLookSelection: () => void;
  busy?: boolean;
  disabled?: boolean;
  onChange: (looks: VtonLookSpec[]) => Promise<void>;
  onCartesian?: (topIds: string[], bottomIds: string[]) => Promise<void>;
};

type VtonGarmentKind = VtonGarmentItem["kind"];

type GarmentField = "topGarmentId" | "bottomGarmentId" | "onePieceGarmentId" | "fullSetGarmentId";

function newLookId(): string {
  return crypto.randomUUID();
}

function isGenericGarmentLabel(label: string | undefined): boolean {
  if (!label?.trim()) return true;
  const n = label.trim().toLowerCase();
  return (
    n === "image" ||
    n === "img" ||
    n === "photo" ||
    n === "picture" ||
    /^img[_-]?\d*$/i.test(n) ||
    /^image[_-]?\d*$/i.test(n)
  );
}

function garmentDisplayLabel(g: VtonGarmentItem, kindLabel: string, index: number): string {
  if (!isGenericGarmentLabel(g.label)) return g.label!.trim();
  return `${kindLabel} ${index + 1}`;
}

function defaultGarmentForKind(
  pool: VtonGarmentItem[],
  kind: VtonGarmentKind,
  excludeIds: Set<string> = new Set(),
): string | undefined {
  const candidates = pool.filter((g) => g.kind === kind);
  return candidates.find((g) => !excludeIds.has(g.id))?.id ?? candidates[0]?.id;
}

function usedGarmentIds(looks: VtonLookSpec[]): Set<string> {
  const ids = new Set<string>();
  for (const look of looks) {
    if (look.topGarmentId) ids.add(look.topGarmentId);
    if (look.bottomGarmentId) ids.add(look.bottomGarmentId);
    if (look.onePieceGarmentId) ids.add(look.onePieceGarmentId);
    if (look.fullSetGarmentId) ids.add(look.fullSetGarmentId);
  }
  return ids;
}

function defaultGarmentIdsForLookKind(
  kind: VtonLookKind,
  pool: VtonGarmentItem[],
  excludeIds: Set<string> = new Set(),
): Partial<VtonLookSpec> {
  if (kind === "two_piece") {
    return {
      topGarmentId: defaultGarmentForKind(pool, "top", excludeIds),
      bottomGarmentId: defaultGarmentForKind(pool, "bottom", excludeIds),
      onePieceGarmentId: undefined,
      fullSetGarmentId: undefined,
    };
  }
  if (kind === "one_piece") {
    return {
      onePieceGarmentId: defaultGarmentForKind(pool, "one_piece", excludeIds),
      topGarmentId: undefined,
      bottomGarmentId: undefined,
      fullSetGarmentId: undefined,
    };
  }
  if (kind === "full_set") {
    return {
      fullSetGarmentId: defaultGarmentForKind(pool, "full_set", excludeIds),
      topGarmentId: undefined,
      bottomGarmentId: undefined,
      onePieceGarmentId: undefined,
    };
  }
  if (kind === "top_only") {
    return {
      topGarmentId: defaultGarmentForKind(pool, "top", excludeIds),
      bottomGarmentId: undefined,
      onePieceGarmentId: undefined,
      fullSetGarmentId: undefined,
    };
  }
  return {
    bottomGarmentId: defaultGarmentForKind(pool, "bottom", excludeIds),
    topGarmentId: undefined,
    onePieceGarmentId: undefined,
    fullSetGarmentId: undefined,
  };
}

function pickUniqueGarment(
  look: VtonLookSpec,
  field: GarmentField,
  kind: VtonGarmentKind,
  pool: VtonGarmentItem[],
  used: Set<string>,
): string | undefined {
  const candidates = pool.filter((g) => g.kind === kind);
  if (candidates.length === 0) return undefined;

  const current = look[field];
  if (current && candidates.some((g) => g.id === current) && !used.has(current)) {
    used.add(current);
    return current;
  }

  const next = candidates.find((g) => !used.has(g.id)) ?? candidates[0];
  if (next) used.add(next.id);
  return next?.id;
}

/** 同一服装不被多套搭配重复占用；池子新增条目时自动补全未分配的搭配。 */
export function assignUniqueGarments(
  looks: VtonLookSpec[],
  pool: VtonGarmentItem[],
): VtonLookSpec[] | null {
  const used = new Set<string>();
  let changed = false;
  const next = looks.map((look) => {
    const row = { ...look };

    const apply = (field: GarmentField, kind: VtonGarmentKind) => {
      const picked = pickUniqueGarment(row, field, kind, pool, used);
      if (picked !== row[field]) {
        changed = true;
        row[field] = picked;
      }
    };

    if (look.kind === "two_piece") {
      apply("topGarmentId", "top");
      apply("bottomGarmentId", "bottom");
      row.onePieceGarmentId = undefined;
      row.fullSetGarmentId = undefined;
    } else if (look.kind === "one_piece") {
      apply("onePieceGarmentId", "one_piece");
      row.topGarmentId = undefined;
      row.bottomGarmentId = undefined;
      row.fullSetGarmentId = undefined;
    } else if (look.kind === "full_set") {
      apply("fullSetGarmentId", "full_set");
      row.topGarmentId = undefined;
      row.bottomGarmentId = undefined;
      row.onePieceGarmentId = undefined;
    } else if (look.kind === "top_only") {
      apply("topGarmentId", "top");
      row.bottomGarmentId = undefined;
      row.onePieceGarmentId = undefined;
      row.fullSetGarmentId = undefined;
    } else {
      apply("bottomGarmentId", "bottom");
      row.topGarmentId = undefined;
      row.onePieceGarmentId = undefined;
      row.fullSetGarmentId = undefined;
    }

    return row;
  });

  return changed ? next : null;
}

function looksGarmentSignature(looks: VtonLookSpec[]): string {
  return looks
    .map(
      (l) =>
        `${l.id}:${l.kind}:${l.topGarmentId ?? ""}:${l.bottomGarmentId ?? ""}:${l.onePieceGarmentId ?? ""}:${l.fullSetGarmentId ?? ""}`,
    )
    .join("|");
}

function poolSignature(pool: VtonGarmentItem[]): string {
  return pool.map((g) => `${g.id}:${g.kind}`).join("|");
}

function cycleGarmentId(currentId: string | undefined, options: VtonGarmentItem[]): string {
  if (options.length === 0) return "";
  if (options.length === 1) return options[0]!.id;
  const idx = options.findIndex((g) => g.id === currentId);
  return options[(idx + 1) % options.length]!.id;
}

export function VtonLookComposer({
  looks,
  pool,
  selectedLookIds,
  onToggleLookSelection,
  onSelectAllLooks,
  onClearLookSelection,
  busy,
  disabled,
  onChange,
  onCartesian,
}: Props) {
  const selectedSet = new Set(selectedLookIds);
  const allSelected = looks.length > 0 && looks.every((l) => selectedSet.has(l.id));
  const tops = pool.filter((g) => g.kind === "top");
  const bottoms = pool.filter((g) => g.kind === "bottom");
  const lastAutoFixRef = useRef<string>("");

  useEffect(() => {
    const fixed = assignUniqueGarments(looks, pool);
    if (!fixed) return;
    const sig = looksGarmentSignature(fixed);
    if (sig === lastAutoFixRef.current) return;
    lastAutoFixRef.current = sig;
    void onChange(fixed);
  }, [looks, pool, onChange]);

  async function commitLooks(next: VtonLookSpec[]) {
    const fixed = assignUniqueGarments(next, pool) ?? next;
    lastAutoFixRef.current = looksGarmentSignature(fixed);
    await onChange(fixed);
  }

  async function addLook(kind: VtonLookKind) {
    if (looks.length >= ECOM_VTON_MAX_BATCH_LOOKS) return;
    const look: VtonLookSpec = {
      id: newLookId(),
      kind,
      label: `${VTON_LOOK_KIND_LABELS[kind]} ${looks.length + 1}`,
      ...defaultGarmentIdsForLookKind(kind, pool, usedGarmentIds(looks)),
    };
    await commitLooks([...looks, look]);
  }

  async function updateLook(id: string, patch: Partial<VtonLookSpec>) {
    await commitLooks(looks.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function changeLookKind(id: string, kind: VtonLookKind) {
    const others = looks.filter((l) => l.id !== id);
    await commitLooks(
      looks.map((l) =>
        l.id === id
          ? {
              ...l,
              kind,
              ...defaultGarmentIdsForLookKind(kind, pool, usedGarmentIds(others)),
            }
          : l,
      ),
    );
  }

  async function removeLook(id: string) {
    await commitLooks(looks.filter((l) => l.id !== id));
  }

  function garmentOptions(kind: VtonGarmentKind) {
    return pool.filter((g) => g.kind === kind);
  }

  return (
    <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-[#1d1d1f]">搭配编排</h3>
          <p className="text-[11px] text-[#6e6e73]">
            已添加 {looks.length}/{ECOM_VTON_MAX_BATCH_LOOKS} 套
            {looks.length > 0 ? (
              <>
                {" · "}
                已选 {selectedLookIds.length} 套
                {!allSelected ? (
                  <button
                    type="button"
                    className="ml-1 text-[#0071e3] hover:underline disabled:opacity-50"
                    disabled={busy || disabled}
                    onClick={onSelectAllLooks}
                  >
                    全选
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ml-1 text-[#0071e3] hover:underline disabled:opacity-50"
                    disabled={busy || disabled}
                    onClick={onClearLookSelection}
                  >
                    清空
                  </button>
                )}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(VTON_LOOK_KIND_LABELS) as VtonLookKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className="rounded-md border border-[#e8e8ed] px-2 py-1 text-[10px] text-[#0071e3] hover:bg-[#f0f6ff] disabled:opacity-50"
              disabled={busy || disabled || looks.length >= ECOM_VTON_MAX_BATCH_LOOKS}
              onClick={() => void addLook(kind)}
            >
              <Plus className="mr-0.5 inline h-3 w-3" />
              {VTON_LOOK_KIND_LABELS[kind]}
            </button>
          ))}
          {onCartesian && tops.length > 0 && bottoms.length > 0 ? (
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={busy || disabled}
              onClick={() => void onCartesian(tops.map((t) => t.id), bottoms.map((b) => b.id))}
            >
              上×下组合
            </EcomButtonSecondary>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        {looks.map((look, idx) => (
          <div
            key={look.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
              selectedSet.has(look.id)
                ? "border-[#0071e3]/40 bg-[#f0f6ff]"
                : "border-[#e8e8ed] bg-[#fafafa]",
            )}
          >
            <button
              type="button"
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                selectedSet.has(look.id)
                  ? "border-[#0071e3] bg-[#0071e3] text-white"
                  : "border-[#c7c7cc] bg-white text-transparent hover:border-[#0071e3]",
                (busy || disabled) && "pointer-events-none opacity-40",
              )}
              disabled={busy || disabled}
              aria-label={selectedSet.has(look.id) ? "取消选择搭配" : "选择搭配"}
              aria-pressed={selectedSet.has(look.id)}
              onClick={() => onToggleLookSelection(look.id)}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </button>
            <span className="text-[11px] font-medium text-[#6e6e73]">#{idx + 1}</span>
            <select
              className="rounded border border-[#e8e8ed] bg-white px-2 py-1 text-[11px]"
              value={look.kind}
              disabled={busy || disabled}
              onChange={(e) => void changeLookKind(look.id, e.target.value as VtonLookKind)}
            >
              {(Object.keys(VTON_LOOK_KIND_LABELS) as VtonLookKind[]).map((k) => (
                <option key={k} value={k}>
                  {VTON_LOOK_KIND_LABELS[k]}
                </option>
              ))}
            </select>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              {(look.kind === "two_piece" || look.kind === "top_only") && (
                <GarmentSlotField
                  label={VTON_GARMENT_KIND_LABELS.top}
                  value={look.topGarmentId}
                  options={garmentOptions("top")}
                  disabled={busy || disabled}
                  onChange={(id) => void updateLook(look.id, { topGarmentId: id })}
                />
              )}

              {(look.kind === "two_piece" || look.kind === "bottom_only") && (
                <GarmentSlotField
                  label={VTON_GARMENT_KIND_LABELS.bottom}
                  value={look.bottomGarmentId}
                  options={garmentOptions("bottom")}
                  disabled={busy || disabled}
                  onChange={(id) => void updateLook(look.id, { bottomGarmentId: id })}
                />
              )}

              {look.kind === "one_piece" && (
                <GarmentSlotField
                  label={VTON_GARMENT_KIND_LABELS.one_piece}
                  value={look.onePieceGarmentId}
                  options={garmentOptions("one_piece")}
                  disabled={busy || disabled}
                  onChange={(id) => void updateLook(look.id, { onePieceGarmentId: id })}
                />
              )}

              {look.kind === "full_set" && (
                <GarmentSlotField
                  label={VTON_GARMENT_KIND_LABELS.full_set}
                  value={look.fullSetGarmentId}
                  options={garmentOptions("full_set")}
                  disabled={busy || disabled}
                  onChange={(id) => void updateLook(look.id, { fullSetGarmentId: id })}
                />
              )}
            </div>

            <button
              type="button"
              className={cn(
                "ml-auto rounded p-1 text-[#86868b] hover:bg-[#ffecec] hover:text-[#ff3b30]",
                (busy || disabled) && "pointer-events-none opacity-40",
              )}
              disabled={busy || disabled}
              onClick={() => void removeLook(look.id)}
              aria-label="删除搭配"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {looks.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-[#86868b]">请添加至少 1 套搭配后再试衣</p>
        ) : null}
      </div>
    </section>
  );
}

function GarmentSlotField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value?: string;
  options: VtonGarmentItem[];
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const selected = options.find((g) => g.id === value);
  const selectedIndex = selected ? options.findIndex((g) => g.id === selected.id) : -1;
  const displayName =
    selected && selectedIndex >= 0
      ? garmentDisplayLabel(selected, label, selectedIndex)
      : label;

  if (options.length === 0) {
    return <p className="text-[10px] text-[#86868b]">请先在服装池上传{label}</p>;
  }

  const canCycle = options.length > 1 && !disabled;

  const thumb =
    selected ? (
      <EcomRefImageThumb
        src={selected.ossUrl}
        alt={displayName}
        size={64}
        className={cn(
          "rounded-lg [&>div]:rounded-lg [&>div]:border-[#0071e3]",
        )}
      />
    ) : null;

  return (
    <div className="flex items-center gap-2">
      {selected && thumb ? (
        canCycle ? (
          <button
            type="button"
            disabled={disabled}
            title={`${displayName} · 点击切换`}
            className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
            onClick={() => onChange(cycleGarmentId(value, options))}
          >
            {thumb}
          </button>
        ) : (
          thumb
        )
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#d2d2d7] bg-white text-[10px] text-[#86868b]">
          未选
        </div>
      )}
      {selected ? (
        <span className="text-[10px] text-[#6e6e73]">
          {displayName}
          {canCycle ? <span className="ml-1 text-[#0071e3]">点击切换</span> : null}
        </span>
      ) : null}
    </div>
  );
}
