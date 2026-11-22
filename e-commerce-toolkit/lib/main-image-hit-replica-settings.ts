import { ECOM_LANGUAGE_OPTIONS } from "@/lib/ecom-generation-settings/constants";
import type { EcomImageRatio } from "@/lib/product-design-types";

export const MAIN_IMAGE_HIT_REPLICA_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "970:600", label: "970:600" },
  { value: "1464:600", label: "1464:600" },
  { value: "600:450", label: "600:450" },
] as const;

export type MainImageHitReplicaAspectRatio =
  (typeof MAIN_IMAGE_HIT_REPLICA_RATIO_OPTIONS)[number]["value"];

export const MAIN_IMAGE_HIT_REPLICA_LANGUAGE_OPTIONS = [
  ...ECOM_LANGUAGE_OPTIONS,
  { value: "自定义", label: "自定义" },
];

export const MAIN_IMAGE_HIT_REPLICA_RESOLUTION_OPTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
] as const;

export type MainImageHitReplicaOutputResolution =
  (typeof MAIN_IMAGE_HIT_REPLICA_RESOLUTION_OPTIONS)[number]["value"];

export function hitReplicaAspectToCssRatio(ratio: string): string {
  if (ratio.includes(":")) {
    const [w, h] = ratio.split(":").map((x) => Number.parseFloat(x));
    if (Number.isFinite(w) && Number.isFinite(h) && h > 0) {
      return `${w} / ${h}`;
    }
  }
  switch (ratio) {
    case "3:4":
      return "3 / 4";
    case "4:5":
      return "4 / 5";
    case "16:9":
      return "16 / 9";
    case "9:16":
      return "9 / 16";
    default:
      return "1 / 1";
  }
}

/** 映射到 Gateway 生图所用标准比例 */
export function hitReplicaAspectToEcomRatio(ratio: string): EcomImageRatio {
  const standard = new Set(["1:1", "3:4", "4:5", "9:16", "16:9"]);
  if (standard.has(ratio)) return ratio as EcomImageRatio;
  if (ratio === "600:450") return "4:5";
  if (ratio === "970:600" || ratio === "1464:600") return "16:9";
  return "1:1";
}

export function hitReplicaBuildImageGenSize(
  aspect: string,
  resolution: MainImageHitReplicaOutputResolution | string,
): string {
  const r = hitReplicaAspectToEcomRatio(aspect);
  const res = resolution === "1K" ? "1K" : "2K";
  return `${r}_${res}`;
}

export function normalizeHitReplicaAspect(raw: unknown): MainImageHitReplicaAspectRatio {
  const v = typeof raw === "string" ? raw.trim() : "";
  const hit = MAIN_IMAGE_HIT_REPLICA_RATIO_OPTIONS.find((o) => o.value === v);
  return hit?.value ?? "1:1";
}

export function normalizeHitReplicaResolution(
  raw: unknown,
): MainImageHitReplicaOutputResolution {
  return raw === "1K" ? "1K" : "2K";
}