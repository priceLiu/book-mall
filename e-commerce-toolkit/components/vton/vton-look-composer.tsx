"use client";

import { Plus, Trash2 } from "lucide-react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  VTON_LOOK_KIND_LABELS,
  type VtonGarmentItem,
  type VtonLookKind,
  type VtonLookSpec,
} from "@/lib/vton-types";
import { cn } from "@/lib/utils";

type Props = {
  looks: VtonLookSpec[];
  pool: VtonGarmentItem[];
  busy?: boolean;
  disabled?: boolean;
  onChange: (looks: VtonLookSpec[]) => Promise<void>;
  onCartesian?: (topIds: string[], bottomIds: string[]) => Promise<void>;
};

function newLookId(): string {
  return crypto.randomUUID();
}

function defaultGarmentForKind(pool: VtonGarmentItem[], kind: VtonGarmentKind): string | undefined {
  if (kind === "top") return pool.find((g) => g.kind === "top")?.id;
  if (kind === "bottom") return pool.find((g) => g.kind === "bottom")?.id;
  return pool.find((g) => g.kind === "one_piece")?.id;
}

type VtonGarmentKind = VtonGarmentItem["kind"];

export function VtonLookComposer({
  looks,
  pool,
  busy,
  disabled,
  onChange,
  onCartesian,
}: Props) {
  const tops = pool.filter((g) => g.kind === "top");
  const bottoms = pool.filter((g) => g.kind === "bottom");
  const pieces = pool.filter((g) => g.kind === "one_piece");

  async function addLook(kind: VtonLookKind) {
    if (looks.length >= ECOM_VTON_MAX_BATCH_LOOKS) return;
    const look: VtonLookSpec = {
      id: newLookId(),
      kind,
      label: `${VTON_LOOK_KIND_LABELS[kind]} ${looks.length + 1}`,
    };
    if (kind === "two_piece") {
      look.topGarmentId = defaultGarmentForKind(pool, "top");
      look.bottomGarmentId = defaultGarmentForKind(pool, "bottom");
    } else if (kind === "one_piece") {
      look.onePieceGarmentId = defaultGarmentForKind(pool, "one_piece");
    } else if (kind === "top_only") {
      look.topGarmentId = defaultGarmentForKind(pool, "top");
    } else {
      look.bottomGarmentId = defaultGarmentForKind(pool, "bottom");
    }
    await onChange([...looks, look]);
  }

  async function updateLook(id: string, patch: Partial<VtonLookSpec>) {
    await onChange(looks.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function removeLook(id: string) {
    await onChange(looks.filter((l) => l.id !== id));
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
            className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2 py-2"
          >
            <span className="text-[11px] font-medium text-[#6e6e73]">#{idx + 1}</span>
            <select
              className="rounded border border-[#e8e8ed] bg-white px-2 py-1 text-[11px]"
              value={look.kind}
              disabled={busy || disabled}
              onChange={(e) =>
                void updateLook(look.id, { kind: e.target.value as VtonLookKind })
              }
            >
              {(Object.keys(VTON_LOOK_KIND_LABELS) as VtonLookKind[]).map((k) => (
                <option key={k} value={k}>
                  {VTON_LOOK_KIND_LABELS[k]}
                </option>
              ))}
            </select>

            {(look.kind === "two_piece" || look.kind === "top_only") && (
              <select
                className="min-w-[100px] rounded border border-[#e8e8ed] bg-white px-2 py-1 text-[11px]"
                value={look.topGarmentId ?? ""}
                disabled={busy || disabled}
                onChange={(e) => void updateLook(look.id, { topGarmentId: e.target.value })}
              >
                <option value="">选择上装</option>
                {garmentOptions("top").map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label ?? g.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            )}

            {(look.kind === "two_piece" || look.kind === "bottom_only") && (
              <select
                className="min-w-[100px] rounded border border-[#e8e8ed] bg-white px-2 py-1 text-[11px]"
                value={look.bottomGarmentId ?? ""}
                disabled={busy || disabled}
                onChange={(e) => void updateLook(look.id, { bottomGarmentId: e.target.value })}
              >
                <option value="">选择下装</option>
                {garmentOptions("bottom").map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label ?? g.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            )}

            {look.kind === "one_piece" && (
              <select
                className="min-w-[100px] rounded border border-[#e8e8ed] bg-white px-2 py-1 text-[11px]"
                value={look.onePieceGarmentId ?? ""}
                disabled={busy || disabled}
                onChange={(e) => void updateLook(look.id, { onePieceGarmentId: e.target.value })}
              >
                <option value="">选择连体/裙</option>
                {garmentOptions("one_piece").map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label ?? g.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            )}

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
