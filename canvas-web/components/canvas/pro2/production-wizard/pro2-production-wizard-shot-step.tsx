"use client";

import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { Pro2ProductionWizardShotDraft } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { wizardShotDraftKey } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { Pro2ProductionWizardShotMediaCard } from "./pro2-production-wizard-shot-media-card";

export type Pro2ProductionWizardShotStepProps = {
  script: Pro2ProductionScript;
  scriptHubId: string;
  shotDrafts: Record<string, Pro2ProductionWizardShotDraft>;
};

export function Pro2ProductionWizardShotStep({
  script,
  scriptHubId,
  shotDrafts,
}: Pro2ProductionWizardShotStepProps) {
  const shots = script.shots ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-6 pb-4">
        {shots.map((shot) => {
          const frameKey = wizardShotDraftKey("frame", shot.index);
          const videoKey = wizardShotDraftKey("video", shot.index);
          const frameDraft = shotDrafts[frameKey];
          const videoDraft = shotDrafts[videoKey];
          const subtitle =
            shot.sceneDescription?.trim().slice(0, 80) ||
            shot.shotSize?.trim() ||
            "";

          return (
            <section
              key={shot.index}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-sm font-medium text-zinc-100">
                  镜 {shot.index}
                  {shot.shotSize?.trim() ? (
                    <span className="ml-2 text-zinc-500">{shot.shotSize}</span>
                  ) : null}
                </h2>
                {shot.durationSec ? (
                  <span className="text-xs text-zinc-600">
                    {shot.durationSec}s
                  </span>
                ) : null}
                {subtitle ? (
                  <p className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Pro2ProductionWizardShotMediaCard
                  mediaKind="frame"
                  shotIndex={shot.index}
                  scriptHubId={scriptHubId}
                  script={script}
                  draft={frameDraft}
                />
                <Pro2ProductionWizardShotMediaCard
                  mediaKind="video"
                  shotIndex={shot.index}
                  scriptHubId={scriptHubId}
                  script={script}
                  draft={videoDraft}
                  frameDraft={frameDraft}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
