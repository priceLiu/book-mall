import type { Outfit } from "@/lib/fitting-room-types";
import raw from "@/mock/data.json";

const rawUnknown = raw as unknown;
export const OUTFITS: Outfit[] = Array.isArray(rawUnknown) ? (rawUnknown as Outfit[]) : [];
