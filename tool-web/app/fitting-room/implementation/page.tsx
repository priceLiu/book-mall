import Link from "next/link";
import {
  ToolImplementationCode,
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";

export const metadata = {
  title: "试衣间套装 · 实现逻辑 — AI 工具站",
};

export default function FittingRoomImplementationPage() {
  return (
    <main className="tw-main fitting-room-main">
      <ToolImplementationDoc
        title="试衣间（套装）· 实现逻辑"
        lead="套装列表、筛选与详情弹层的数据流与跳转约定；试穿动作会进入 AI智能试衣并预填服装。"
        useToolHref="/fitting-room"
        useToolLabel="回到试衣间套装页"
      >
        <ToolImplementationSection heading="1. 流程摘要">
          <p>
            套装数据来自 <code>mock/data.json</code>，经 <code>lib/fitting-room-data.ts</code> 导出为{" "}
            <code>OUTFITS</code>；画廊组件按性别筛选展示，点击卡片打开弹层浏览多图。
          </p>
          <p>
            弹层内「试穿」使用 <code>router.push(&apos;/fitting-room/ai-fit?id=&apos; + …)</code>
            ，AI智能试衣页根据 URL 查询参数预填对应套装。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 关键事项">
          <ul>
            <li>
              外链图片在开发环境可走 <code>/api/fit-image</code> 同源代理，逻辑见{" "}
              <code>lib/fitting-room-image-url.ts</code>。
            </li>
            <li>
              试衣间<strong>浏览</strong>本身不计入应用历史扣费；计费发生在 AI智能试衣成片成功后。
            </li>
            <li>
              AI智能试衣与衣柜的实现逻辑见{" "}
              <Link href="/fitting-room/ai-fit/implementation">实现逻辑 · AI智能试衣</Link>。
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. 核心代码摘录">
          <ToolImplementationCode
            caption="试穿跳转：带套装 id 进入 AI智能试衣（app/fitting-room/fitting-room-modal.tsx）"
            code={`router.push(\`/fitting-room/ai-fit?id=\${encodeURIComponent(outfit.id)}\`);`}
          />
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
