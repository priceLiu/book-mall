"use client";

import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

export type MediaDecomposeKind = "image" | "video";
export type MediaDecomposeSource = "upload" | "url" | "asset";

export type MediaDecomposeReference = {
  id: string;
  kind: MediaDecomposeKind;
  ossUrl: string;
  source: MediaDecomposeSource;
  sourceUrl?: string;
  label?: string;
};

export type MediaDecomposeSettings = {
  chatModelKey?: string;
  lastPrompt?: string;
};

export type MediaDecomposeStoryboardRow = {
  shotNo: number;
  duration: string;
  shotSize: string;
  cameraMove: string;
  cameraAngle: string;
  composition: string;
  lightingSetup: string;
  toneContrast: string;
  visualContent: string;
  characterAction: string;
  expression: string;
  subtitle: string;
  voiceover: string;
  sfx: string;
  bgm: string;
  transition: string;
  editRhythm: string;
};

export type MediaDecomposeScenePrep = {
  venue: string;
  fixedProps: string;
};

export type MediaDecomposeOpeningHook = {
  firstFrame: string;
  first3sLines: string;
};

export type MediaDecomposeTalentAnalysis = {
  count: string;
  appearance: string;
  expressionStyle: string;
  blocking: string;
};

export type MediaDecomposeWardrobeAnalysis = {
  garments: string;
  changes: string;
  stylingNotes: string;
};

export type MediaDecomposePatch =
  | {
      mediaType: "video";
      action: "decompose_complete";
      visualStyle: string;
      globalColorTone: string;
      cameraLanguageSummary: string;
      scenePrep: MediaDecomposeScenePrep;
      openingHook: MediaDecomposeOpeningHook;
      fullTranscript: string;
      talentAnalysis: MediaDecomposeTalentAnalysis;
      wardrobeAnalysis: MediaDecomposeWardrobeAnalysis;
      storyboardTable: MediaDecomposeStoryboardRow[];
      narrativeLogic: string;
      beatPoints: string;
      replicableShootingScript: string;
    }
  | {
      mediaType: "image";
      action: "decompose_complete";
      elements: {
        subject: string;
        subjectPose: string;
        sceneEnvironment: string;
        spatialPerspective: string;
        composition: string;
        equivalentFocalLength: string;
        shootingAngle: string;
        lighting: {
          keyLight: string;
          fillLight: string;
          rimLight: string;
          ambientLight: string;
          direction: string;
          hardSoft: string;
          colorTemperature: string;
        };
        materialTexture: string;
        colorSystem: string;
        atmosphere: string;
        detailNotes: string;
      };
      positivePrompt: string;
      negativePrompt: string;
      liveActionReplication: {
        cameraPlacement: string;
        lightingSetup: string;
        props: string;
        cameraParams: string;
      };
    };

export type MediaDecomposeResult = {
  rawText?: string;
  structured?: MediaDecomposePatch | null;
  parseError?: string | null;
  completedAt?: string;
};

export type MediaDecomposeProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: MediaDecomposeSettings;
  media: MediaDecomposeReference | null;
  result: MediaDecomposeResult | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaDecomposeChatModel = StoryboardGatewayModel & {
  supportsVideo?: boolean;
};
