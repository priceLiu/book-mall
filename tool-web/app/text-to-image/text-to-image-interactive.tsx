"use client";

import { useState } from "react";
import { Hero } from "@/components/ui/hero-with-group-of-images-text-and-two-buttons";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";
import {
  TextToImageGenerateModal,
  type TextToImagePromptPreset,
} from "./text-to-image-generate-modal";
import { TextToImagePanel } from "./text-to-image-panel";

export function TextToImageInteractive({
  renewHref,
  mainOrigin,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [promptPreset, setPromptPreset] =
    useState<TextToImagePromptPreset>("homeland");

  const scrollToPanel = () => {
    document
      .getElementById("text-to-image-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Hero
        panelAnchorId="text-to-image-panel"
        onFillPrompt={() => {
          setPromptPreset("abstract");
          setModalOpen(true);
        }}
        onDirectGenerate={() => {
          setPromptPreset("homeland");
          scrollToPanel();
          setModalOpen(true);
        }}
      />

      <section id="text-to-image-panel" aria-labelledby="text-to-image-heading">
        <h1 id="text-to-image-heading" style={{ marginTop: 0 }}>
          文生图
        </h1>
        <ToolImplementationCrossLink href="/text-to-image/implementation" />

        <TextToImagePanel renewHref={renewHref} mainOrigin={mainOrigin} />
      </section>

      <TextToImageGenerateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        promptPreset={promptPreset}
      />
    </>
  );
}
