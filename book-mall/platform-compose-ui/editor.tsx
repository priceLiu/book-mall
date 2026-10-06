"use client";

import type { ComponentProps } from "react";

export {
  ComposeEditorFullscreen,
  ComposeMiniTimelinePanel,
  ComposeSequenceTrack,
  useComposeFilmstripLoader,
} from "./compose-editor-kit";
import { ComposeMiniTimelinePanel } from "./compose-editor-kit";
export { ComposeRenderProfilePanel } from "./compose-render-profile-panel";
export type { ComposeBgmPresetOption, ComposeClipSubtitleEditor } from "./compose-render-profile-panel";
export { ModalPortal } from "./modal-portal";
export {
  ComposeDialogsProvider,
  useComposeDialogs,
  type ComposeDialogsApi,
} from "./compose-dialogs";
export {
  ComposeFilmstripProvider,
  type FetchVideoFilmstripFn,
} from "./filmstrip-context";
export { DEFAULT_COMPOSE_PROFILE } from "./default-compose-profile";
export {
  appendImportedComposeClip,
  composeClipSourceEnd,
  composeClipSourceStart,
  composeDualTrackProgramDurationSec,
  moveComposeAudioClip,
  moveComposeClip,
  orderedComposeAudioClips,
  orderedComposeClips,
  removeComposeClip,
  toggleComposeAudioClipPlaybackMuted,
  toggleComposeClipSourceAudioMuted,
  updateComposeAudioClip,
  updateComposeClip,
} from "./editing";
export type { ComposeWorkbenchState } from "./types";

export function ComposeDockMini(props: ComponentProps<typeof ComposeMiniTimelinePanel>) {
  return (
    <ComposeMiniTimelinePanel
      {...props}
      trackChrome={{
        variant: "canvas-dock-mini",
        zoomable: true,
        showVideoImport: true,
        showAudioAttach: true,
        ...props.trackChrome,
      }}
    />
  );
}
