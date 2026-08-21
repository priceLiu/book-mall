/** 平台应用入口 · 全站 AI 小智问候与功能引导卡（fallback 为生产域名）。 */

export type PlatformAppLink = {
  key: string;
  title: string;
  description: string;
  url: string;
};

type AppDef = {
  key: string;
  title: string;
  description: string;
  fallback: string;
};

const APP_DEFS: AppDef[] = [
  {
    key: "canvas",
    title: "AI 画布",
    description: "无限画布节点工作流，海报设计与影视 Pro2 分镜创作。",
    fallback: "https://canvas.ai-code8.com",
  },
  {
    key: "story",
    title: "漫剧空间",
    description: "漫剧 / 短剧剧本与分镜影像创作空间。",
    fallback: "https://story.ai-code8.com",
  },
  {
    key: "ecom",
    title: "电商工具箱",
    description: "商品主图、详情页与带货视频一站式生成。",
    fallback: "https://ecom.ai-code8.com",
  },
  {
    key: "tool",
    title: "工具站",
    description: "AI 试衣、文生图、图生视频等单点工具。",
    fallback: "https://tool.ai-code8.com",
  },
  {
    key: "replica",
    title: "快速复刻",
    description: "按示例模板快速复刻图像 / 视频 / 场景。",
    fallback: "https://replica.ai-code8.com",
  },
  {
    key: "prompt",
    title: "提示词优化器",
    description: "把粗略想法优化成高质量 AI 提示词。",
    fallback: "https://prompt.ai-code8.com",
  },
  {
    key: "director",
    title: "3D 导演台",
    description: "3D 场景摆位与机位运镜，产出分镜参考。",
    fallback: "https://director.ai-code8.com",
  },
  {
    key: "common",
    title: "常用工具",
    description: "修图、扩图、抠图、表情包等图像小工具。",
    fallback: "https://common.ai-code8.com",
  },
  {
    key: "publisher",
    title: "一键发布",
    description: "图文 / 视频一键分发到多社交平台。",
    fallback: "https://publisher.ai-code8.com",
  },
  {
    key: "book",
    title: "主站 · 课程与个人中心",
    description: "课程学习、账号与个人中心，全站统一登录入口。",
    fallback: "https://book.ai-code8.com",
  },
];

/** 浏览器侧 · 使用 fallback 域名构建应用入口列表。 */
export function buildPlatformAppLinks(): PlatformAppLink[] {
  return APP_DEFS.map((d) => ({
    key: d.key,
    title: d.title,
    description: d.description,
    url: d.fallback.replace(/\/$/, ""),
  }));
}

export { APP_DEFS as PLATFORM_APP_DEFINITIONS };
