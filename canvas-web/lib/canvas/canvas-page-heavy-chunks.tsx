"use client";

import dynamic from "next/dynamic";

import { CanvasEditorRouteLoading } from "@/components/canvas/canvas-editor-loading";

function chunkLoading(label: string) {
  return function ChunkLoading() {
    return <CanvasEditorRouteLoading label={label} />;
  };
}

export const FlowCanvas = dynamic(
  () =>
    import("@/components/canvas/flow-canvas").then((m) => ({
      default: m.FlowCanvas,
    })),
  { loading: chunkLoading("加载画布…"), ssr: false },
);

export const Pro2CanvasLayout = dynamic(
  () =>
    import("@/components/canvas/pro2/pro2-canvas-layout").then((m) => ({
      default: m.Pro2CanvasLayout,
    })),
  { loading: chunkLoading("加载影视专业版 2.0…"), ssr: false },
);

export const Sbv1CanvasLayout = dynamic(
  () =>
    import("@/components/canvas/sbv1/sbv1-canvas-layout").then((m) => ({
      default: m.Sbv1CanvasLayout,
    })),
  { loading: chunkLoading("加载分镜视频 1.0…"), ssr: false },
);

export const ScriptWritingAssistantPanel = dynamic(
  () =>
    import("@/components/canvas/script-writing-assistant-panel").then((m) => ({
      default: m.ScriptWritingAssistantPanel,
    })),
  { ssr: false },
);

export const MyTemplatesPanel = dynamic(
  () =>
    import("@/components/canvas/my-templates-panel").then((m) => ({
      default: m.MyTemplatesPanel,
    })),
  { ssr: false },
);

export const MyCharactersPanel = dynamic(
  () =>
    import("@/components/canvas/my-characters-panel").then((m) => ({
      default: m.MyCharactersPanel,
    })),
  { ssr: false },
);

export const MySavedScriptsPanel = dynamic(
  () =>
    import("@/components/canvas/my-saved-scripts-panel").then((m) => ({
      default: m.MySavedScriptsPanel,
    })),
  { ssr: false },
);

export const MyVideoLibraryPanel = dynamic(
  () =>
    import("@/components/canvas/my-video-library-panel").then((m) => ({
      default: m.MyVideoLibraryPanel,
    })),
  { ssr: false },
);

export const MyProjectCharacterAssetsPanel = dynamic(
  () =>
    import("@/components/canvas/my-project-character-assets-panel").then((m) => ({
      default: m.MyProjectCharacterAssetsPanel,
    })),
  { ssr: false },
);

export const MyCanvasHistoryPanel = dynamic(
  () =>
    import("@/components/canvas/my-canvas-history-panel").then((m) => ({
      default: m.MyCanvasHistoryPanel,
    })),
  { ssr: false },
);

export const MyCanvasGenerationRecordsPanel = dynamic(
  () =>
    import("@/components/canvas/my-canvas-generation-records-panel").then((m) => ({
      default: m.MyCanvasGenerationRecordsPanel,
    })),
  { ssr: false },
);

export const MyPromptHistoryPanel = dynamic(
  () =>
    import("@/components/canvas/my-prompt-history-panel").then((m) => ({
      default: m.MyPromptHistoryPanel,
    })),
  { ssr: false },
);

export const StyleLibraryModal = dynamic(
  () =>
    import("@/components/canvas/style-library-modal").then((m) => ({
      default: m.StyleLibraryModal,
    })),
  { ssr: false },
);
