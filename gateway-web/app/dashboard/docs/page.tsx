import { getGatewayPublicOrigin } from "@/lib/book-mall-base-url";
import Link from "next/link";

export default function DashboardDocsPage() {
  const base =
    process.env.GATEWAY_PUBLIC_ORIGIN?.trim() ||
    getGatewayPublicOrigin() ||
    "http://localhost:3005";
  const apiBase = `${base.replace(/\/$/, "")}/api/v1`;

  const chatCurl = `curl -X POST '${apiBase}/chat/completions' \\
  -H 'Authorization: Bearer sk-gw-你的密钥' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'`;

  const createTaskCurl = `curl -X POST '${apiBase}/jobs/createTask' \\
  -H 'Authorization: Bearer sk-gw-你的密钥' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "model": "kie-video",
    "input": {"prompt": "一只猫在跑步"}
  }'`;

  const recordInfoCurl = `curl -X POST '${apiBase}/jobs/recordInfo' \\
  -H 'Authorization: Bearer sk-gw-你的密钥' \\
  -H 'Content-Type: application/json' \\
  -d '{"taskId": "外部任务ID"}'`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--gw-ink)]">接入文档</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          对外 Base URL：<code className="text-[var(--gw-ink)]/90">{apiBase}</code>
          {" · "}
          <Link href="/dashboard/playground" className="text-[var(--gw-accent)] hover:underline">
            在界面里调试（无需 curl）
          </Link>
        </p>
      </div>

      <section className="gw-card space-y-3">
        <h2>Chat Completions</h2>
        <p className="text-sm text-[var(--gw-muted)]">
          OpenAI 兼容对话接口，需在控制台创建 API 密钥并配置对应厂商凭证。
        </p>
        <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-[var(--gw-ink)]/90">
          {chatCurl}
        </pre>
      </section>

      <section className="gw-card space-y-3">
        <h2>Jobs · createTask</h2>
        <p className="text-sm text-[var(--gw-muted)]">
          异步任务创建（视频/图片等），返回 taskId 后轮询 recordInfo。
        </p>
        <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-[var(--gw-ink)]/90">
          {createTaskCurl}
        </pre>
      </section>

      <section className="gw-card space-y-3">
        <h2>Jobs · recordInfo</h2>
        <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-[var(--gw-ink)]/90">
          {recordInfoCurl}
        </pre>
      </section>
    </div>
  );
}
