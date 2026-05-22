const FAQ_ITEMS = [
  {
    q: "这是个人空间吗？",
    a: "是。每位用户将拥有独立空间；当前演示为固定模板，登录与多租户路由在后续版本接入。",
  },
  {
    q: "首页如何发布到 book-mall？",
    a: "二期将在主站增加「发布空间首页」入口，发布物即本页模板 + 代表作视频，访客可在主站直接播放。",
  },
  {
    q: "创作室 / 影像室 / 模型配置现在能用吗？",
    a: "一期为占位页，说明后续能力边界；AI 生成与计费将按 tool-web 既有方案对齐。",
  },
  {
    q: "与 tool-web「漫剧剧场」的关系？",
    a: "工具站负责导航与「我的剧场」收藏；完整创作流程在 story-web 打开。",
  },
] as const;

export function StoryFaq() {
  return (
    <dl className="mt-8 space-y-6">
      {FAQ_ITEMS.map(({ q, a }) => (
        <div key={q} className="story-card p-5">
          <dt className="font-medium">{q}</dt>
          <dd className="mt-2 text-sm leading-relaxed text-[var(--story-muted)]">{a}</dd>
        </div>
      ))}
    </dl>
  );
}
