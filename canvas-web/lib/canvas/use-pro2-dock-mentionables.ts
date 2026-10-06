"use client";

import { useMemo } from "react";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import type { StoryRefImage } from "./story-ref-image";
import { buildPro2DockMentionables } from "./pro2-dock-mentionables";
import {
  buildSbv1VideoEngineDockMentionables,
} from "./sbv1-dock-mentionables";
import type { Sbv1UpstreamRefLink } from "./sbv1-upstream-ref-links";
import type { Sbv1UpstreamTextLink } from "./sbv1-upstream-text-links";
import type { CanvasFlowNode } from "./types";
import { useDockLibraryAssets } from "./use-dock-library-assets";

export function usePro2DockMentionables(
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): MentionableItem[] {
  const libraryAssets = useDockLibraryAssets();
  return useMemo(
    () => buildPro2DockMentionables(upstreamLinks, dockRefImages, libraryAssets),
    [upstreamLinks, dockRefImages, libraryAssets],
  );
}

export function useSbv1VideoEngineDockMentionables(
  upstreamRefLinks: Sbv1UpstreamRefLink[],
  upstreamTextLinks: Sbv1UpstreamTextLink[],
  extraLinks: Pro2DockUpstreamLink[] = [],
  nodes: CanvasFlowNode[] | undefined,
  motionVideoLinks: Sbv1UpstreamRefLink[] = [],
): MentionableItem[] {
  const libraryAssets = useDockLibraryAssets();
  return useMemo(
    () =>
      buildSbv1VideoEngineDockMentionables(
        upstreamRefLinks,
        upstreamTextLinks,
        extraLinks,
        nodes,
        motionVideoLinks,
        libraryAssets,
      ),
    [
      upstreamRefLinks,
      upstreamTextLinks,
      extraLinks,
      nodes,
      motionVideoLinks,
      libraryAssets,
    ],
  );
}
