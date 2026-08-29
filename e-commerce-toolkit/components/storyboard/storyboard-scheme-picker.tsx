"use client";

import { SeedVideoAssistantChoiceCards } from "@/components/seed-video/seed-video-assistant-choice-cards";
import { StoryboardSchemePanelsTable } from "@/components/storyboard/storyboard-deliverable-tables";
import {
  buildSchemePickChoicesFromSchemes,
  schemePickPromptBlock,
} from "@/lib/storyboard-workflow";
import type { StoryboardDeliverable, StoryboardScheme } from "@/lib/storyboard-types";

type Props = {
  schemes: StoryboardScheme[];
  deliverable?: StoryboardDeliverable;
  selectedIndex?: number;
  picked?: boolean;
  onPick: (index: number) => void | Promise<void>;
  disabled?: boolean;
};

export function StoryboardSchemePicker({
  schemes,
  deliverable,
  selectedIndex = 0,
  picked = false,
  onPick,
  disabled,
}: Props) {
  if (schemes.length <= 1) return null;

  const prompt = schemePickPromptBlock();
  const choices = buildSchemePickChoicesFromSchemes(schemes);
  const selectedScheme = picked ? schemes[selectedIndex] ?? schemes[0] : null;

  return (
    <div className="space-y-4">
      <SeedVideoAssistantChoiceCards
        title={prompt.title}
        subtitle={prompt.subtitle}
        choices={choices}
        disabled={disabled || picked}
        selectedMessage={
          picked
            ? choices[selectedIndex]?.message ?? choices[0]?.message
            : null
        }
        onSelect={(message) => {
          const index = choices.findIndex((c) => c.message === message);
          if (index >= 0) void onPick(index);
        }}
      />

      {selectedScheme ? (
        <div className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
          <p className="mb-3 text-sm font-semibold text-[#1d1d1f]">
            已选方案 · {selectedScheme.title}
          </p>
          {selectedScheme.summary ? (
            <p className="mb-3 text-xs text-[#6e6e73]">{selectedScheme.summary}</p>
          ) : null}
          <StoryboardSchemePanelsTable
            panels={selectedScheme.panels}
            sellpoints={deliverable?.productSellingPoints}
          />
        </div>
      ) : null}
    </div>
  );
}
