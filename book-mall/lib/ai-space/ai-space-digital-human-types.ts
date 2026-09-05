/** 数字人形象库 · 客户端可安全引用的类型与常量（不含 prisma / sharp） */

/** 形象状态：active 可用 / inactive 用户停用 / detect_failed 形象检测未通过 */
export type AiSpaceDigitalHumanStatus = "active" | "inactive" | "detect_failed";

/** 尺寸门禁与 wan2.2-s2v 对齐：最短边 > 400px、最长边 < 7000px */
export const AI_SPACE_DIGITAL_HUMAN_MIN_EDGE = 400;
export const AI_SPACE_DIGITAL_HUMAN_MAX_EDGE = 7000;

/** wan2.2-s2v-detect 形象图预检结果（缓存在 meta.detect，换图后失效） */
export type AiSpaceDigitalHumanDetect = {
  checkPass: boolean;
  humanoid: boolean | null;
  message: string | null;
  checkedAt: string | null;
  imageUrl: string | null;
};

export type AiSpaceDigitalHumanDto = {
  id: string;
  name: string;
  avatarImageUrl: string;
  status: string;
  width: number | null;
  height: number | null;
  /** null = 尚未预检；合成前会自动补检一次 */
  detect: AiSpaceDigitalHumanDetect | null;
  createdAt: string;
};
