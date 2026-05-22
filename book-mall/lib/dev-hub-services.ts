/**
 * 本地开发导航页用的服务清单（端口与 .env.example / deploy.md 一致）。
 */

export type DevHubService = {
  id: string;
  label: string;
  description: string;
  url: string;
  port: number;
  /** 是否可在浏览器打开 */
  openable: boolean;
};

export type DevHubBackgroundTask = {
  id: string;
  label: string;
  description: string;
  command: string;
};

function trimOrigin(raw: string | undefined, fallback: string): string {
  const v = raw?.trim().replace(/\/$/, "");
  return v || fallback;
}

/** 从 book-mall 环境变量解析各子站 origin（仅开发用） */
export function getDevHubServices(): DevHubService[] {
  const mall = trimOrigin(process.env.NEXTAUTH_URL, "http://localhost:3000");

  return [
    {
      id: "mall",
      label: "book-mall",
      description: "主站 · 认证 / 钱包 / Story API / 管理后台",
      url: mall,
      port: 3000,
      openable: true,
    },
    {
      id: "tool",
      label: "tool-web",
      description: "工具站 · 试衣 / 文生图 / 图生视频",
      url: trimOrigin(process.env.TOOLS_PUBLIC_ORIGIN, "http://localhost:3001"),
      port: 3001,
      openable: true,
    },
    {
      id: "finance",
      label: "finance-web",
      description: "财务控制台 · 账单与价目",
      url: trimOrigin(
        process.env.NEXT_PUBLIC_FINANCE_WEB_ORIGIN,
        "http://localhost:3002",
      ),
      port: 3002,
      openable: true,
    },
    {
      id: "story",
      label: "story-web",
      description: "漫剧空间 · 项目 / 分镜 / 生成",
      url: trimOrigin(
        process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN,
        "http://localhost:3003",
      ),
      port: 3003,
      openable: true,
    },
  ];
}

export function getDevHubBackgroundTasks(): DevHubBackgroundTask[] {
  return [
    {
      id: "story-poll",
      label: "story:poll-loop",
      description:
        "漫剧 KIE 任务轮询（本地无公网回调时必开）；pnpm dev:all 已默认启动，日志在 [poll] 颜色行；任务详情看 /dev/story/tasks",
      command: "pnpm dev:all  （单独运行：pnpm --filter book-mall run story:poll-loop）",
    },
  ];
}

export async function probeServiceUrl(
  url: string,
  timeoutMs = 2500,
): Promise<{ up: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    clearTimeout(timer);
    return { up: res.status < 500, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { up: false, error: msg };
  }
}
