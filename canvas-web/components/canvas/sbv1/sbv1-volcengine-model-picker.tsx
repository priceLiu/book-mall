"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import {
  buildSbv1VolcengineModelsFromGateway,
  getSbv1VolcengineModelById,
  migrateSbv1ModelVariantId,
  type Sbv1VolcengineModelOption,
} from "@/lib/canvas/sbv1-video-models";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1-toolbar-anchor-popover";

export function Sbv1VolcengineModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: Sbv1VolcengineModelOption) => void;
}) {
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();
  const { providers } = useUserProviders();
  const variantId = migrateSbv1ModelVariantId(value);

  const models = useMemo(
    () => buildSbv1VolcengineModelsFromGateway(providers),
    [providers],
  );
  const display =
    models.find((m) => m.id === variantId) ??
    getSbv1VolcengineModelById(variantId, providers);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="flex max-w-[200px] items-center gap-1 truncate rounded-lg px-2 py-1 text-[11px] text-white/85 hover:bg-white/8"
        onClick={() => setOpen(!open)}
        title={display.description}
      >
        <span className="truncate">{display.displayName}</span>
        {display.badge === "real_person" ? (
          <span className="shrink-0 rounded bg-emerald-500/20 px-1 text-[9px] text-emerald-200">
            真人
          </span>
        ) : display.badge === "endpoint" ? (
          <span className="shrink-0 rounded bg-violet-500/20 px-1 text-[9px] text-violet-200">
            EP
          </span>
        ) : null}
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        className="max-h-72 w-[22rem] overflow-y-auto rounded-xl border border-white/12 bg-[#1c1c1e] py-1 shadow-xl"
      >
        <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] leading-snug text-white/40">
          火山 Seedance · 经 Gateway 调用。真人人像须先录入
          <a
            href="https://www.volcengine.com/docs/82379/2333589"
            target="_blank"
            rel="noreferrer"
            className="mx-0.5 text-cyan-300/80 underline"
          >
            真人人像库
          </a>
          并通过审核。
        </p>
        {models.map((m) => (
          <button
            key={m.id}
            type="button"
            className={cn(
              "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-white/8",
              m.id === display.id && "bg-cyan-500/10",
            )}
            onClick={() => {
              onChange(m);
              setOpen(false);
            }}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-white">
              {m.displayName}
              {m.badge === "real_person" ? (
                <span className="rounded bg-emerald-500/20 px-1 text-[9px] text-emerald-200">
                  真人
                </span>
              ) : m.badge === "endpoint" ? (
                <span className="rounded bg-violet-500/20 px-1 text-[9px] text-violet-200">
                  接入点
                </span>
              ) : null}
              {m.listCostYuanPerSec != null ? (
                <span className="ml-auto text-[9px] text-white/35">
                  ≈¥{m.listCostYuanPerSec}/s
                </span>
              ) : null}
            </span>
            <span className="text-[10px] leading-snug text-white/45">
              {m.description}
            </span>
            <span className="text-[9px] text-white/25">{m.engine.modelKey}</span>
          </button>
        ))}
      </Sbv1ToolbarDropdown>
    </>
  );
}

/** @deprecated 使用 Sbv1VolcengineModelPicker */
export const Sbv1JimengModelPicker = Sbv1VolcengineModelPicker;
