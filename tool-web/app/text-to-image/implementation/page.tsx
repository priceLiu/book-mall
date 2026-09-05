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
            厂商凭证与出站 HTTP 均在主站 <strong>Gateway</strong>（
            <code>forward-gateway-dashscope-server</code> →{" "}
            <code>/api/sso/tools/gateway/dashscope</code>）；工具站进程<strong>不</strong>配置{" "}
            <code>DASHSCOPE_API_KEY</code>。
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
            caption="创建任务：校验 Cookie，经 Gateway 代理创建 DashScope 异步任务（app/api/text-to-image/start/route.ts）"
            code={`const created = await createDashscopeJobFromServer({
  kind: "wanx",
  model: WANX_TEXT2IMAGE_PLUS_MODEL,
  prompt,
  negativePrompt,
  n,
  clientPage: "text-to-image",
});

if (!created.ok) {
  return NextResponse.json({ error: created.error ?? "Gateway 调用失败" }, { status: 502 });
}

return NextResponse.json({
  taskId: created.taskId,
  gatewayLogId: created.logId,
});`}
          />

          <ToolImplementationCode
            caption="结算：Gateway poll 成功时 finalizeRequestLog 自动扣积分/BYOK 超额（settle 路由仅校验任务状态）"
            code={`const polled = await pollDashscopeJobFromServer({ taskId, gatewayLogId });
const status = (polled.output as WanxTaskPollOutput).task_status ?? "";
if (status !== "SUCCEEDED") {
  return NextResponse.json({ error: \`任务未完成…\`, taskStatus: status }, { status: 409 });
}
return NextResponse.json({ ok: true, creditBilling: true });`}
          />
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
