"use client";

import { ModelShotRefGenerateDialog } from "@/components/model-shot/model-shot-ref-generate-dialog";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

export type StoryboardRefGenRole = "character" | "scene";

type Props = {
  open: boolean;
  onClose: () => void;
  role: StoryboardRefGenRole;
  modelKey: string;
  modelDisplayName: string;
  imageModels: StoryboardGatewayModel[];
  modelsLoading?: boolean;
  modelsEmptyHint?: string;
  onRetryLoadModels?: () => void | Promise<void>;
  busy?: boolean;
  onConfirm: (opts: { prompt: string; modelKey: string }) => void | Promise<void>;
};

export function StoryboardRefGenerateDialog({
  role,
  ...rest
}: Props) {
  const msRole = role === "character" ? "model" : "scene";
  return <ModelShotRefGenerateDialog {...rest} role={msRole} />;
}
