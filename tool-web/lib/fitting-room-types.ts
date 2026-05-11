/** 试衣间 mock `mock/data.json` 套装结构 */

export type OutfitSex = "male" | "female";

export interface SplitImage {
  id: string;
  amazon_url: string;
  type: string;
  url: string;
}

export interface Outfit {
  id: string;
  url: string;
  type: number;
  sex: OutfitSex;
  split_images: SplitImage[];
}
