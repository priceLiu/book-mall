/** AI 小智 · 个性化 + 随机笑话开场白（纯前端，不调用 LLM）。 */

import {
  buildPlatformAppLinks,
  type PlatformAppLink,
} from "./platform-apps";

export type GreetingUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type AssistantGreeting = {
  content: string;
  appLinks: PlatformAppLink[];
};

const JOKES = [
  "小笑话：AI 说「我没有感情」，用户说「那你为什么总在我点生成时让我等待？」AI 沉默三秒：「……这叫 suspense。」",
  "小笑话：设计师朋友问 AI 要灵感，AI 回：「你先把参考图传齐。」朋友：「你比甲方还严谨。」",
  "小笑话：程序员改 bug 到深夜，AI 小智说早点休息；程序员说：「你先帮我把平台功能文档背熟。」",
  "小笑话：问：最稳定的生成参数是什么？答：用户已经睡着的那个。",
  "小笑话：创作最忌什么？忌「就差最后一张图」——然后差了一整晚。",
  "小笑话：客户说「按感觉来」，AI 小智翻译：请上传三张参考图、两个风格词、一个 deadline。",
  "小笑话：分镜师：「这镜能不能再电影感一点？」AI：「可以，请先告诉我什么叫电影感。」",
  "小笑话：提示词写三页，生成结果像盲盒——开盒前请先深呼吸。",
  "小笑话：画布节点连成了圈，用户问是不是 bug；AI 小智：「这是闭环工作流的艺术。」",
  "小笑话：电商主图第五版终于过审，设计师：「感谢 AI，也感谢我删掉的第六版。」",
];

/** 从 NextAuth / tools-session / introspect 响应解析展示名。 */
export function parseDisplayName(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const pick = (name?: unknown, email?: unknown, phone?: unknown): string | null => {
    if (typeof name === "string" && name.trim()) return name.trim();
    if (typeof email === "string" && email.includes("@")) {
      const local = email.split("@")[0]?.trim();
      if (local) return local;
    }
    if (typeof phone === "string") {
      const digits = phone.replace(/\D/g, "");
      if (digits.length >= 4) return `用户${digits.slice(-4)}`;
    }
    return null;
  };

  if (o.user && typeof o.user === "object") {
    const u = o.user as Record<string, unknown>;
    const n = pick(u.name, u.email, u.phone);
    if (n) return n;
  }

  if (o.introspect && typeof o.introspect === "object") {
    const intro = o.introspect as Record<string, unknown>;
    const n = pick(intro.name, intro.email, intro.phone);
    if (n) return n;
  }

  return pick(o.name, o.email, o.phone);
}

/** 每次打开助手随机一条笑话（不固定按日）。 */
export function pickRandomJoke(): string {
  const idx = Math.floor(Math.random() * JOKES.length);
  return JOKES[idx] ?? JOKES[0];
}

/** @deprecated 保留导出供测试；问候语已改为随机笑话。 */
export function buildDailyOpener(): string {
  return pickRandomJoke();
}

/** 组装完整欢迎语 + 平台应用入口卡片数据。 */
export function buildAssistantGreeting(
  displayName: string | null | undefined,
): AssistantGreeting {
  const joke = pickRandomJoke();
  const salutation = displayName?.trim()
    ? `${displayName.trim()}，您好！`
    : "您好！";
  const content = [
    `${salutation}${joke}`,
    "",
    "我是 AI 小智。先看今日 AI 热闻，下面是平台主要应用，点击可在新标签页打开：",
  ].join("\n");
  return {
    content,
    appLinks: buildPlatformAppLinks(),
  };
}
