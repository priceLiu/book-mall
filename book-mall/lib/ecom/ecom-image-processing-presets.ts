/**
 * 电商图像处理 · 各面板预设与提示词构建
 */

export const DEFAULT_NEGATIVE_PROMPT_PLACEHOLDER =
  "模糊、低质量、带水印、失真……";

export const ENHANCER_STYLE_IDS = [
  "standard",
  "photo-restore",
  "balanced",
  "ai-detail",
  "top-quality",
  "text-logo",
  "stylized",
] as const;

export type EnhancerStyleId = (typeof ENHANCER_STYLE_IDS)[number];

const ENHANCER_STYLE_PROMPTS: Record<EnhancerStyleId, string> = {
  standard:
    "Enhance image quality: reduce noise, sharpen details, restore natural colors and clarity. Keep the original composition and subjects unchanged.",
  "photo-restore":
    "Restore photograph quality: fix exposure, recover shadow and highlight detail, reduce grain, correct color cast, sharpen naturally.",
  balanced:
    "Balanced enhancement: moderate denoise, gentle sharpening, natural color saturation, preserve original look.",
  "ai-detail":
    "Recover fine AI-generated details, crisp edges, remove softness and blur artifacts while preserving style and colors.",
  "top-quality":
    "Maximum quality detail recovery: ultra-sharp textures, micro-contrast, denoise, preserve photorealistic accuracy.",
  "text-logo":
    "Enhance text and logo clarity: sharp edges, high contrast lettering, clean graphics, reduce blur around typography.",
  stylized:
    "Enhance stylized artistic details while preserving the original art style, brushwork, and color palette.",
};

export function buildEnhancerPrompt(styleId: string): string {
  const id = styleId as EnhancerStyleId;
  return ENHANCER_STYLE_PROMPTS[id] ?? ENHANCER_STYLE_PROMPTS.standard;
}

export const RESTORE_REPAIR_TYPES = [
  "auto",
  "upscale",
  "denoise",
  "jpeg",
  "scratches",
  "full",
] as const;

export type RestoreRepairType = (typeof RESTORE_REPAIR_TYPES)[number];

export const RESTORE_UPSCALE_FACTORS = ["1", "2", "4"] as const;

const RESTORE_REPAIR_PROMPTS: Record<RestoreRepairType, string> = {
  auto:
    "Automatically detect and repair all quality issues: noise, blur, scratches, fading, compression artifacts, and color degradation.",
  upscale:
    "Restore image quality and upscale resolution with sharp, clean details.",
  denoise: "Remove noise and grain while preserving natural texture and detail.",
  jpeg: "Fix JPEG compression artifacts, blockiness, and mosquito noise around edges.",
  scratches:
    "Repair scratches, tears, dust spots, and physical damage on scanned or old photos.",
  full: "Comprehensive photo restoration: denoise, deblur, fix scratches, restore colors, and recover fine details.",
};

export function buildRestorePrompt(
  repairType: string,
  upscaleFactor: string,
): string {
  const base =
    RESTORE_REPAIR_PROMPTS[repairType as RestoreRepairType] ??
    RESTORE_REPAIR_PROMPTS.auto;
  const factor = upscaleFactor === "2" ? "2x" : upscaleFactor === "4" ? "4x" : "1x";
  if (factor === "1x") {
    return `${base} Keep the same output resolution — repair only, no upscaling.`;
  }
  return `${base} Upscale output to ${factor} resolution with high-quality detail reconstruction.`;
}

export const FACE_SWAP_BLEND_MODES = ["natural", "strong", "subtle"] as const;
export const FACE_SWAP_POST_PROCESS = ["auto-beauty", "hd-face", "none"] as const;
export const FACE_SWAP_ALGORITHMS = [
  "standard",
  "natural-fusion",
  "strongest-match",
] as const;

export function buildFaceSwapPrompt(opts: {
  blendMode: string;
  postProcess: string;
  algorithm: string;
}): string {
  const blend =
    opts.blendMode === "strong"
      ? "strong blend closer to the source face"
      : opts.blendMode === "subtle"
        ? "subtle light blending"
        : "natural realistic blend (recommended)";
  const post =
    opts.postProcess === "hd-face"
      ? "Apply HD face restoration for maximum clarity."
      : opts.postProcess === "none"
        ? "Keep raw output without beauty filters."
        : "Apply automatic beauty enhancement to the swapped face.";
  const algo =
    opts.algorithm === "natural-fusion"
      ? "Use natural identity fusion."
      : opts.algorithm === "strongest-match"
        ? "Use strongest identity matching to the source face."
        : "Use standard inswapper-style face swap with GFPGAN restoration.";

  return [
    "Swap the face in the target image with the face from the source reference image.",
    algo,
    `Blending: ${blend}.`,
    post,
    "Match lighting, skin tone, and head angle naturally. Keep background and body unchanged.",
  ].join(" ");
}

export const BG_REMOVE_MODES = [
  "transparent",
  "white",
  "black",
  "blur",
  "custom",
] as const;

export const BG_EDGE_QUALITIES = ["auto", "high", "fast"] as const;

export const OBJECT_REMOVE_MODES = ["auto", "clean-fill", "context"] as const;

export function buildBgRemovePrompt(opts: {
  bgMode: string;
  edgeQuality: string;
  customColor?: string;
}): string {
  const edge =
    opts.edgeQuality === "high"
      ? "Use high edge quality: preserve fine hair, fur, and intricate edges."
      : opts.edgeQuality === "fast"
        ? "Use fast edge processing: clean outlines suitable for products."
        : "Use automatic edge quality (recommended).";

  const bg =
    opts.bgMode === "white"
      ? "Replace background with pure white RGB(255,255,255)."
      : opts.bgMode === "black"
        ? "Replace background with pure black RGB(0,0,0)."
        : opts.bgMode === "blur"
          ? "Apply portrait-mode blurred background using depth-aware bokeh on the original scene."
          : opts.bgMode === "custom" && opts.customColor
            ? `Replace background with solid color ${opts.customColor}.`
            : "Remove background completely, output clean cutout with transparent background.";

  return [
    "Remove the background from this image.",
    bg,
    edge,
    "Keep the main subject intact with natural edges. Do not alter the subject.",
  ].join(" ");
}

export function buildObjectRemovePrompt(opts: {
  removalMode: string;
  userPrompt: string;
}): string {
  const mode =
    opts.removalMode === "clean-fill"
      ? "Remove the described object and fill with smooth, clean background."
      : opts.removalMode === "context"
        ? "Remove the described object and inpaint context-aware surroundings matching the scene."
        : "Automatically detect and remove the described object, then naturally inpaint the area.";

  return [
    mode,
    `Remove: ${opts.userPrompt.trim()}`,
    "Keep all other parts of the image unchanged.",
  ].join(" ");
}

export function buildDeblurPrompt(blurType: string, strength: string): string {
  const type =
    blurType === "motion"
      ? "motion blur"
      : blurType === "defocus"
        ? "out-of-focus blur"
        : blurType === "lowres"
          ? "low resolution and pixelation"
          : blurType === "noisy"
            ? "noise and grain"
            : "any detected blur type";

  const level =
    strength === "light"
      ? "light sharpening"
      : strength === "strong"
        ? "strong sharpening and clarity recovery"
        : strength === "maximum"
          ? "maximum deblurring and detail recovery"
          : "moderate sharpening and clarity recovery";

  return [
    `Deblur and sharpen this image. Target blur type: ${type}.`,
    `Apply ${level}.`,
    "Restore sharp edges, fine details, and natural clarity.",
    "Keep colors, composition, and subjects unchanged.",
  ].join(" ");
}

export const CAMERA_ANGLE_IDS = [
  "three-quarter",
  "side-profile",
  "top-down",
  "bottom-up",
  "close-up",
  "wide-angle",
  "behind-scenes",
  "over-shoulder",
] as const;

const CAMERA_ANGLE_PROMPTS: Record<string, string> = {
  "three-quarter":
    "Reframe to a three-quarter camera angle while keeping the subject, clothing, lighting, and scene consistent.",
  "side-profile":
    "Reframe to a side profile camera angle while keeping the subject, clothing, lighting, and scene consistent.",
  "top-down":
    "Reframe to a top-down bird's-eye camera angle while keeping the subject, clothing, lighting, and scene consistent.",
  "bottom-up":
    "Reframe to a low-angle bottom-up camera angle while keeping the subject, clothing, lighting, and scene consistent.",
  "close-up":
    "Reframe to a close-up camera angle while keeping the subject, clothing, lighting, and scene consistent.",
  "wide-angle":
    "Reframe to a wide-angle lens perspective while keeping the subject, clothing, lighting, and scene consistent.",
  "behind-scenes":
    "Reframe to a behind-the-scenes documentary camera angle while keeping the subject, clothing, lighting, and scene consistent.",
  "over-shoulder":
    "Reframe to an over-the-shoulder camera angle while keeping the subject, clothing, lighting, and scene consistent.",
};

export function buildCameraAnglePrompt(
  angleId: string,
  extraGuidance?: string,
): string {
  const base =
    CAMERA_ANGLE_PROMPTS[angleId] ?? CAMERA_ANGLE_PROMPTS["three-quarter"];
  const extra = extraGuidance?.trim();
  return extra ? `${base} Additional guidance: ${extra}` : base;
}

export const POSTER_STYLE_IDS = [
  "concert",
  "movie",
  "inspirational",
  "corporate",
  "minimalist",
  "premium",
  "festival",
] as const;

const POSTER_STYLE_HINTS: Record<string, string> = {
  concert:
    "Bold concert poster style with energetic typography space, vivid stage lighting, and band-poster vitality.",
  movie:
    "Cinematic movie poster composition with dramatic lighting, film-credit layout space, and festival-entry quality.",
  inspirational:
    "Inspirational wall-art poster with uplifting imagery and space for a headline quote.",
  corporate:
    "Clean corporate event poster suitable for roll-up banners, exhibition booths, and announcements.",
  minimalist: "Minimalist poster design with elegant typography space and restrained palette.",
  premium: "Premium luxury poster aesthetic with refined layout and high-end commercial polish.",
  festival:
    "Festival event poster with saturated colors, vibrant layout, and street-poster energy.",
};

export function buildPosterPrompt(opts: {
  title: string;
  subtitle?: string;
  sceneDescription: string;
  styleId: string;
  printFormat?: string;
}): string {
  const style =
    POSTER_STYLE_HINTS[opts.styleId] ?? POSTER_STYLE_HINTS.concert;
  const parts = [
    "Design a professional print-ready poster.",
    style,
    opts.title.trim() ? `Main headline text: "${opts.title.trim()}".` : "",
    opts.subtitle?.trim()
      ? `Secondary line: "${opts.subtitle.trim()}".`
      : "",
    `Visual scene: ${opts.sceneDescription.trim()}.`,
    opts.printFormat?.trim()
      ? `Print aspect ratio / format: ${opts.printFormat.trim()}.`
      : "",
    "High resolution, sharp typography areas, balanced composition, no watermark.",
  ].filter(Boolean);
  return parts.join(" ");
}

const MEME_FORMAT_HINTS: Record<string, string> = {
  classic: "Classic internet meme with bold top and bottom Impact-style caption areas.",
  drake: "Drake Hotline Bling approve/disapprove two-panel meme layout.",
  "distracted-bf": "Distracted Boyfriend meme composition with three figures.",
  "woman-cat": "Woman yelling at cat two-panel meme layout.",
  "two-buttons": "Two red buttons difficult choice meme layout.",
  "expanding-brain": "Expanding Brain multi-panel meme progression layout.",
};

const MEME_TEXT_STYLE_HINTS: Record<string, string> = {
  "impact-classic": "Impact font, white text with black outline (classic meme typography).",
  "helvetica-bold": "Helvetica bold sans-serif caption typography.",
  "comic-sans": "Comic Sans MS caption typography for ironic humor.",
};

export function buildMemePrompt(opts: {
  memeFormat: string;
  sceneDescription: string;
  topText?: string;
  bottomText?: string;
  textStyle?: string;
}): string {
  const format = MEME_FORMAT_HINTS[opts.memeFormat] ?? MEME_FORMAT_HINTS.classic;
  const typography =
    MEME_TEXT_STYLE_HINTS[opts.textStyle ?? "impact-classic"] ??
    MEME_TEXT_STYLE_HINTS["impact-classic"];
  return [
    "Create a viral internet meme image.",
    format,
    typography,
    `Scene: ${opts.sceneDescription.trim()}.`,
    opts.topText?.trim() ? `Top caption text: "${opts.topText.trim()}".` : "",
    opts.bottomText?.trim()
      ? `Bottom caption text: "${opts.bottomText.trim()}".`
      : "",
    "High contrast, readable caption areas, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

const AVATAR_STYLE_HINTS: Record<string, string> = {
  "pixar-3d": "Pixar-style 3D animated character portrait.",
  "disney-2d": "Disney 2D animation character portrait.",
  anime: "Japanese anime character portrait.",
  cyberpunk: "Cyberpunk sci-fi character portrait with neon accents.",
  "corporate-memphis": "Corporate Memphis flat illustration avatar style.",
  "fantasy-rpg": "Fantasy RPG character portrait with dramatic lighting.",
  "pixel-art": "Retro pixel art character portrait.",
  chibi: "Cute chibi stylized character portrait.",
  clay: "Clay / plasticine stop-motion character portrait.",
};

const AVATAR_CROP_HINTS: Record<string, string> = {
  circle: "Circular avatar crop, centered portrait.",
  square: "Square crop, centered portrait.",
  "rounded-square": "Rounded-square crop, centered portrait.",
  hexagon: "Hexagonal crop framing, centered portrait.",
};

export function buildAvatarPrompt(opts: {
  avatarStyle: string;
  characterDescription: string;
  cropShape?: string;
}): string {
  const style =
    AVATAR_STYLE_HINTS[opts.avatarStyle] ?? AVATAR_STYLE_HINTS["pixar-3d"];
  const crop =
    AVATAR_CROP_HINTS[opts.cropShape ?? "circle"] ?? AVATAR_CROP_HINTS.circle;
  return [
    "Generate a profile avatar / character portrait.",
    style,
    crop,
    `Character: ${opts.characterDescription.trim()}.`,
    "Single subject, clean background, high detail, no watermark.",
  ].join(" ");
}

const GIF_TYPE_HINTS: Record<string, string> = {
  "seamless-loop": "Seamless looping animation, perfect first-to-last frame match.",
  reaction: "Reaction GIF with expressive character motion.",
  morph: "Smooth morph / transition animation between states.",
  loading: "Loading spinner / rotating icon animation loop.",
  "dynamic-photo": "Cinemagraph-style subtle motion on mostly static scene.",
  "animated-text": "Animated kinetic typography GIF.",
};

export function buildGifPrompt(opts: {
  animationType: string;
  animationDescription: string;
  durationSec?: string;
  gifSize?: string;
  frameRate?: string;
}): string {
  const type = GIF_TYPE_HINTS[opts.animationType] ?? GIF_TYPE_HINTS["seamless-loop"];
  const duration = opts.durationSec ?? "2";
  const size = opts.gifSize ?? "480";
  const fps = opts.frameRate ?? "24";
  return [
    "Generate an animated GIF style visual (short looping motion).",
    type,
    `Animation: ${opts.animationDescription.trim()}.`,
    `Target duration: ${duration} seconds, size: ${size}px, frame rate: ${fps} fps.`,
    "Simple clear motion, GIF-friendly compression, no watermark.",
  ].join(" ");
}
