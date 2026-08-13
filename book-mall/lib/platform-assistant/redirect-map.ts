/**
 * 平台 AI 导览助手 · 图片/视频生成意图 → 应用深链。
 * 复杂生成不在助手内执行，返回引导卡指向对应应用。
 */

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
};

const APPS: Record<string, AppOrigin> = {
  ecom: {
    key: "ecom",
    title: "电商工具箱",
    envKeys: ["NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN"],
    fallback: "https://ecom.ai-code8.com",
  },
  canvas: {
    key: "canvas",
    title: "AI 画布",
    envKeys: ["NEXT_PUBLIC_CANVAS_WEB_ORIGIN"],
    fallback: "https://canvas.ai-code8.com",
  },
  tool: {
    key: "tool",
    title: "工具站",
    envKeys: ["NEXT_PUBLIC_TOOL_WEB_ORIGIN"],
    fallback: "https://tool.ai-code8.com",
  },
  story: {
    key: "story",
    title: "漫剧空间",
    envKeys: ["NEXT_PUBLIC_STORY_WEB_ORIGIN"],
    fallback: "https://story.ai-code8.com",
  },
  director: {
    key: "director",
    title: "3D 导演台",
    envKeys: ["NEXT_PUBLIC_DIRECTOR_WEB_ORIGIN"],
    fallback: "https://director.ai-code8.com",
  },
  common: {
    key: "common",
    title: "常用工具",
    envKeys: ["NEXT_PUBLIC_COMMON_TOOLS_ORIGIN"],
    fallback: "https://common.ai-code8.com",
  },
};

function originOf(app: AppOrigin): string {
  for (const k of app.envKeys) {
    const v = process.env[k]?.trim();
    if (v) return v.replace(/\/$/, "");
  }
  return app.fallback;
}

type Rule = {
  test: RegExp;
  appKey: keyof typeof APPS;
  description: string;
};

const RULES: Rule[] = [
  {
    test: /电商|主图|详情页|带货|商品图|商详|卖点图/,
    appKey: "ecom",
    description: "电商主图、商品详情页与带货视频，请到电商工具箱创作。",
  },
  {
    test: /海报|画布|分镜.*(节点|工作流)|story-?pro|排版/,
    appKey: "canvas",
    description: "AI 海报、画布节点工作流，请到 AI 画布创作。",
  },
  {
    test: /漫剧|短剧|连续分镜|剧情分镜|漫画/,
    appKey: "story",
    description: "漫剧 / 短剧连续分镜，请到漫剧空间创作。",
  },
  {
    test: /试衣|换装|服装上身|文生图|图生视频|视频实验室/,
    appKey: "tool",
    description: "试衣、文生图、图生视频，请到工具站创作。",
  },
  {
    test: /3d|三维|机位|摆位|运镜/i,
    appKey: "director",
    description: "3D 分镜摆位与机位，请到 3D 导演台。",
  },
  {
    test: /修图|抠图|表情包|放大|去水印|图像小工具/,
    appKey: "common",
    description: "常用图像小工具，请到常用工具。",
  },
];

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
      return {
        app: app.key,
        title: app.title,
        description: rule.description,
        url: originOf(app),
      };
    }
  }
  return null;
}
