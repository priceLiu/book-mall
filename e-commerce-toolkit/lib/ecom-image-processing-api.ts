"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";

export type ImageProcessingGatewayModel = {
  modelKey: string;
  displayName: string;
  description: string;
  providerKind?: string;
  credentialBound: boolean;
};

export type ImageProcessingParamField = {
  name: string;
  label: string;
  type: "string" | "boolean" | "integer" | "number" | "select";
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  hint?: string;
};

export type ImageProcessingMode =
  | "retouch"
  | "editor"
  | "enhancer"
  | "outpaint"
  | "restore"
  | "face-swap"
  | "bg-remove"
  | "object-remove"
  | "deblur"
  | "camera-angle"
  | "poster"
  | "meme"
  | "avatar"
  | "gif";

export async function fetchImageProcessingModels() {
  const data = await ecomBookFetch("api/sso/tools/ecom/image-processing/models");
  return data as {
    imageModels: ImageProcessingGatewayModel[];
    paramProfiles: Record<string, ImageProcessingParamField[]>;
    defaults: {
      retouch: string;
      editor: string;
      enhancer: string;
      outpaint: string;
      restore?: string;
      faceSwap?: string;
      bgRemove?: string;
      objectRemove?: string;
      deblur?: string;
      cameraAngle?: string;
      poster?: string;
      meme?: string;
      avatar?: string;
      gif?: string;
    };
    modelGroups?: Record<string, string[]>;
    platformOffering?: boolean;
  };
}

export async function submitImageProcessingEdit(body: {
  mode: ImageProcessingMode;
  prompt?: string;
  model?: string;
  generativeModel?: string;
  enhancerStyle?: string;
  repairType?: string;
  upscaleFactor?: string;
  bgMode?: string;
  edgeQuality?: string;
  outputFormat?: string;
  customColor?: string;
  removalMode?: string;
  blurType?: string;
  sharpenStrength?: string;
  cameraAngle?: string;
  extraGuidance?: string;
  title?: string;
  subtitle?: string;
  sceneDescription?: string;
  posterStyle?: string;
  printFormat?: string;
  posterCount?: string;
  memeFormat?: string;
  topText?: string;
  bottomText?: string;
  textStyle?: string;
  variantCount?: string;
  characterDescription?: string;
  avatarStyle?: string;
  cropShape?: string;
  animationType?: string;
  animationDescription?: string;
  durationSec?: string;
  gifSize?: string;
  frameRate?: string;
  sourceImageDataUrl?: string;
  sourceImageDataUrls?: string[];
  sourceFaceDataUrl?: string;
  targetImageDataUrl?: string;
  blendMode?: string;
  postProcess?: string;
  algorithm?: string;
  maskImageDataUrl?: string;
  styleImageDataUrl?: string;
  parameters?: Record<string, unknown>;
}) {
  const data = await ecomBookFetch("api/sso/tools/ecom/image-processing/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data as {
    imageUrls: string[];
    assets: unknown[];
    logId: string;
    model?: string;
  };
}
