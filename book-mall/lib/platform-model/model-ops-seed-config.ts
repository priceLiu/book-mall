/**
 * 模型运营中心 · 场景上架配置（与改造前各应用白名单对齐）
 * 真源对照：canvas-web story-prompts / sbv1-* · book-mall quick-replica catalogs
 */
import { QR_TEXT_TO_IMAGE_MODELS } from "@/lib/quick-replica/qr-text-to-image-models";
import { QR_TEXT_TO_VIDEO_MODELS } from "@/lib/quick-replica/qr-text-to-video-models";
import {
  ELEVENLABS_MUSIC_MODELS,
  ELEVENLABS_SFX_MODELS,
  ELEVENLABS_STS_MODELS,
} from "@/lib/gateway/elevenlabs-models";
import {
  MINIMAX_MUSIC_MODELS,
  MINIMAX_SPEECH_MODELS,
  MINIMAX_VOICE_CLONE_SPEECH_MODELS,
} from "@/lib/gateway/minimax-speech-models";
import { HAPPYHORSE_R2V_MODEL_KEY } from "@/lib/quick-replica/qr-motion-sync-models";

/** Canvas Pro2 / sbv1 · 改造前 EnginePicker 白名单 */
export const CANVAS_SCENE_MODEL_KEYS = {
  "pro2-llm": [
    "google/gemini-3-flash-preview",
    "gemini-3-flash",
    "gpt-5-5",
    "kimi-k3",
    "kimi-k2.6",
    "kimi-k2.7-code",
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "deepseek-chat",
    "qwen3.8-max",
    "qwen3.7-plus",
    "qwen3.6-plus",
    "qwen3.5-plus",
    "qwen3-vl-plus",
    "qwen-plus",
    "qwen-max",
  ],
  "pro2-image": [
    "nano-banana-pro",
    "kling-3.0-image",
    "4o-image",
    "nano-banana-2",
    "google/nano-banana",
    "flux-2-pro",
    "doubao-seedream-5-0-pro",
    "doubao-seedream-5-0-lite",
    "seedream-5-lite",
    "seedream-4.5",
    "gpt-image-2",
    "gpt-image-1",
    "grok-imagine/text-to-image",
    "hunyuan-3d-pro",
    "hunyuan-3d-express",
    "qwen-text-to-image",
  ],
  "pro2-video": [
    "doubao-seedance-2.0",
    "kling-2.6/image-to-video",
    "kling/v3-turbo-image-to-video",
    "kling-3.0/video",
    "bytedance/seedance-2",
    "wan/2-7-image-to-video",
    "happyhorse/image-to-video",
    "grok-imagine/image-to-video",
    "grok-imagine-video-1-5-preview",
    "MiniMax/MiniMax-H3-t2v",
    "MiniMax/MiniMax-H3-i2v",
    "MiniMax/MiniMax-H3-fl2v",
    "MiniMax/MiniMax-H3-r2v",
    "MiniMax/MiniMax-H3-s2v",
    "MiniMax/MiniMax-H3-regeneration",
    "MiniMax/MiniMax-H3-context-ir",
    "happyhorse-1.1-t2v",
    "happyhorse-1.1-r2v",
    "happyhorse-1.0-r2v",
    "wan2.7-r2v",
    "wan2.6-r2v",
    "wan2.6-r2v-flash",
    "wan3.0-video",
  ],
  "sbv1-image": [
    "nano-banana-pro",
    "kling-3.0-image",
    "4o-image",
    "nano-banana-2",
    "gpt-image-2",
    "google/nano-banana",
    "doubao-seedream-5-0-pro",
    "doubao-seedream-5-0-lite",
    "seedream-4.5",
    "seedream-5-lite",
  ],
  "sbv1-video": [
    "doubao-seedance-2.0",
    "doubao-seedance-1.5-pro",
    "happyhorse-1.0-t2v",
    "happyhorse-1.0-i2v",
    "happyhorse-1.0-r2v",
    "happyhorse-1.1-t2v",
    "happyhorse-1.1-i2v",
    "happyhorse-1.1-r2v",
    "wan2.7-r2v",
    "wan2.6-t2v",
    "wan2.7-t2v",
    "wan3.0-video",
    "kling-2.6/motion-control",
    "kling-3.0/motion-control",
    "MiniMax/MiniMax-H3-t2v",
    "MiniMax/MiniMax-H3-i2v",
    "MiniMax/MiniMax-H3-fl2v",
    "MiniMax/MiniMax-H3-r2v",
    "MiniMax/MiniMax-H3-s2v",
    "MiniMax/MiniMax-H3-regeneration",
    "MiniMax/MiniMax-H3-context-ir",
  ],
} as const;

export const QUICK_REPLICA_SCENE_MODEL_KEYS = {
  "qr-t2i": QR_TEXT_TO_IMAGE_MODELS.map((m) => m.modelKey),
  "qr-t2v": QR_TEXT_TO_VIDEO_MODELS.map((m) => m.modelKey),
  "qr-audio-tts": MINIMAX_SPEECH_MODELS.map((m) => m.modelKey),
  "qr-voice-clone": MINIMAX_VOICE_CLONE_SPEECH_MODELS.map((m) => m.modelKey),
  "qr-motion-sync": [
    HAPPYHORSE_R2V_MODEL_KEY,
    "kling-2.6/motion-control",
    "kling-3.0/motion-control",
  ],
  "qr-music": [
    ...MINIMAX_MUSIC_MODELS.map((m) => m.modelKey),
    ...ELEVENLABS_MUSIC_MODELS.map((m) => m.modelKey),
  ],
  "qr-sfx": ELEVENLABS_SFX_MODELS.map((m) => m.modelKey),
  "qr-voice-changer": ELEVENLABS_STS_MODELS.map((m) => m.modelKey),
} as const;

export type SceneShelfSpec = {
  appTag: string;
  sceneKey: string;
  modelKeys: readonly string[];
};

export const SCENE_SHELF_SPECS: SceneShelfSpec[] = [
  ...Object.entries(CANVAS_SCENE_MODEL_KEYS).map(([sceneKey, modelKeys]) => ({
    appTag: "canvas",
    sceneKey,
    modelKeys,
  })),
  ...Object.entries(QUICK_REPLICA_SCENE_MODEL_KEYS).map(([sceneKey, modelKeys]) => ({
    appTag: "quick-replica",
    sceneKey,
    modelKeys,
  })),
];

export const GLOBAL_APP_TAGS = [
  "canvas",
  "story",
  "tool",
  "ecom",
  "prompt-optimizer",
  "quick-replica",
] as const;
