/**
 * 平台 AI 导览助手 · 图片/视频生成意图 → 应用深链；平台总览 → 全应用列表。
 */

import { PLATFORM_APP_DEFINITIONS } from "@private/platform-assistant";

export type AssistantRedirect = {
  app: string;
  title: string;
  description: string;
  url: string;
};

type AppOrigin = {
  key: string;
  title: string;
  envKeys: string[];
  fallback: string;
  description: string;
};

const APPS: Record<string, AppOrigin> = Object.fromEntries(
  PLATFORM_APP_DEFINITIONS.map((d) => [
    d.key,
    {
      key: d.key,
      title: d.title,
      description: d.description,
      envKeys: envKeysForApp(d.key),
      fallback: d.fallback,
    },
  ]),
);

function envKeysForApp(key: string): string[] {
  const map: Record<string, string[]> = {
    canvas: ["NEXT_PUBLIC_CANVAS_WEB_ORIGIN"],
    story: ["NEXT_PUBLIC_STORY_WEB_ORIGIN"],
    ecom: ["NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN"],
    tool: ["NEXT_PUBLIC_TOOL_WEB_ORIGIN"],
    replica: ["NEXT_PUBLIC_QUICK_REPLICA_ORIGIN", "NEXT_PUBLIC_QR_WEB_ORIGIN"],
    prompt: ["NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN"],
    director: ["NEXT_PUBLIC_DIRECTOR_WEB_ORIGIN"],
    common: ["NEXT_PUBLIC_COMMON_TOOLS_ORIGIN"],
    publisher: ["NEXT_PUBLIC_PUBLISHER_WEB_ORIGIN"],
    book: ["NEXT_PUBLIC_BOOK_MALL_URL", "MAIN_SITE_ORIGIN"],
  };
  return map[key] ?? [];
}

function originOf(app: AppOrigin): string {
  for (const k of app.envKeys) {
    const v = process.env[k]?.trim();
    if (v) return v.replace(/\/$/, "");
  }
  return app.fallback.replace(/\/$/, "");
}

type Rule = {
  test: RegExp;
  appKey: string;
  description?: string;
};

const RULES: Rule[] = [
  {
    test: /电商|主图|详情页|带货|商品图|商详|卖点图/,
    appKey: "ecom",
  },
  {
    test: /海报|画布|分镜.*(节点|工作流)|story-?pro|排版/,
    appKey: "canvas",
  },
  {
    test: /漫剧|短剧|连续分镜|剧情分镜|漫画/,
    appKey: "story",
  },
  {
    test: /试衣|换装|服装上身|文生图|图生视频|视频实验室/,
    appKey: "tool",
  },
  {
    test: /3d|三维|机位|摆位|运镜/i,
    appKey: "director",
  },
  {
    test: /修图|抠图|表情包|放大|去水印|图像小工具/,
    appKey: "common",
  },
  {
    test: /快速复刻|照葫芦画瓢|复刻/,
    appKey: "replica",
  },
  {
    test: /提示词优化|优化提示词/,
    appKey: "prompt",
  },
  {
    test: /一键发布|多平台发布|分发到.*(小红书|抖音|微博)/,
    appKey: "publisher",
  },
];

const PLATFORM_OVERVIEW_RE =
  /平台.*(有|哪些).*(应用|功能|工具|站点)|有哪些应用|有什么功能|能做什么|平台介绍|应用列表|功能入口|都有什么/;

/** 用户问平台有哪些应用 / 功能。 */
export function isPlatformOverviewIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return PLATFORM_OVERVIEW_RE.test(t);
}

/** 列出全部主要应用入口（服务端 env 优先）。 */
export function listAllPlatformAppLinks(): AssistantRedirect[] {
  return PLATFORM_APP_DEFINITIONS.map((d) => {
    const app = APPS[d.key];
    return {
      app: d.key,
      title: d.title,
      description: d.description,
      url: originOf(app),
    };
  });
}

/** 是否是「生成图片/视频」类诉求（需引导到应用，而非在助手内执行）。 */
export function isGenerationIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const wantsGen = /生成|制作|做一?[张个条组]|画一?[张个]|生图|生视频|出图|出片|设计一?[张个]/.test(t);
  const mediaWord = /图|视频|海报|分镜|主图|详情|漫剧|试衣|表情包/.test(t);
  return wantsGen && mediaWord;
}

/** 依据用户诉求匹配引导目标；无匹配返回 null。 */
export function matchRedirect(text: string): AssistantRedirect | null {
  const t = text.trim();
  if (!t) return null;
  for (const rule of RULES) {
    if (rule.test.test(t)) {
      const app = APPS[rule.appKey];
      if (!app) continue;
      return {
        app: app.key,
        title: app.title,
        description: rule.description ?? app.description,
        url: originOf(app),
      };
    }
  }
  return null;
}
