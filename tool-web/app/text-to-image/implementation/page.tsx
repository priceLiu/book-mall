import {
  ToolImplementationCode,
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";

export const metadata = {
  title: "文生图 · 实现逻辑 — AI 工具站",
};

export default function TextToImageImplementationPage() {
  return (
    <main className="tw-main fitting-room-main">
      <ToolImplementationDoc
        title="文生图 · 实现逻辑"
        lead="面向希望理解本站如何对接通义文生图与计费的开发者：以下为流程摘要、风险点与仓库内核心片段摘录；完整实现未开源。"
        useToolHref="/text-to-image"
        useToolLabel="回到文生图生成页"
      >
        <ToolImplementationSection heading="1. 流程摘要">
          <p>
            浏览器仅在已登录工具站（<code>tools_token</code> Cookie）前提下，通过同源{" "}
            <code>fetch</code> 调用 <code>/api/text-to-image/start</code> 创建异步任务，再用{" "}
            <code>/api/text-to-image/task</code> 轮询状态；任务成功后前端可先展示上游返回的 URL，再通过{" "}
            <code>/api/text-to-image/settle</code> 在主站侧按单次生成扣费（幂等键绑定 DashScope{" "}
            <code>task_id</code>）。可选：持久化到图片库走{" "}
            <code>/api/text-to-image/persist-library</code> 与主站库存 API。
          </p>
          <p>
            Key 仅服务端读取（<code>lib/qwen-env.ts</code> / <code>lib/tool-config.ts</code>
            ），勿下发给客户端组件。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 关键事项">
          <ul>
            <li>
              <strong>计费时机</strong>：仅在模型任务状态为 <code>SUCCEEDED</code> 且 settle 校验通过后上报{" "}
              <code>toolKey: text-to-image</code>、<code>action: invoke</code>；失败时可保留图片并允许用户「重试计费」。
            </li>
            <li>
              <strong>幂等</strong>：<code>meta.taskId</code> 与 DashScope 任务 ID 对齐，避免重复扣款。
            </li>
            <li>
              <strong>图片库</strong>：长期展示宜写入自有 OSS（或经主站持久化），勿长期依赖上游临时 URL。
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. 核心代码摘录">
          <ToolImplementationCode
            caption="创建任务：校验 Cookie、读取 Key、调用 DashScope 异步创建（app/api/text-to-image/start/route.ts）"
            code={`export async function POST(req: Request) {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const apiKey = getQwenApiKey();
  // ...
  const created = await wanxCreateTextToImageTask({
    apiKey,
    prompt,
    negativePrompt,
    n,
  });
  // ...
  return NextResponse.json({ taskId: created.taskId });
}`}
          />

          <ToolImplementationCode
            caption="结算扣费：确认任务成功后再 postToolUsageFromServerWithRetries（app/api/text-to-image/settle/route.ts）"
            code={`/** 文生图单次生成扣费 … 幂等键 meta.taskId = DashScope task_id */
export async function POST(req: Request) {
  // … 校验 tools_token、拉取任务状态 …
  if (status !== "SUCCEEDED") {
    return NextResponse.json({ error: \`任务未完成…\`, taskStatus: status }, { status: 409 });
  }

  const usage = await postToolUsageFromServerWithRetries({
    toolKey: "text-to-image",
    action: "invoke",
    meta: { taskId: billTaskId },
  });
  // …
}`}
          />

          <ToolImplementationCode
            caption="DashScope HTTP：异步头 + 模型名（lib/text-to-image-dashscope.ts）"
            code={`const res = await fetch(CREATE_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${opts.apiKey}\`,
    "X-DashScope-Async": "enable",
  },
  body: JSON.stringify({
    model: WANX_TEXT2IMAGE_PLUS_MODEL,
    input: { prompt, /* … */ },
    parameters: { size: "1024*1024", n, prompt_extend: true, watermark: false },
  }),
});`}
          />
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
