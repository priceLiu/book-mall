import Link from "next/link";
import {
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";
import { getPromptOptimizerOrigin } from "@/lib/prompt-optimizer-origin";
import { mainSitePromptOptimizerOpenHref } from "@/lib/main-site-app-open-links";

export const metadata = {
  title: "提示词优化器 · 实现逻辑 — AI 工具站",
};

export default function PromptOptimizerImplementationPage() {
  const origin = getPromptOptimizerOrigin();
  const openHref = mainSitePromptOptimizerOpenHref("/");

  return (
    <main className="tw-main fitting-room-main">
      <ToolImplementationDoc
        title="提示词优化器 · 实现逻辑"
        lead="工具站提供发现与引导；完整优化 UI 在独立应用 prompt-optimizer-platform（上游 Vue）。鉴权、计费与 Gateway 走 Book 联邦。"
        useToolHref="/prompt-optimizer"
        useToolLabel="回到提示词优化器首页"
      >
        <ToolImplementationSection heading="1. 架构分工">
          <p>
            <strong>tool-web</strong>：侧栏分组 <code>prompt-optimizer</code>；「优化工作台」经主站{" "}
            <code>/prompt-optimizer-open</code> SSO 打开独立应用。
          </p>
          <p>
            <strong>prompt-optimizer-platform</strong>：Next 薄壳 + Vue dist；端口{" "}
            <code>3006</code>；BFF <code>/api/gateway/chat</code> → Book Gateway。
          </p>
          <p>
            <strong>gateway-web</strong>：Model Manager 配置厂商 Key 与启用模型；禁止子应用自填 Key。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 打开方式">
          <p>
            <a href={openHref} target="_blank" rel="noopener noreferrer">
              经主站 SSO 打开
            </a>
            {" · "}
            <a href={origin} target="_blank" rel="noopener noreferrer">
              {origin}
            </a>
            {" · "}
            <Link href="/prompt-optimizer/studio">优化工作台</Link>
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. 环境变量">
          <ul>
            <li>
              tool-web：<code>NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN</code>、
              <code>NEXT_PUBLIC_MAIN_SITE_ORIGIN</code>
            </li>
            <li>
              book-mall：<code>NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN</code>（SSO 回调 Origin）
            </li>
            <li>
              prompt-optimizer-platform：<code>TOOLS_SSO_*</code> 与 book-mall 一致
            </li>
          </ul>
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
