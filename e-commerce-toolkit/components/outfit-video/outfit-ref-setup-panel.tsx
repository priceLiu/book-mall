"use client";

import { VtonRefWorkbench, type VtonBatchWorkflowProps } from "@/components/vton/vton-ref-workbench";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import type { WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import type { VtonTryonProgress } from "@/lib/vton-tryon-progress";

type Props = {
  refs: WorkflowRefs;
  outfitRefMode: OutfitRefMode;
  garmentMode: OutfitGarmentMode;
  refsLocked?: boolean;
  busy?: boolean;
  tryonBusy?: boolean;
  tryonProgress?: VtonTryonProgress | null;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  fusionModelKey: string;
  modelsLoading?: boolean;
  onOutfitRefModeChange: (mode: OutfitRefMode) => void;
  onGarmentModeChange: (mode: OutfitGarmentMode) => void;
  onUploadModel: (file: File) => Promise<void>;
  onUploadClothing: (file: File) => Promise<void>;
  onUploadTopGarment: (file: File) => Promise<void>;
  onUploadBottomGarment: (file: File) => Promise<void>;
  onPickModelFromLibrary: (ossUrl: string, label?: string) => Promise<void>;
  onAttachModelFromAssets?: (
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => Promise<void>;
  onGenerateModel: (opts: { prompt: string; modelKey: string }) => Promise<void>;
  onExpandFullBody: (opts: { prompt?: string; modelKey: string }) => Promise<void>;
  onTryon: () => Promise<void>;
  onLockRefs: () => Promise<void>;
  batchWorkflow?: VtonBatchWorkflowProps;
};

export function OutfitRefSetupPanel(props: Props) {
  return (
    <VtonRefWorkbench
      mode="outfit-video"
      {...props}
      onLockRefs={props.onLockRefs}
      batchWorkflow={props.batchWorkflow}
    />
  );
}
