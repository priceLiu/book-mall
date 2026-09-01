"use client";

import type { ReactNode } from "react";

import type { FilmPullAnalyzePatch } from "@/lib/film-pull-types";

type Props = {
  structured: Pick<
    FilmPullAnalyzePatch,
    "narrativeLogic" | "beatPoints" | "replicableShootingScript"
  >;
};

export function FilmPullAnalyzeSummarySections({ structured }: Props) {
  const blocks = [
    { title: "整体叙事逻辑", text: structured.narrativeLogic },
    { title: "镜头卡点要点", text: structured.beatPoints },
    { title: "可复刻拍摄脚本", text: structured.replicableShootingScript },
  ].filter((b) => b.text.trim().length > 0);

  if (blocks.length === 0) return null;

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <Section key={block.title} title={block.title}>
          {block.text}
        </Section>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-[#1d1d1f]">{title}</h3>
      <div className="whitespace-pre-wrap rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-3 text-sm text-[#424245]">
        {children}
      </div>
    </div>
  );
}
