/**
 * 一键发布 · 平台脚本注册表
 * 扩展与桌面端共用平台 id 与元数据；具体 inject 实现在各平台模块。
 */

export type SyncContentType = "dynamic" | "article" | "video";

export type PlatformSyncMeta = {
  id: string;
  label: string;
  contentTypes: SyncContentType[];
  /** 是否半自动（需用户手动确认发布） */
  semiAuto?: boolean;
  publishUrl: string;
};

export const V1_PLATFORMS: PlatformSyncMeta[] = [
  {
    id: "xiaohongshu",
    label: "小红书",
    contentTypes: ["dynamic", "video"],
    publishUrl: "https://creator.xiaohongshu.com/publish/publish",
  },
  {
    id: "douyin",
    label: "抖音",
    contentTypes: ["dynamic", "video"],
    publishUrl: "https://creator.douyin.com/creator-micro/content/upload",
  },
  {
    id: "weibo",
    label: "微博",
    contentTypes: ["dynamic", "article", "video"],
    publishUrl: "https://weibo.com",
  },
  {
    id: "bilibili",
    label: "B站",
    contentTypes: ["article", "video"],
    publishUrl: "https://member.bilibili.com/platform/upload/text/edit",
  },
  {
    id: "wechat_mp",
    label: "微信公众号",
    contentTypes: ["article", "dynamic"],
    semiAuto: true,
    publishUrl: "https://mp.weixin.qq.com/",
  },
];

export function getPlatformMeta(id: string): PlatformSyncMeta | undefined {
  return V1_PLATFORMS.find((p) => p.id === id);
}

export type SyncPayload = {
  title?: string;
  content: string;
  images?: string[];
  videoUrl?: string;
  tags?: string[];
};

/** 平台脚本执行结果 */
export type SyncResult = {
  platformId: string;
  ok: boolean;
  message?: string;
  semiAuto?: boolean;
};
