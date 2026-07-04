import type { QrTemplate } from "@/lib/qr-template-types";

export type WorldGalleryTabId =
  | "all"
  | "mine"
  | "public"
  | "nature"
  | "architecture"
  | "interior"
  | "scifi"
  | "fantasy"
  | "urban";

export type WorldGalleryTab = {
  id: WorldGalleryTabId;
  label: string;
  title?: string;
};

export const WORLD_GALLERY_TABS: WorldGalleryTab[] = [
  { id: "all", label: "全部场景", title: "All scenes" },
  { id: "mine", label: "我的", title: "My scenes" },
  { id: "public", label: "公开", title: "Public" },
  { id: "nature", label: "自然", title: "Nature" },
  { id: "architecture", label: "建筑", title: "Architecture" },
  { id: "interior", label: "室内", title: "Interior" },
  { id: "scifi", label: "科幻", title: "Sci-fi" },
  { id: "fantasy", label: "奇幻", title: "Fantasy" },
  { id: "urban", label: "都市", title: "Urban" },
];

const STYLE_KEYWORDS: Record<
  Exclude<WorldGalleryTabId, "all" | "mine" | "public">,
  string[]
> = {
  nature: ["自然", "森林", "山", "海", "沙漠", "nature", "forest", "mountain", "sea", "desert"],
  architecture: ["建筑", "architecture", "building", "tower", "bridge", "castle"],
  interior: ["室内", "房间", "interior", "room", "bedroom", "kitchen", "bar", "客厅"],
  scifi: ["科幻", "未来", "sci-fi", "scifi", "cyber", "neon", "space", "futur"],
  fantasy: ["奇幻", "魔法", "fantasy", "magic", "medieval", "dragon"],
  urban: ["都市", "城市", "街道", "urban", "city", "street", "downtown"],
};

function haystack(t: QrTemplate): string {
  return `${t.title} ${t.reference.prompt.text}`.toLowerCase();
}

function matchesStyle(t: QrTemplate, tab: WorldGalleryTabId): boolean {
  if (tab === "all" || tab === "mine" || tab === "public") return true;
  const keywords = STYLE_KEYWORDS[tab];
  const text = haystack(t);
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

export function filterWorldTemplates(
  templates: QrTemplate[],
  tab: WorldGalleryTabId,
): QrTemplate[] {
  if (tab === "all") return templates;
  if (tab === "mine") return templates.filter((t) => t.source === "user");
  if (tab === "public") {
    return templates.filter(
      (t) => t.source === "builtin" || t.visibility === "public",
    );
  }
  const matched = templates.filter((t) => matchesStyle(t, tab));
  return matched.length > 0 ? matched : templates;
}
