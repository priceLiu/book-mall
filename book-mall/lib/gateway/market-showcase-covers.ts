import marketPresentation from "@/config/gateway-market-presentation.json";

const EX =
  "https://static.aiquickdraw.com/tools/example";

type PresentationFile = {
  defaults?: { coverUrl?: string };
  models?: Record<string, { coverUrl?: string }>;
};

const PRESENTATION = marketPresentation as PresentationFile;

/**
 * 首页模型走马灯专用封面：每个 canonical 一张独立静图（避免 presentation 里重复 mp4/png）。
 * 图源：KIE 文档示例、快速复制内置模板 picsum seed、aiquickdraw 产出样例。
 */
const SHOWCASE_COVERS: Record<string, string> = {
  "grok-imagine/text-to-image": `${EX}/1767694885407_pObJoMcy.png`,
  "grok-imagine/image-to-video": `${EX}/1777359961666_Z3je05MP.png`,
  "grok-imagine-video-1-5-preview": `${EX}/1775568751210_gkLCFKS8.png`,
  "gpt-image-2": `${EX}/1763662100739_DlBXJvdR.png`,
  "gpt-image-1": `${EX}/1775122744247_eSHwJX1k.jpg`,
  "lib-nano-pro": `${EX}/1775188169588_bgwi3VY9.png`,
  "seedance-2.0": `${EX}/1775188213576_znqR80kS.png`,
  "kling-3.0-video": `${EX}/1775188179836_GjU1qcVv.png`,
  "kling-3.0-image": `${EX}/1775188231228_ddIfzCwT.png`,
  "wanxiang-video-2.7-i2v": `${EX}/1775568822016_DdLRQiJT.png`,
  "wanxiang-video-2.7": `https://picsum.photos/seed/wanxiang-video-2.7/480/360`,
  "wanxiang-video-2.6": `${EX}/1775188250101_sZNRBuHh.png`,
  "happyhorse-r2v": `https://picsum.photos/seed/happyhorse-r2v/480/360`,
  "wan2.7-image": `https://picsum.photos/seed/wan2.7-image/480/360`,
  "wan2.7-image-pro": `https://picsum.photos/seed/wan2.7-image-pro/480/360`,
  "wan/2-6-video-to-video": `https://picsum.photos/seed/builtin-video-frame-to-video/480/360`,
  "kling-2.6/motion-control": `https://picsum.photos/seed/builtin-video-motion-sync/480/360`,
  "kling-3.0/motion-control": `https://picsum.photos/seed/builtin-character-motion/480/360`,
  "topaz/video-upscale": `https://picsum.photos/seed/builtin-video-visual-effects/480/360`,
  "deepseek-chat": `https://picsum.photos/seed/builtin-image-create/480/360`,
  "qwen-turbo": `https://picsum.photos/seed/builtin-image-variation/480/360`,
  "gemini-flash": `https://picsum.photos/seed/builtin-image-edit/480/360`,
  "aitryon": `https://picsum.photos/seed/builtin-character-create/480/360`,
  "aitryon-plus": `https://picsum.photos/seed/builtin-character-video/480/360`,
  "portrait-virtual": `https://picsum.photos/seed/builtin-world-create/480/360`,
  "portrait-real": `https://picsum.photos/seed/builtin-image-upscale/480/360`,
};

function picsumFallback(canonicalKey: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(canonicalKey)}/480/360`;
}

function presentationCover(canonicalKey: string): string {
  const p = PRESENTATION.models?.[canonicalKey];
  return p?.coverUrl ?? PRESENTATION.defaults?.coverUrl ?? "";
}

export function showcaseCoverUrlFor(canonicalKey: string): string {
  const mapped = SHOWCASE_COVERS[canonicalKey];
  if (mapped) return mapped;

  const fromPresentation = presentationCover(canonicalKey);
  if (fromPresentation && !fromPresentation.endsWith(".mp4")) {
    return fromPresentation;
  }

  return picsumFallback(canonicalKey);
}
