import Link from "next/link";
import {
  ToolImplementationCode,
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";
import { getStoryWebOrigin } from "@/lib/story-web-origin";

export const metadata = {
  title: "漫剧剧场 · 实现逻辑 — AI 工具站",
};

export default function StoryTheaterImplementationPage() {
  const storyOrigin = getStoryWebOrigin();

  return (
    <main className="tw-main fitting-room-main">
      <ToolImplementationDoc
        title="漫剧剧场 · 实现逻辑"
        lead="工具站提供发现、导流与「我的剧场」收藏；完整个人空间与 AI 创作在独立应用 story-web。与视觉实验室同级：navKey、侧栏四项、实现逻辑页结构一致。"
        useToolHref="/story-theater"
        useToolLabel="回到漫剧剧场首页"
      >
        <ToolImplementationSection heading="1. 架构分工">
          <p>
            <strong>tool-web</strong>：侧栏分组 <code>story-theater</code>；「创作幻想家」大视频 + 外链{" "}
            <a href={storyOrigin} target="_blank" rel="noopener noreferrer">
              {storyOrigin}
            </a>
            ；「我的剧场」用 <code>localStorage</code>（键{" "}
            <code>story-theater-library-v1</code>）。
          </p>
          <p>
            <strong>story-web</strong>：用户个人空间（首页模板、创作室、影像室、模型配置）。生产域{" "}
            <code>story.ai-code8.com</code>，端口 <code>3003</code>。
          </p>
          <p>
            <strong>book-mall</strong>（后续）：空间首页发布为主站作品，访客直接播放首页代表作；一期未接 API。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 环境变量">
          <ul>
            <li>
              tool-web / book-mall（可选）：<code>NEXT_PUBLIC_STORY_WEB_ORIGIN</code> — 外链 story-web
            </li>
            <li>
              story-web：<code>NEXT_PUBLIC_BOOK_MALL_URL</code> — 未来 SSO 与发布互通
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. 侧栏注册">
          <ToolImplementationCode
            caption="config/nav-tools.ts"
            code={`{
  label: "漫剧剧场",
  navKey: "story-theater",
  children: [
    { href: "/story-theater", label: "首页" },
    { href: "/story-theater/creator", label: "创作幻想家" },
    { href: "/story-theater/library", label: "我的剧场" },
    { href: "/story-theater/implementation", label: "实现逻辑" },
  ],
}`}
          />
          <p>
            主站 <code>ToolNavVisibility</code> 须含 <code>navKey = story-theater</code>（迁移追加，不影响既有业务）。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="4. 迭代路线">
          <ul>
            <li>一期：story-web 固定模板首页 + 占位页；tool-web 导流与收藏</li>
            <li>二期：SSO、每用户 slug、首页多模板</li>
            <li>三期：发布到 book-mall、AI 引擎与计费对齐 tool-web 方案</li>
          </ul>
          <p>
            详细计划见 story-web{" "}
            <code>docs/plan.md</code>。
          </p>
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
