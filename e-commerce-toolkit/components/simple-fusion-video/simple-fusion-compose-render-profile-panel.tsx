"use client";

import {
  ComposeRenderProfilePanel,
  type ComposeClipSubtitleEditor,
} from "@private/platform-compose-ui/editor";

import type { EcomMediaRenderProfileInput } from "@/lib/ecom-storyboard-api";
import { SIMPLE_FUSION_BGM_PRESETS } from "@/lib/simple-fusion-default-prompts";

export type { ComposeClipSubtitleEditor };

type Props = {
  profile: EcomMediaRenderProfileInput;
  onChange: (next: EcomMediaRenderProfileInput) => void;
  showBgmPresets?: boolean;
  disabled?: boolean;
  className?: string;
  layout?: "flat" | "tabbed";
  clipSubtitle?: ComposeClipSubtitleEditor | null;
};

/** @deprecated 使用 ComposeRenderProfilePanel；保留 SFV BGM 预设注入 */
export function SimpleFusionComposeRenderProfilePanel(props: Props) {
  const bgmPresets = SIMPLE_FUSION_BGM_PRESETS.map((p) => ({ id: p.id, label: p.label }));
  return (
    <ComposeRenderProfilePanel
      {...props}
      bgmPresets={bgmPresets}
      showBgmPresets={props.showBgmPresets ?? true}
    />
  );
}
