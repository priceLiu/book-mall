/** 局部编辑 · 选区 bbox（原图像素坐标 x1,y1,x2,y2） */
export type LocalEditBbox = [number, number, number, number];

export type LocalEditSelection =
  | { kind: "mask"; maskDataUrl: string }
  | { kind: "bbox"; bbox: LocalEditBbox }
  | { kind: "multi-bbox"; bboxList: LocalEditBbox[][] };

export type LocalEditClientApp = "canvas" | "ecom" | "common-tools";

export type LocalEditRequest = {
  userId: string;
  modelKey: string;
  prompt: string;
  sourceImageUrls: string[];
  selection?: LocalEditSelection;
  /** 源图自然像素尺寸 · 用于输出 size 与源图比例一致 */
  sourceImageSize?: { width: number; height: number };
  parameters?: Record<string, unknown>;
  clientApp: LocalEditClientApp;
  clientPage?: string;
  /** ecom 修图落库 ecomAsset */
  persistEcomAssets?: boolean;
  ecomMode?: "retouch";
};

export type LocalEditResult = {
  imageUrls: string[];
  logId: string;
  /** 经 resolveRetouchModelForSelection 后的实际 Gateway 模型 */
  modelKeyUsed: string;
  creditsCharged?: number | null;
  ecomAssets?: Array<{ asset: { id: string }; ossUrl: string }>;
};
