import type { Outfit } from "@/lib/fitting-room-types";

export type PrefillGarmentMode = "two_piece" | "one_piece";

/** 试衣间套装 → AI 试衣表单：type 1 连体；type 2 上下装 */
export function prefillGarmentsFromOutfit(outfit: Outfit): {
  garmentMode: PrefillGarmentMode;
  topUrl: string | null;
  bottomUrl: string | null;
  oneUrl: string | null;
} {
  if (outfit.type === 1) {
    const u =
      outfit.split_images.find((s) => Boolean(s.url?.trim()))?.url?.trim() ??
      outfit.url?.trim() ??
      null;
    return {
      garmentMode: "one_piece",
      topUrl: null,
      bottomUrl: null,
      oneUrl: u,
    };
  }

  const top =
    outfit.split_images.find((s) => s.type === "top" && s.url?.trim())?.url?.trim() ??
    outfit.split_images[0]?.url?.trim() ??
    null;
  const bottom =
    outfit.split_images.find((s) => s.type === "bottom" && s.url?.trim())?.url?.trim() ??
    outfit.split_images.filter((s) => s.url?.trim())[1]?.url?.trim() ??
    null;

  return {
    garmentMode: "two_piece",
    topUrl: top,
    bottomUrl: bottom,
    oneUrl: null,
  };
}
