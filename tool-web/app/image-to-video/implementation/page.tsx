import Link from "next/link";
import {
  ToolImplementationCode,
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";

export const metadata = {
  title: "图生视频 · 实现逻辑 — AI 工具站",
};

export default function ImageToVideoImplementationPage() {
  return (
    <main className="tw-main fitting-room-main">
      <ToolImplementationDoc
        title="图生视频 · 实现逻辑"
        lead="面向希望理解本站如何对接阿里云百炼视频合成（华北2）、计费与资产入库的开发者：流程摘要、模式差异与仓库内核心路径如下；与试衣间「实现逻辑」页同级的交付粒度（摘要 + 关键事项 + 摘录）。"
        useToolHref="/image-to-video"
        useToolLabel="回到图生视频首页"
      >
        <ToolImplementationSection heading="1. 流程摘要">
          <p>
            用户在 <Link href="/image-to-video/lab">实验室</Link>{" "}
            配置图生（<code>i2v</code>）、文生（<code>t2v</code>）、参考生（<code>ref</code>
            ）之一，浏览器携带 <code>tools_token</code> Cookie，同源{" "}
            <code>POST /api/image-to-video/start</code> 创建异步任务，再以{" "}
            <code>GET /api/image-to-video/task</code> 轮询至终态；成功后前端持有 DashScope 返回的短期{" "}
            <code>video_url</code> 做预览。
          </p>
          <p>
            <strong>计费</strong>：仅在任务 <code>SUCCEEDED</code> 后由{" "}
            <code>POST /api/image-to-video/settle</code> 再次拉取任务详情校验，再向主站上报{" "}
            <code>toolKey: image-to-video</code>、<code>action: invoke</code>，幂等键{" "}
            <code>meta.taskId</code> 对齐 DashScope <code>task_id</code>（逻辑同文生图 settle）。
          </p>
          <p>
            <strong>我的视频库</strong>：实验室卡片上「保存」走{" "}
            <code>POST /api/image-to-video/persist-library</code>：工具站服务端下载上游成片 URL，写入自有
            OSS，再带 Bearer <code>tools_token</code> 请求主站{" "}
            <code>MAIN_SITE_ORIGIN</code> 下的 <code>/api/sso/tools/image-to-video/library</code>{" "}
            落库。列表与删除由 <code>/api/image-to-video/library</code> 代理主站同路径。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 模式与上游参数">
          <ul>
            <li>
              <strong>模型清单</strong>：<code>config/lab-video-models.json</code>，经{" "}
              <code>lib/image-to-video-models.ts</code> 加载；实验室侧栏切换 <code>apiModel</code>。
            </li>
            <li>
              <strong>HTTP 与地域</strong>：创建与查询均走华北2「视频合成」异步接口，封装于{" "}
              <code>lib/image-to-video-dashscope.ts</code>（可与仓库内 <code>doc/pic-video.md</code>、
              <code>doc/chanaosheng.md</code>、<code>doc/wen-video.md</code> 对照）。
            </li>
            <li>
              <strong>文生视频参数分叉</strong>：<code>happyhorse-*</code> 文生使用{" "}
              <code>parameters.resolution</code> + <code>ratio</code> + <code>duration</code>（3～15
              秒）等；万相等仍使用像素 <code>size</code> + <code>duration</code>（5 或 10）。分支在{" "}
              <code>start/route.ts</code> 与 <code>t2vCreateVideoTask</code> 的{" "}
              <code>parameterStyle</code>。
            </li>
            <li>
              <strong>密钥</strong>：仅服务端 <code>lib/qwen-env.ts</code> 读取，勿下发到客户端组件。
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. 关键事项">
          <ul>
            <li>
              成片 URL 约 24 小时有效；长期留存须入库或本地下载，勿仅依赖播放器里的外链。
            </li>
            <li>
              工具站依赖 <code>MAIN_SITE_ORIGIN</code> 调用主站 SSO 库存与计费；本地开发需在{" "}
              <code>.env.local</code> 配置并同时运行主站（参见文生图实现逻辑页同类说明）。
            </li>
            <li>
              实验室 UI 与「实现逻辑」双向链接：<code>ToolImplementationCrossLink</code> 指向本页；本页通过{" "}
              <code>ToolImplementationDoc</code> 回到首页/实验室。
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="4. 核心代码摘录">
          <ToolImplementationCode
            caption="创建任务：鉴权、分流 i2v / r2v / t2v（app/api/image-to-video/start/route.ts）"
            code={`// kind: i2v | ref | t2v → i2vCreateVideoTask / r2vCreateReferenceVideoTask / t2vCreateVideoTask
// t2v：happyhorse-* → resolution + ratio + duration(3–15)；否则 size + duration(5|10)`}
          />

          <ToolImplementationCode
            caption="结算扣费：确认 SUCCEEDED 后 postToolUsageFromServerWithRetries（app/api/image-to-video/settle/route.ts）"
            code={`const usage = await postToolUsageFromServerWithRetries({
  toolKey: "image-to-video",
  action: "invoke",
  meta: { taskId: billTaskId, videoUrl },
});`}
          />

          <ToolImplementationCode
            caption="入库：拉取成片 → persistImageToVideoResultToOss → 主站 library POST（app/api/image-to-video/persist-library/route.ts）"
            code={`ossUrl = await persistImageToVideoResultToOss(sourceUrl);
await fetch(origin + "/api/sso/tools/image-to-video/library", {
  method: "POST",
  headers: { Authorization: \`Bearer \${toolsToken}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ videoUrl: ossUrl, mode, resolution, durationSec, prompt, seed, modelLabel }),
});`}
          />
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
