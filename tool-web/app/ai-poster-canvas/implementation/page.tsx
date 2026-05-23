import {
  ToolImplementationCode,
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";
import { getCanvasWebOrigin } from "@/lib/canvas-web-origin";

export const metadata = {
  title: "AI 海报画布 · 实现逻辑 — AI 工具站",
};

export default function AiPosterCanvasImplementationPage() {
  const canvasOrigin = getCanvasWebOrigin();

  return (
    <main className="tw-main fitting-room-main">
      <ToolImplementationDoc
        title="AI 海报画布 · 实现逻辑"
        lead="工具站提供发现、引导与画作展示；完整画布编辑与 AI 生成在独立应用 canvas-web。后端、数据库、登录、KIE、OSS 全部归口 book-mall。与漫剧剧场同级。"
        useToolHref="/ai-poster-canvas"
        useToolLabel="回到 AI 海报画布首页"
      >
        <ToolImplementationSection heading="1. 架构分工">
          <p>
            <strong>tool-web</strong>：侧栏分组 <code>ai-poster-canvas</code>；「创意画室」大图 + 外链{" "}
            <a href={canvasOrigin} target="_blank" rel="noopener noreferrer">
              {canvasOrigin}
            </a>
            ；「画作」拉取主站 <code>/api/canvas/works</code>。
          </p>
          <p>
            <strong>canvas-web</strong>：ComfyUI 风格无限画布；React Flow + zustand + zundo + dagre；6 类节点自由拼接，单画布并发上限 5。生产域 <code>canvas.ai-code8.com</code>，端口 <code>3004</code>。
          </p>
          <p>
            <strong>book-mall</strong>：DB（<code>CanvasProject</code>/<code>CanvasGenerationTask</code>/<code>CanvasEngineModel</code>/<code>CanvasTemplate</code>）、登录会话、KIE 调用、OSS 持久化；轮询脚本 <code>canvas:poll-loop</code>。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 节点系统">
          <ul>
            <li>
              <strong>图片节点 (Image)</strong>：上传 / 粘贴 / 外部拖图，支持多视角。
            </li>
            <li>
              <strong>文本节点 (Text)</strong> / <strong>产品参数 (ProductParams)</strong>：参考与结构化输入。
            </li>
            <li>
              <strong>AI 文本 (AiText)</strong>：智能口令模板，参数化插槽。
            </li>
            <li>
              <strong>图片生成 (ImageGen)</strong>：选模型 / 分辨率 / N 张 / 多图融合。
            </li>
            <li>
              <strong>输出 (Output)</strong>：导出 / 收藏到画作库。
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. 环境变量">
          <ul>
            <li>
              tool-web：<code>NEXT_PUBLIC_CANVAS_WEB_ORIGIN</code> — 外链 canvas-web
            </li>
            <li>
              canvas-web：<code>NEXT_PUBLIC_BOOK_MALL_URL</code> / <code>BOOK_MALL_URL</code> — 后端 API 与登录
            </li>
            <li>
              book-mall：<code>CANVAS_WEB_ORIGINS</code> — CORS 白名单；<code>KIE_API_KEY</code> 与 story 共用
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="4. 侧栏注册">
          <ToolImplementationCode
            caption="config/nav-tools.ts"
            code={`{
  label: "AI 海报画布",
  navKey: "ai-poster-canvas",
  children: [
    { href: "/ai-poster-canvas", label: "首页" },
    { href: "/ai-poster-canvas/studio", label: "创意画室" },
    { href: "/ai-poster-canvas/gallery", label: "画作" },
    { href: "/ai-poster-canvas/implementation", label: "实现逻辑" },
  ],
}`}
          />
          <p>
            主站 <code>ToolNavVisibility</code> 须含 <code>navKey = ai-poster-canvas</code>（迁移
            <code>20260706120000_tool_nav_ai_poster_canvas</code>）。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="5. 迭代路线">
          <ul>
            <li>一期：6 类节点 + 3 套模板（产品海报 / 短视封面 / 三视图） + 多图融合</li>
            <li>二期：自定义模型注册、视频节点、批量生成</li>
            <li>三期：协作（多人同画布）、版本对比、A/B 评审</li>
          </ul>
          <p>
            详细计划见 canvas-web <code>docs/plan.md</code>、<code>docs/do.md</code>。
          </p>
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
