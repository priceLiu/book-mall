"use client";

import { ChevronRight } from "lucide-react";
import {
  PRO_GUIDE_PANEL_CLASS,
  PRO_GUIDE_STEP_ICON_CLASS,
  PRO_GUIDE_STEP_NUM_CLASS,
  PRO_GUIDE_TITLE_CLASS,
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
    <div className={PRO_GUIDE_PANEL_CLASS}>
      <p className={PRO_GUIDE_TITLE_CLASS}>{guide.title}</p>
      <ol className="space-y-1">
        {guide.steps.map((step, i) => (
          <li
            key={step}
            className="flex items-start gap-1.5 text-[11px] leading-snug text-white/75"
          >
            <ChevronRight className={PRO_GUIDE_STEP_ICON_CLASS} />
            <span>
              <span className={PRO_GUIDE_STEP_NUM_CLASS}>{i + 1}.</span> {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
