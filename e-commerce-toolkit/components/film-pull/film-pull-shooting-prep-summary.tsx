"use client";

import type { FilmPullShootingPrep } from "@/lib/film-pull-types";

type Props = {
  shootingPrep: FilmPullShootingPrep;
};

function displayText(value: string | undefined | null): string {
  if (typeof value !== "string") return "—";
  const t = value.trim();
  return t && t !== "无" ? t : "—";
}

/** 全片拍摄准备 · 只读（与 replicableShootingScript【准备】结构化真源一致） */
export function FilmPullShootingPrepSummary({ shootingPrep }: Props) {
  const rows = [
    { label: "场地", value: displayText(shootingPrep.venue) },
    { label: "服装", value: displayText(shootingPrep.costume) },
    { label: "道具", value: displayText(shootingPrep.props) },
    { label: "设备", value: displayText(shootingPrep.equipment) },
  ];

  if (rows.every((r) => r.value === "—")) return null;

  return (
    <section className="space-y-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">
        拍摄准备
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[11px] font-medium text-[#86868b]">{row.label}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[#1d1d1f]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
