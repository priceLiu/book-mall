import Link from "next/link";

export const metadata = {
  title: "实现逻辑 · canvas-web",
};

export default function ImplementationPage() {
  return (
    <div className="canvas-container py-12">
      <header>
        <p className="twenty-eyebrow">canvas-web · implementation</p>
        <h1 className="canvas-serif mt-3 text-4xl text-white">实现逻辑</h1>
        <p className="mt-3 max-w-3xl text-sm text-[var(--canvas-muted)]">
          canvas-web 是独立的 Next.js 子站（端口 3004），与 story-web 同款架构：登录、数据库、KIE
          调用全部归口主站 book-mall。本页解释画布编辑器、节点运行模型、跨站协议与可观测能力。
        </p>
      </header>

      <Section title="1. 架构与端口">
        <ul className="impl-list">
          <li>
            <code>canvas-web</code>（:3004）：纯前端 + 浏览器代理 <code>/api/book-mall/*</code>
          </li>
          <li>
            <code>tool-web</code>（:3001）：「AI 海报画布」侧栏组（首页 / 创意画室 / 画作 / 实现逻辑）
          </li>
          <li>
            <code>book-mall</code>（:3000）：单一 Postgres、NextAuth 会话、KIE 客户端、OSS 上传
          </li>
          <li>
            后台轮询：<code>book-mall</code> 的 <code>canvas:poll-loop</code>，由根 <code>pnpm dev:all</code> 默认拉起
          </li>
        </ul>
      </Section>

      <Section title="2. 画布编辑器（@xyflow/react）">
        <ul className="impl-list">
          <li>
            React Flow v12 渲染节点，<em>onlyRenderVisibleElements</em> 在节点 &gt; 500 时自动启用
          </li>
          <li>状态：<code>zustand</code> + <code>zundo</code>（撤销/重做），自动每 1.5s debounce 持久化</li>
          <li>
            外部拖图：根 <code>onDrop</code> 拦截 <code>image/*</code>，落点用 <code>screenToFlowPosition</code>{" "}
            转画布坐标，立刻渲染 blob URL 占位，后台并发上传 OSS 替换
          </li>
          <li>
            6 类节点：<code>image</code> / <code>text</code> / <code>product-params</code> /{" "}
            <code>ai-text</code> / <code>image-gen</code> / <code>output</code>，统一{" "}
            <code>NodeShell</code> 提供输入/输出端口与状态角标
          </li>
        </ul>
      </Section>

      <Section title="3. 节点执行 / 任务">
        <ol className="impl-list">
          <li>
            前端拓扑排序（<code>topoSort</code>），逐节点调用{" "}
            <code>POST /api/canvas/projects/:id/nodes/:nodeId/run</code>
          </li>
          <li>
            book-mall 的 <code>canvas-task-service</code> 计算{" "}
            <code>inputHash</code>（去重缓存）、提交 KIE，写{" "}
            <code>CanvasGenerationTask</code>
          </li>
          <li>
            前端运行队列单画布并发 ≤ 5；后端 <code>assertCanvasInflightCap</code> 二次校验
          </li>
          <li>
            5s 轮询 <code>GET /api/canvas/projects/:id/tasks</code> 同步状态；KIE 完成后{" "}
            <code>persistKieResultToOss</code> 把图存为永久 OSS URL
          </li>
          <li>
            错误兜底：节点角标显示 <code>failCode</code> + <code>failMessage</code>
          </li>
        </ol>
      </Section>

      <Section title="4. 关键 API（/api/canvas/*）">
        <table className="impl-table">
          <thead>
            <tr>
              <th>路径</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>GET /viewer-session</code>
              </td>
              <td>当前用户（与 NextAuth 会话同源）</td>
            </tr>
            <tr>
              <td>
                <code>GET /engine-models</code>
              </td>
              <td>可用模型；DB 为空时 fallback 内置三套</td>
            </tr>
            <tr>
              <td>
                <code>GET / POST /projects</code>
              </td>
              <td>列出 / 新建画布</td>
            </tr>
            <tr>
              <td>
                <code>GET / PATCH / DELETE /projects/:id</code>
              </td>
              <td>读取 / 自动保存 / 软删除（OSS 清理入队）</td>
            </tr>
            <tr>
              <td>
                <code>POST /projects/:id/nodes/:nodeId/run</code>
              </td>
              <td>提交单节点 AI 任务</td>
            </tr>
            <tr>
              <td>
                <code>GET /projects/:id/tasks</code>
              </td>
              <td>批量节点状态（前端 5s 轮询）</td>
            </tr>
            <tr>
              <td>
                <code>POST /uploads</code>
              </td>
              <td>外部拖图直传 OSS</td>
            </tr>
            <tr>
              <td>
                <code>GET / POST /templates</code>
              </td>
              <td>列模板 / 保存为我的模板</td>
            </tr>
            <tr>
              <td>
                <code>GET /works</code>
              </td>
              <td>所有 SUCCEEDED 图像任务，画作库视图</td>
            </tr>
            <tr>
              <td>
                <code>POST /kie/poll · /cleanup · /callback/:kind</code>
              </td>
              <td>异步轮询 / OSS 清理 / KIE webhook</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="5. 跨域 / 环境变量">
        <ul className="impl-list">
          <li>
            <code>CANVAS_WEB_ORIGINS</code>：白名单，允许浏览器从 canvas-web 直接调 book-mall
          </li>
          <li>
            <code>CANVAS_CORS_IN_APP</code>：1 时由 book-mall 主动写 CORS 头
          </li>
          <li>
            <code>CANVAS_AI_USER_INFLIGHT_MAX</code> / <code>CANVAS_PROJECT_INFLIGHT_MAX</code>：并发上限
          </li>
          <li>
            <code>NEXT_PUBLIC_CANVAS_WEB_ORIGIN</code>：tool-web「创意画室」外链回 canvas-web 用
          </li>
        </ul>
      </Section>

      <Section title="6. 可观测 / Dev 入口">
        <ul className="impl-list">
          <li>
            <code>GET /dev</code>（book-mall）：服务/进程总览，含 canvas / canvas-poll 卡片
          </li>
          <li>
            <code>GET /dev/canvas/tasks</code>：CanvasGenerationTask 看板（与 story 同款）
          </li>
          <li>
            <code>pnpm --filter book-mall canvas:poll-once</code>：手动跑一次轮询 / OSS 清理
          </li>
        </ul>
      </Section>

      <Section title="7. 后续迭代">
        <ul className="impl-list">
          <li>AiText 节点接入 LLM（KIE 文本路由），目前为 prompt 透传</li>
          <li>多图融合预设、三视图模板的运行时占位填充（自动从 ProductParams 注入参数）</li>
          <li>Output 节点附加 PNG 导出 / 海报排版叠加</li>
          <li>项目级缩略图自动从最近一次 SUCCEEDED 图像生成</li>
        </ul>
      </Section>

      <p className="mt-10 text-xs text-[var(--canvas-muted)]">
        想直接动手？{" "}
        <Link href="/projects" className="text-[var(--canvas-accent)] hover:underline">
          打开「我的画布」
        </Link>{" "}
        新建一个画布，或在{" "}
        <Link href="/models" className="text-[var(--canvas-accent)] hover:underline">
          模型配置
        </Link>{" "}
        添加你想试的 KIE 模型。
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="canvas-serif text-2xl text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
