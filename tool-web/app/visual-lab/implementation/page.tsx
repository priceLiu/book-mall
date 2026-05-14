import Link from "next/link";
import {
  ToolImplementationCode,
  ToolImplementationDoc,
  ToolImplementationSection,
} from "@/components/tool-implementation-doc";

export const metadata = {
  title: "视觉实验室 · 实现逻辑 — AI 工具站",
};

export default function VisualLabImplementationPage() {
  return (
    <main className="tw-main fitting-room-main visual-lab-main">
      <ToolImplementationDoc
        title="视觉实验室 · 实现逻辑"
        lead="本工具为一站式「读图底稿」实验场：首版在浏览器内完成尺幅与颜色速写，成果展仅用 localStorage；与图生视频同级交付（navKey、侧栏四项、双向链接、本页结构）。后续接入多模态理解与主站计费时，可在此顺延补充 Route Handler 与 toolKey。"
        useToolHref="/visual-lab"
        useToolLabel="回到视觉实验室首页"
      >
        <ToolImplementationSection heading="1. 流程摘要">
          <p>
            路由前缀 <code>/visual-lab</code>：<Link href="/visual-lab">首页</Link> 负责叙事与导航；{" "}
            <Link href="/visual-lab/analysis">分析室</Link> 接受用户选择的位图，在客户端用{" "}
            <code>Canvas</code> 下采样读取 <code>ImageData</code>，计算宽高、化简宽高比、平均 RGB 与亮度近似；可选备注与「保存到成果展」写入{" "}
            <code>localStorage</code>（键见 <code>lib/visual-lab-gallery.ts</code>
            ）。<Link href="/visual-lab/gallery">成果展</Link> 读取同键列表展示缩略图与元数据，支持单条删除与清空。
            「分析快照」与「仅保存模型回复（Markdown）」共用常数{" "}
            <code>VISUAL_LAB_GALLERY_SNAPSHOT_MAX</code>（当前为 10）条上限：新写入超过上限时会从列表中移除{" "}
            <strong>最早的一条</strong>同类型槽位条目，形成固定长度的循环覆盖；从回复里单独保存的图片 / 视频走另一套配额（
            <code>appendVisualLabReplyMediaItem</code>）。
          </p>
          <p>
            <strong>主站侧栏</strong>：分组 <code>navKey: visual-lab</code>，与{" "}
            <code>tool-web/config/nav-tools.ts</code>、<code>book-mall/lib/tool-suite-nav-keys.ts</code>、
            <code>ToolNavVisibility</code> 迁移保持一致；后台「工具管理」可隐藏该分组。
          </p>
          <p>
            <strong>计费</strong>：当前无服务端推理、无 <code>postToolUsage</code>；占位{" "}
            <code>toolKey</code> 建议使用前缀 <code>visual-lab</code>（若将来对「云端分析」打点，与子路径一致即可）。
          </p>
        </ToolImplementationSection>

        <ToolImplementationSection heading="2. 关键事项">
          <ul>
            <li>
              快照与纯回复条目含 data URL / 长文本；分析室侧以 <code>VISUAL_LAB_GALLERY_SNAPSHOT_MAX</code>{" "}
             （当前 10）限制「快照 + 仅保存的 Markdown 正文」条数，超出时按列表顺序丢弃最旧的一条 notebook 项。
              生产若改为 OSS + 主站表，应替换存储层并迁移展示路由。
            </li>
            <li>
              分析室仅做像素统计，不提供语义标签；请勿将当前数值用作版权或合规终裁依据。
            </li>
            <li>
              首页、分析室、成果展均含 <code>ToolImplementationCrossLink</code> 指向本页；本页 <code>ToolImplementationDoc</code>{" "}
              链回首页。
            </li>
          </ul>
        </ToolImplementationSection>

        <ToolImplementationSection heading="3. 核心代码摘录">
          <ToolImplementationCode
            caption="侧栏分组与四项子菜单（config/nav-tools.ts）"
            code={`{
  label: "视觉实验室",
  navKey: "visual-lab",
  children: [
    { href: "/visual-lab", label: "首页" },
    { href: "/visual-lab/analysis", label: "分析室" },
    { href: "/visual-lab/gallery", label: "成果展" },
    { href: "/visual-lab/implementation", label: "实现逻辑" },
  ],
}`}
          />
          <ToolImplementationCode
            caption="成果展持久化键与类型（lib/visual-lab-gallery.ts）"
            code={`export const VISUAL_LAB_GALLERY_STORAGE_KEY = "visual-lab-gallery-v1";
export const VISUAL_LAB_GALLERY_SNAPSHOT_MAX = 10; // 快照 + reply-markdown，超出轮删最旧
export type VisualLabGalleryItem = { id, createdAt, imageName, note, thumbDataUrl, stats, kind?, replyMarkdown? };`}
          />
        </ToolImplementationSection>
      </ToolImplementationDoc>
    </main>
  );
}
