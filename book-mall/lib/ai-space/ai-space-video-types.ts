/** 视频创作库 · 客户端可安全引用的类型与常量（不含 prisma） */

export const AI_SPACE_VIDEO_CATEGORIES = [
  { id: "upload", label: "我拍的" },
  { id: "product", label: "商品" },
  { id: "outfit", label: "穿搭" },
  { id: "lifestyle", label: "场景" },
  { id: "compose", label: "合成成片" },
] as const;

export type AiSpaceVideoCategory = (typeof AI_SPACE_VIDEO_CATEGORIES)[number]["id"];

export function isAiSpaceVideoCategory(v: unknown): v is AiSpaceVideoCategory {
  return (
    typeof v === "string" &&
    AI_SPACE_VIDEO_CATEGORIES.some((c) => c.id === v)
  );
}

export const AI_SPACE_VIDEO_CATEGORY_LABEL: Record<string, string> =
  Object.fromEntries(AI_SPACE_VIDEO_CATEGORIES.map((c) => [c.id, c.label]));

export type AiSpaceVideoMaterialDto = {
  id: string;
  name: string;
  category: string;
  videoUrl: string;
  durationSec: number;
  /** upload = 用户自拍；compose_output = 合成台成片 */
  sourceKind: string;
  composeTaskId: string | null;
  createdAt: string;
};

/**
 * 视频创作库列表项：本库自有记录 + 作品墙 Pin(kind=video) 的引用项。
 * `origin: "pin"` 的条目不可改名/删除（真源在各应用），只能在作品墙取消展示。
 */
export type AiSpaceVideoLibraryItem = {
  origin: "material" | "pin";
  /** material → AiSpaceVideoMaterial.id；pin → AiSpacePin.id */
  id: string;
  name: string;
  category: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  createdAt: string;
  /** pin 项的来源应用标签，如「电商工具箱」 */
  sourceLabel: string | null;
};
