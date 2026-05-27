"use client";

import { ChevronRight } from "lucide-react";
import {
  STORY_PRO_STAGE_GUIDES,
  type StoryProStageId,
} from "@/lib/canvas/story-pro-node-chrome";

export function StoryProGuidePanel({
  stage,
}: {
  stage: StoryProStageId | "starter";
}) {
  const guide = STORY_PRO_STAGE_GUIDES[stage];
  return (
    <div className="nodrag shrink-0 rounded-lg border border-cyan-400/15 bg-gradient-to-br from-cyan-950/30 to-transparent px-2.5 py-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-cyan-300/70">
        {guide.title}
      </p>
      <ol className="space-y-1">
        {guide.steps.map((step, i) => (
          <li
            key={step}
            className="flex items-start gap-1.5 text-[11px] leading-snug text-white/75"
          >
            <ChevronRight className="mt-0.5 size-3 shrink-0 text-cyan-400/60" />
            <span>
              <span className="font-mono text-[9px] text-cyan-400/50">
                {i + 1}.
              </span>{" "}
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
