"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  createEcomStoryTheaterTopicEntry,
  deleteEcomStoryTheaterTopicEntry,
  fetchEcomStoryTheaterTopicCatalog,
  STORY_THEATER_STORY_TYPES,
  STORY_THEATER_VERTICAL_LABELS,
  updateEcomStoryTheaterTopicEntry,
  type EcomStoryTheaterTopicEntry,
} from "@/lib/ecom-story-theater-topic-api";
import type { StoryTheaterVertical } from "@/lib/story-theater-types";
import { cn } from "@/lib/utils";

type VerticalTab = StoryTheaterVertical;

function CatalogSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold text-[#86868b]">{title}</h4>
      {children}
    </section>
  );
}

function TopicTable({
  rows,
  readonly,
  onEdit,
  onRemove,
}: {
  rows: EcomStoryTheaterTopicEntry[];
  readonly?: boolean;
  onEdit?: (entry: EcomStoryTheaterTopicEntry) => void;
  onRemove?: (entry: EcomStoryTheaterTopicEntry) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-[#86868b]">暂无条目。</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e5e5ea]">
      <table className="min-w-[720px] w-full text-left text-xs">
        <thead>
          <tr className="bg-[#1d1d1f] text-white">
            <th className="px-3 py-2">标题</th>
            <th className="px-3 py-2">故事类型</th>
            <th className="px-3 py-2">故事核心</th>
            <th className="px-3 py-2">标签</th>
            {!readonly ? <th className="px-3 py-2">操作</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[#e5e5ea]">
              <td className="px-3 py-2 text-[#1d1d1f]">{row.title}</td>
              <td className="px-3 py-2 text-[#424245]">{row.storyType}</td>
              <td className="max-w-md px-3 py-2 text-[#6e6e73]">{row.storyCore}</td>
              <td className="px-3 py-2 text-[#6e6e73]">
                {row.tags?.length ? row.tags.join(" · ") : "—"}
              </td>
              {!readonly ? (
                <td className="px-3 py-2">
                  {onEdit ? (
                    <button
                      type="button"
                      className="mr-2 text-[#0071e3]"
                      onClick={() => onEdit(row)}
                    >
                      编辑
                    </button>
                  ) : null}
                  {onRemove ? (
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => onRemove(row)}
                    >
                      删除
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StoryTheaterCatalogPanel() {
  const { alert, doubleConfirm } = useDialogs();
  const [vertical, setVertical] = useState<VerticalTab>("fashion_apparel");
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<{
    platform: EcomStoryTheaterTopicEntry[];
    user: EcomStoryTheaterTopicEntry[];
  }>({ platform: [], user: [] });
  const [form, setForm] = useState<{
    id?: string;
    title: string;
    storyCore: string;
    storyType: string;
    tags: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEcomStoryTheaterTopicCatalog(vertical);
      setCatalog({
        platform: data.platform ?? data.topics.filter((t) => (t.scope ?? "platform") === "platform"),
        user: data.user ?? data.topics.filter((t) => t.scope === "user"),
      });
    } catch (e) {
      await alert({
        title: "加载失败",
        message: e instanceof Error ? e.message : "加载失败",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alert from useDialogs is stable enough
  }, [vertical]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const verticalLabels = useMemo(
    () =>
      ({
        fashion_apparel: "服装",
        bags: "包包",
        digital_3c: "3C 数码",
      }) as const,
    [],
  );

  async function saveTopic() {
    if (!form?.title.trim() || !form.storyCore.trim() || !form.storyType.trim()) {
      await alert({ title: "请填写完整", message: "标题、故事核心与故事类型均为必填。", variant: "error" });
      return;
    }
    const tags = form.tags
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      if (form.id) {
        await updateEcomStoryTheaterTopicEntry(form.id, {
          vertical,
          title: form.title.trim(),
          storyCore: form.storyCore.trim(),
          storyType: form.storyType.trim(),
          tags,
        });
      } else {
        await createEcomStoryTheaterTopicEntry({
          vertical,
          title: form.title.trim(),
          storyCore: form.storyCore.trim(),
          storyType: form.storyType.trim(),
          tags,
        });
      }
      setForm(null);
      await reload();
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "保存失败",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeTopic(entry: EcomStoryTheaterTopicEntry) {
    if (
      !(await doubleConfirm({
        title: "删除故事主题",
        message: `确定删除「${entry.title}」？`,
        secondTitle: "不可恢复",
        secondMessage: "删除后无法恢复。",
      }))
    ) {
      return;
    }
    try {
      await deleteEcomStoryTheaterTopicEntry(entry.id);
      await reload();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "删除失败",
        variant: "error",
      });
    }
  }

  const platformForVertical = catalog.platform.filter((t) => t.vertical === vertical);
  const userForVertical = catalog.user.filter((t) => t.vertical === vertical);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[#e8e8ed] pb-3">
        {(Object.keys(verticalLabels) as VerticalTab[]).map((v) => (
          <button
            key={v}
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition",
              vertical === v
                ? "bg-[#1d1d1f] text-white"
                : "bg-[#f5f5f7] text-[#424245] hover:bg-[#e8e8ed]",
            )}
            onClick={() => setVertical(v)}
          >
            {verticalLabels[v]}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-[#86868b]">加载中…</p> : null}

      <CatalogSection title="系统推荐（只读）">
        <p className="text-[11px] text-[#86868b]">
          共 {platformForVertical.length} 条 · 垂直：{STORY_THEATER_VERTICAL_LABELS[vertical]}
        </p>
        <TopicTable rows={platformForVertical} readonly />
      </CatalogSection>

      <CatalogSection title="我的故事主题">
        <div className="mb-2 flex justify-end">
          <EcomButtonSecondary
            type="button"
            onClick={() =>
              setForm({
                title: "",
                storyCore: "",
                storyType: STORY_THEATER_STORY_TYPES[0] ?? "痛点治愈",
                tags: "",
              })
            }
          >
            新建故事主题
          </EcomButtonSecondary>
        </div>
        {userForVertical.length === 0 ? (
          <p className="text-xs text-[#86868b]">
            暂无自建故事主题。登录后新建，可在故事剧场模式助手选题时参与随机抽取。
          </p>
        ) : (
          <TopicTable
            rows={userForVertical}
            onEdit={(entry) =>
              setForm({
                id: entry.id,
                title: entry.title,
                storyCore: entry.storyCore,
                storyType: entry.storyType,
                tags: entry.tags?.join("、") ?? "",
              })
            }
            onRemove={removeTopic}
          />
        )}
      </CatalogSection>

      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[#1d1d1f]">
              {form.id ? "编辑故事主题" : "新建故事主题"}
            </h3>
            <p className="mt-1 text-xs text-[#86868b]">
              垂直：{STORY_THEATER_VERTICAL_LABELS[vertical]}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs">
                <span className="text-[#424245]">标题</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[#e5e5ea] px-3 py-2 text-sm"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="block text-xs">
                <span className="text-[#424245]">故事类型</span>
                <select
                  className="mt-1 w-full rounded-lg border border-[#e5e5ea] px-3 py-2 text-sm"
                  value={form.storyType}
                  onChange={(e) => setForm({ ...form, storyType: e.target.value })}
                >
                  {STORY_THEATER_STORY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-[#424245]">故事核心</span>
                <textarea
                  className="mt-1 min-h-[100px] w-full rounded-lg border border-[#e5e5ea] px-3 py-2 text-sm"
                  value={form.storyCore}
                  onChange={(e) => setForm({ ...form, storyCore: e.target.value })}
                />
              </label>
              <label className="block text-xs">
                <span className="text-[#424245]">标签（逗号分隔，可选）</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[#e5e5ea] px-3 py-2 text-sm"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <EcomButtonSecondary type="button" onClick={() => setForm(null)}>
                取消
              </EcomButtonSecondary>
              <EcomButtonPrimary type="button" disabled={saving} onClick={() => void saveTopic()}>
                {saving ? "保存中…" : "保存"}
              </EcomButtonPrimary>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
