import type {
  EcomTemplateCategory,
  EcomTemplateMediaKind,
} from "@/lib/ecom-template-gallery/types";

const STORAGE_KEY = "ecom-template-gallery-view-v1";

export type EcomTemplateGalleryViewState = {
  category: EcomTemplateCategory;
  media: "all" | EcomTemplateMediaKind;
  scrollTop: number;
};

const DEFAULT_VIEW: EcomTemplateGalleryViewState = {
  category: "accessories",
  media: "image",
  scrollTop: 0,
};

const VALID_CATEGORIES = new Set<EcomTemplateCategory>([
  "womens",
  "mens",
  "kids",
  "home-textile",
  "bags",
  "shoes",
  "accessories",
]);

function isValidCategory(v: unknown): v is EcomTemplateCategory {
  return typeof v === "string" && VALID_CATEGORIES.has(v as EcomTemplateCategory);
}

function isValidMedia(
  v: unknown,
): v is EcomTemplateGalleryViewState["media"] {
  return v === "all" || v === "image" || v === "video";
}

export function loadEcomTemplateGalleryViewState(): EcomTemplateGalleryViewState {
  if (typeof window === "undefined") return DEFAULT_VIEW;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VIEW;
    const parsed = JSON.parse(raw) as Partial<EcomTemplateGalleryViewState>;
    return {
      category: isValidCategory(parsed.category)
        ? parsed.category
        : DEFAULT_VIEW.category,
      media: isValidMedia(parsed.media) ? parsed.media : DEFAULT_VIEW.media,
      scrollTop:
        typeof parsed.scrollTop === "number" && parsed.scrollTop >= 0
          ? parsed.scrollTop
          : 0,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

export function saveEcomTemplateGalleryViewState(
  patch: Partial<EcomTemplateGalleryViewState>,
): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadEcomTemplateGalleryViewState();
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...prev, ...patch }),
    );
  } catch {
    /* ignore quota */
  }
}
