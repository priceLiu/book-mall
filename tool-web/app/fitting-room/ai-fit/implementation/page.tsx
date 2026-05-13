import Link from "next/link";
import {
  ToolImplementationCode,
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";

export const metadata = {
  title: "AI试衣 · 实现逻辑 — AI 工具站",
};

export default function AiFitImplementationPage() {
  return (
    <main className="tw-main fitting-room-main">
      <ToolImplementationDoc
        title="AI试衣 · 实现逻辑"
        lead="异步试衣任务、DashScope 调用、成片落自有 OSS 与主站计费上报的串联说明。"
        useToolHref="/fitting-room/ai-fit"
        useToolLabel="回到 AI试衣页"
      >
        <ToolImplementationSection heading="1. 流程摘要">
          <p>
            用户在左侧配置模特与服装（含上传），前端将图片以 Data URL 或 URL 形式交给{" "}
            <code>POST /api/ai-fit/try-on</code>。路由内创建 DashScope 试衣任务并轮询；成功后可将成片转存自有
            OSS，再向主站上报一次 <code>try_on</code> 计费（<code>toolKey: fitting-room__ai-fit</code>
            ）。
          </p>
          <p>
            「我的衣柜」列表通过主站 SSO 代理读写；保存入口在试衣成功后的流程中触发。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 关键事项">
          <ul>
            <li>
              <strong>计费锚点</strong>：仅在任务成功且结果可展示后打点；余额不足时返回业务错误并避免误入账。
            </li>
            <li>
              <strong>幂等与缓存</strong>：同一 <code>taskId</code> 多次轮询时复用已上传 OSS 的 URL，避免重复存储与重复计费记录。
            </li>
            <li>
              <strong>套装预填</strong>：读 <code>?id=</code> 匹配 <code>OUTFITS</code>，预填成功后常用{" "}
              <code>router.replace</code> 清理查询串以免刷新重复执行。
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. 核心代码摘录">
          <ToolImplementationCode
            caption="计费键与上报封装入口（app/api/ai-fit/try-on/route.ts）"
            code={`const AI_FIT_USAGE_TOOL_KEY = "fitting-room__ai-fit";

async function reportAiFitTryOnUsage(opts: {
  taskId: string;
  imageUrl: string;
  persistedToOwnOss: boolean;
}): Promise<AiFitTryOnUsagePayload> {
  const usage = await postToolUsageFromServerWithRetries({
    toolKey: AI_FIT_USAGE_TOOL_KEY,
    action: "try_on",
    meta: {
      taskId: opts.taskId,
      resultImageUrl: opts.imageUrl,
      persistedToOwnOss: opts.persistedToOwnOss,
    },
  });
  // …402 余额不足、duplicate、recorded 等分支…
}`}
          />
        </ToolImplementationSection>

        <ToolImplementationSection heading="4. 相关页面">
          <p>
            试衣间套装的数据与跳转约定见{" "}
            <Link href="/fitting-room/implementation">实现逻辑 · 试衣间套装</Link>。
          </p>
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
