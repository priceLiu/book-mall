import Link from "next/link";
import {
  ToolImplementationCode,
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";
import { SMART_SUPPORT_MULTI_ROUND_NODE_SAMPLE } from "@/lib/smart-support-node-sample";

export const metadata = {
  title: "AI智能客服 · 实现逻辑 — AI 工具站",
};

const DIFY_IFRAME_SAMPLE = `<iframe
  src="https://udify.app/chatbot/<YOUR_EMBED_TOKEN>"
  title="Dify · AI智能客服"
  width="100%"
  height="520"
  allow="clipboard-write; microphone *"
></iframe>`;

const DIFY_EMBED_SAMPLE = `<script>
 window.difyChatbotConfig = {
  token: '<YOUR_EMBED_TOKEN>',
  inputs: {},
  systemVariables: {
    // user_id: '可选，UUID 或业务 ID',
  },
  userVariables: {
    // name: '可选昵称',
    // avatar_url: '可选头像 URL',
  },
 }
</script>
<script
 src="https://udify.app/embed.min.js"
 id="<YOUR_EMBED_TOKEN>"
 defer>
</script>
<style>
  #dify-chatbot-bubble-button {
    background-color: #1C64F2 !important;
  }
  #dify-chatbot-bubble-window {
    width: 24rem !important;
    height: 40rem !important;
  }
</style>`;

export default function SmartSupportImplementationPage() {
  return (
    <main className="tw-main fitting-room-main">
      <ToolImplementationDoc
        title="AI智能客服 · 实现逻辑"
        lead="「我的智能客服」页（`/smart-support/chat`）双栏：左侧 DeepSeek（服务端流式 API）；右侧 Dify 使用 Udify Chatbot **iframe**（`https://udify.app/chatbot/<token>`）。"
        useToolHref="/smart-support"
        useToolLabel="回到 AI智能客服首页"
      >
        <ToolImplementationSection heading="1. 流程摘要">
          <p>
            <strong>DeepSeek</strong>：浏览器将完整 <code>user / assistant</code> 历史 POST 至{" "}
            <code>/api/smart-support/chat</code>；服务端校验 Cookie、前置 <code>system</code> 后以{" "}
            <code>stream: true</code> 拉取 DeepSeek，正文以 <code>text/plain</code> 增量返回。详见{" "}
            <code>doc/deepseek-api.md</code>、<code>doc/multi-rounded-chat.MD</code>。
          </p>
          <p>
            <strong>Dify</strong>：「我的智能客服」页右栏使用官方 Chatbot URL 内嵌 iframe（构建 URL 见{" "}
            <code>lib/dify-embed-url.ts</code> 的 <code>getUdifyChatbotEmbedUrl</code>
            ）。token 来自 <code>NEXT_PUBLIC_DIFY_EMBED_TOKEN</code>（修改后需重启{" "}
            <code>pnpm dev</code>
            ）。若需传递 inputs / user_id 等动态变量，可改用 <code>doc/dify.md</code>{" "}
            的脚本气泡方案（见下文备选）。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 关键事项">
          <ul>
            <li>
              <code>DEEPSEEK_API_KEY</code> 仅服务端（<code>lib/deepseek-env.ts</code>
              ）；勿提交仓库。
            </li>
            <li>
              <code>NEXT_PUBLIC_*</code> 会进入前端 bundle；Dify 嵌入 token 面向公开嵌入场景，仍勿与控制台 Admin Key 混用。
            </li>
            <li>
              修改 <code>NEXT_PUBLIC_DIFY_EMBED_TOKEN</code> 后须<strong>重启</strong> Next
              开发服务，页面 iframe <code>src</code> 才会更新。
            </li>
            <li>
              多轮 DeepSeek：每次请求须携带此前全部轮次（与下文 Node 节选一致）。
            </li>
            <li>计费若按 token / 会话计费，须与 <code>POST /api/tool-usage</code> 约定对齐后再打点。</li>
            <li>
              页面入口：<Link href="/smart-support/chat">我的智能客服</Link>、
              <Link href="/smart-support">AI智能客服首页</Link>。
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. DeepSeek 流式（服务端节选）">
          <ToolImplementationCode
            caption="app/api/smart-support/chat/route.ts"
            code={`const stream = await client.chat.completions.create({
  model: "deepseek-chat",
  messages,
  stream: true,
});

for await (const chunk of stream) {
  const piece = chunk.choices[0]?.delta?.content ?? "";
  if (piece) controller.enqueue(encoder.encode(piece));
}`}
          />
        </ToolImplementationSection>

        <ToolImplementationSection heading="4. DeepSeek 多轮对话（Node.js 对照示例）">
          <p>
            下列片段对应 <code>doc/multi-rounded-chat.MD</code> 中的 Python
            写法，改为 Node.js OpenAI SDK；「我的智能客服」页左侧流式实现已在路由层完成拼接。
          </p>
          <ToolImplementationCode
            caption="非流式多轮（对照文档）"
            code={SMART_SUPPORT_MULTI_ROUND_NODE_SAMPLE}
          />
        </ToolImplementationSection>

        <ToolImplementationSection heading="5. Dify 嵌入（客户端）">
          <p>
            <strong>默认（本站）</strong>：右栏 iframe，可见性与左右布局一致；URL 形如{" "}
            <code>https://udify.app/chatbot/&lt;token&gt;</code>。
          </p>
          <ToolImplementationCode caption="iframe（我的智能客服页实际用法）" code={DIFY_IFRAME_SAMPLE} />
          <p>
            <strong>备选</strong>：<code>embed.min.js</code>{" "}
            会在页面全局挂载右下角气泡，易被侧栏 / 堆叠上下文遮挡或受 React Strict Mode
            重复挂载影响；若你必须用脚本以传入 <code>difyChatbotConfig.inputs</code> /{" "}
            <code>userVariables</code>，可参考下方控制台模板。
          </p>
          <ToolImplementationCode caption="doc/dify.md · 脚本气泡（占位 token）" code={DIFY_EMBED_SAMPLE} />
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
