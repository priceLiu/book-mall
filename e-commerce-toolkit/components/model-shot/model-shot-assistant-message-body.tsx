"use client";

import { ModelShotCollectionSummaryTable } from "@/components/model-shot/model-shot-collection-summary-table";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import {
  buildModelShotCollectionSummaryRows,
  parseModelShotCollectionSummaryMessage,
} from "@/lib/model-shot-workflow";
import type { ModelShotProject } from "@/lib/model-shot-types";

type Props = {
  content: string;
  project: ModelShotProject;
};

export function ModelShotAssistantMessageBody({ content, project }: Props) {
  const parsed = parseModelShotCollectionSummaryMessage(content);
  if (!parsed) {
    return <StoryboardMarkdownBlock markdown={content} />;
  }

  const rows =
    parsed.rows.length > 0 ? parsed.rows : buildModelShotCollectionSummaryRows(project);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-[var(--ecom-ink)]">{parsed.intro}</p>
      <ModelShotCollectionSummaryTable rows={rows} />
      {parsed.outro ? <StoryboardMarkdownBlock markdown={parsed.outro} /> : null}
    </div>
  );
}
