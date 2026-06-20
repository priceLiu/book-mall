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
    {
      id: "canvas",
      label: "canvas-web",
      description: "AI 海报画布 · 节点工作流 / 多模型 / 多图融合",
      url: trimOrigin(
        process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN,
        "http://localhost:3004",
      ),
      port: 3004,
      openable: true,
    },
    {
      id: "prompt-optimizer",
      label: "prompt-optimizer-platform",
      description: "提示词优化器 · 上游 Vue + Gateway 断直连",
      url: trimOrigin(
        process.env.NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN ??
          process.env.PROMPT_OPTIMIZER_PUBLIC_ORIGIN,
        "http://localhost:3006",
      ),
      port: 3006,
      openable: true,
    },
    {
      id: "quick-replica",
      label: "quick-replica-web",
      description: "快速复制 · 模板浏览 + 运动同步",
      url: trimOrigin(
        process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN ??
          process.env.QUICK_REPLICA_PUBLIC_ORIGIN,
        "http://localhost:3008",
      ),
      port: 3008,
      openable: true,
    },
    {
      id: "gateway",
      label: "gateway-web",
      description: "Gateway BYOK · 厂商 Key / 请求日志 / 调试",
      url: trimOrigin(
        process.env.NEXT_PUBLIC_GATEWAY_WEB_ORIGIN ??
          process.env.GATEWAY_PUBLIC_ORIGIN,
        "http://localhost:3005",
      ),
      port: 3005,
      openable: true,
    },
    {
      id: "ecom",
      label: "e-commerce-toolkit",
      description: "电商工具箱 · 主图/详情/带货视频 · 双计费经 Gateway",
      url: trimOrigin(
        process.env.NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN ??
          process.env.ECOMMERCE_PUBLIC_ORIGIN,
        "http://localhost:3007",
      ),
      port: 3007,
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
        "漫剧 KIE 任务轮询（本地无公网回调时必开）；pnpm dev:all 已默认启动，日志在 [story-poll] 颜色行；任务详情看 /dev/story/tasks",
      command: "pnpm dev:all  （单独运行：pnpm --filter book-mall run story:poll-loop）",
    },
    {
      id: "canvas-poll",
      label: "canvas:poll-loop",
      description:
        "画布 KIE 任务轮询（本地无公网回调时必开）；pnpm dev:all 已默认启动，日志在 [canvas-poll] 颜色行；任务详情看 /dev/canvas/tasks",
      command: "pnpm dev:all  （单独运行：pnpm --filter book-mall run canvas:poll-loop）",
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
