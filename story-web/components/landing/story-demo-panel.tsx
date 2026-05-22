import { Film, Layers, Settings, Sparkles } from "lucide-react";

const EPISODES = [
  { id: "ep-01", title: "序章 · 星尘", status: "已发布", scenes: 12 },
  { id: "ep-02", title: "第二幕 · 旅人", status: "剪辑中", scenes: 8 },
  { id: "ep-03", title: "第三幕 · 归途", status: "草稿", scenes: 4 },
] as const;

/** Twenty 风产品演示面板：模拟剧集 / 分镜列表 */
export function StoryDemoPanel() {
  return (
    <div className="story-card overflow-hidden shadow-lg ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-[var(--story-border)] bg-[var(--story-bg)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-[var(--story-accent)]" />
          演示空间 · 剧集看板
        </div>
        <span className="rounded-md bg-white px-2 py-0.5 text-xs text-[var(--story-muted)] ring-1 ring-[var(--story-border)]">
          模板 v1
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--story-border)] text-xs text-[var(--story-muted)]">
              <th className="px-4 py-2.5 font-medium">剧集</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">分镜</th>
            </tr>
          </thead>
          <tbody>
            {EPISODES.map((ep) => (
              <tr key={ep.id} className="border-b border-[var(--story-border)] last:border-0">
                <td className="px-4 py-3 font-medium">{ep.title}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[var(--story-bg)] px-2 py-0.5 text-xs">
                    {ep.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--story-muted)]">{ep.scenes} 镜</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-px bg-[var(--story-border)] border-t border-[var(--story-border)]">
        {[
          { icon: Film, label: "创作室" },
          { icon: Layers, label: "影像室" },
          { icon: Settings, label: "模型" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center justify-center gap-1.5 bg-white py-3 text-xs text-[var(--story-muted)]"
          >
            <Icon className="size-3.5" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
