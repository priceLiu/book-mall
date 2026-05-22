import stylesJson from "@/src/shared/styles/index.json";

export type ComicStyle = {
  id: number;
  name: string;
  name_cn: string;
  prompt: string;
  type: string;
  type_cn: string;
  url: string;
};

export const COMIC_STYLES: ComicStyle[] = stylesJson as ComicStyle[];

export function getComicStyleById(id: number): ComicStyle | undefined {
  return COMIC_STYLES.find((s) => s.id === id);
}
