"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminPoseLibraryGenerateStudio } from "@/components/admin/admin-pose-library-generate-studio";
import {
  confirmDestructiveTwice,
  CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
} from "@/lib/confirm-destructive-twice";

type PoseRow = {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  ossUrl?: string | null;
  thumbUrl?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

type PropRow = {
  id: string;
  name: string;
  visualDescription: string;
  conflictTags?: string[];
  ossUrl?: string;
  enabled?: boolean;
  sortOrder?: number;
};

type SceneRow = {
  id: string;
  name: string;
  visualPrompt: string;
  tags?: Record<string, unknown>;
  enabled?: boolean;
  sortOrder?: number;
};

const SCENE_ARCHETYPE_OPTIONS = [
  { value: "studio", label: "影棚" },
  { value: "outdoor", label: "户外" },
  { value: "street", label: "街拍" },
  { value: "indoor_lifestyle", label: "室内生活" },
  { value: "commercial", label: "商业" },
];

function sceneArchetypeFromTags(tags?: Record<string, unknown>): string {
  if (!tags || typeof tags !== "object") return "studio";
  const raw = tags.archetype;
  return typeof raw === "string" ? raw : "studio";
}

function CatalogListShell({
  title,
  loading,
  error,
  onAdd,
  children,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          className="rounded bg-[#0969da] px-3 py-1 text-xs text-white"
          onClick={onAdd}
        >
          新建
        </button>
      </div>
      {loading ? <p className="text-xs text-muted-foreground">加载中…</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {children}
    </div>
  );
}

export function PoseLibraryAdmin() {
  const [rows, setRows] = useState<PoseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PoseRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [generateOpen, setGenerateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ecom/pose-library/models");
      const data = (await res.json()) as { poses?: PoseRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setRows(data.poses ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) =>
    categoryFilter === "all" ? true : r.category === categoryFilter,
  );

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch(
        form.id && rows.some((r) => r.id === form.id)
          ? `/api/admin/ecom/pose-library/models/${encodeURIComponent(form.id)}`
          : "/api/admin/ecom/pose-library/models",
        {
          method: form.id && rows.some((r) => r.id === form.id) ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: PoseRow) {
    if (
      !confirmDestructiveTwice(
        `确定删除「${row.title}」？`,
        CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/ecom/pose-library/models/${encodeURIComponent(row.id)}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  }

  return (
    <CatalogListShell
      title="姿势库"
      loading={loading}
      error={error}
      onAdd={() =>
        setForm({ id: "", category: "A", title: "", baseDescription: "", sortOrder: 0, enabled: true })
      }
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-[#0969da] px-2 py-1 text-xs text-[#0969da]"
          onClick={() => setGenerateOpen(true)}
        >
          生成姿势参考图
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {["all", "A", "B", "C", "D", "E", "H", "I", "J", "K", "L", "M"].map((c) => (
          <button
            key={c}
            type="button"
            className={`rounded border px-2 py-0.5 text-xs ${categoryFilter === c ? "bg-[#0969da] text-white" : ""}`}
            onClick={() => setCategoryFilter(c)}
          >
            {c === "all" ? "全部" : c}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-[720px] w-full text-left text-xs">
          <thead className="bg-[#1d1d1f] text-white">
            <tr>
              <th className="px-2 py-2 align-top">预览</th>
              <th className="px-2 py-2 align-top">ID</th>
              <th className="px-2 py-2 align-top">类</th>
              <th className="px-2 py-2 align-top">标题</th>
              <th className="px-2 py-2 align-top">描述</th>
              <th className="px-2 py-2 align-top">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2">
                  {r.thumbUrl || r.ossUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbUrl || r.ossUrl || ""}
                      alt=""
                      className="size-14 rounded object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2">{r.id}</td>
                <td className="px-2 py-2">{r.category}</td>
                <td className="px-2 py-2">{r.title}</td>
                <td className="max-w-md px-2 py-2 text-muted-foreground">{r.baseDescription}</td>
                <td className="px-2 py-2">
                  <button type="button" className="mr-2 text-[#0969da]" onClick={() => setForm(r)}>
                    编辑
                  </button>
                  <button type="button" className="text-red-600" onClick={() => void remove(r)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow">
            <h4 className="mb-3 font-semibold">{form.id && rows.some((r) => r.id === form.id) ? "编辑" : "新建"}姿势</h4>
            <div className="space-y-2 text-xs">
              <input className="w-full rounded border px-2 py-1" placeholder="id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
              <input className="w-full rounded border px-2 py-1" placeholder="category (A-M)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input className="w-full rounded border px-2 py-1" placeholder="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <textarea className="min-h-[100px] w-full rounded border px-2 py-1" placeholder="baseDescription" value={form.baseDescription} onChange={(e) => setForm({ ...form, baseDescription: e.target.value })} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1" onClick={() => setForm(null)}>取消</button>
              <button type="button" className="rounded bg-[#0969da] px-3 py-1 text-white" disabled={saving} onClick={() => void save()}>保存</button>
            </div>
          </div>
        </div>
      ) : null}
      <AdminPoseLibraryGenerateStudio
        open={generateOpen}
        poses={rows}
        onClose={() => setGenerateOpen(false)}
        onDone={() => void load()}
      />
    </CatalogListShell>
  );
}

export function PropLibraryAdmin() {
  const [rows, setRows] = useState<PropRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PropRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ecom/prop-library/models");
      const data = (await res.json()) as { props?: PropRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setRows(data.props ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const isEdit = form.id && rows.some((r) => r.id === form.id);
      const res = await fetch(
        isEdit ? `/api/admin/ecom/prop-library/models/${encodeURIComponent(form.id)}` : "/api/admin/ecom/prop-library/models",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CatalogListShell title="道具库" loading={loading} error={error} onAdd={() => setForm({ id: "", name: "", visualDescription: "", sortOrder: 0, enabled: true })}>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-[720px] w-full text-left text-xs">
          <thead className="bg-[#1d1d1f] text-white">
            <tr>
              <th className="px-2 py-2 align-top">ID</th>
              <th className="px-2 py-2 align-top">名称</th>
              <th className="px-2 py-2 align-top">描述</th>
              <th className="px-2 py-2 align-top">冲突标签</th>
              <th className="px-2 py-2 align-top">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2">{r.id}</td>
                <td className="px-2 py-2">{r.name}</td>
                <td className="max-w-md px-2 py-2 text-muted-foreground">{r.visualDescription}</td>
                <td className="px-2 py-2 text-muted-foreground">
                  {r.conflictTags?.length ? r.conflictTags.join(", ") : "—"}
                </td>
                <td className="px-2 py-2">
                  <button type="button" className="text-[#0969da]" onClick={() => setForm(r)}>编辑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow">
            <div className="space-y-2 text-xs">
              <input className="w-full rounded border px-2 py-1" placeholder="id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
              <input className="w-full rounded border px-2 py-1" placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className="min-h-[80px] w-full rounded border px-2 py-1" placeholder="visualDescription" value={form.visualDescription} onChange={(e) => setForm({ ...form, visualDescription: e.target.value })} />
              <input className="w-full rounded border px-2 py-1" placeholder="conflictTags 逗号分隔" value={form.conflictTags?.join(", ") ?? ""} onChange={(e) => setForm({ ...form, conflictTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1" onClick={() => setForm(null)}>取消</button>
              <button type="button" className="rounded bg-[#0969da] px-3 py-1 text-white" disabled={saving} onClick={() => void save()}>保存</button>
            </div>
          </div>
        </div>
      ) : null}
    </CatalogListShell>
  );
}

export function SceneLibraryAdmin() {
  const [rows, setRows] = useState<SceneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SceneRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ecom/scene-library/models");
      const data = (await res.json()) as { scenes?: SceneRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setRows(data.scenes ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const isEdit = form.id && rows.some((r) => r.id === form.id);
      const archetype = sceneArchetypeFromTags(form.tags);
      const res = await fetch(
        isEdit ? `/api/admin/ecom/scene-library/models/${encodeURIComponent(form.id)}` : "/api/admin/ecom/scene-library/models",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, archetype }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CatalogListShell title="场景库" loading={loading} error={error} onAdd={() => setForm({ id: "", name: "", visualPrompt: "", tags: { archetype: "studio" }, sortOrder: 0, enabled: true })}>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-[720px] w-full text-left text-xs">
          <thead className="bg-[#1d1d1f] text-white">
            <tr>
              <th className="px-2 py-2 align-top">ID</th>
              <th className="px-2 py-2 align-top">名称</th>
              <th className="px-2 py-2 align-top">类型</th>
              <th className="px-2 py-2 align-top">visualPrompt</th>
              <th className="px-2 py-2 align-top">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2">{r.id}</td>
                <td className="px-2 py-2">{r.name}</td>
                <td className="px-2 py-2">{sceneArchetypeFromTags(r.tags)}</td>
                <td className="max-w-md px-2 py-2 text-muted-foreground">{r.visualPrompt}</td>
                <td className="px-2 py-2">
                  <button type="button" className="text-[#0969da]" onClick={() => setForm(r)}>编辑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow">
            <div className="space-y-2 text-xs">
              <input className="w-full rounded border px-2 py-1" placeholder="id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
              <input className="w-full rounded border px-2 py-1" placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select
                className="w-full rounded border px-2 py-1"
                value={sceneArchetypeFromTags(form.tags)}
                onChange={(e) => setForm({ ...form, tags: { archetype: e.target.value } })}
              >
                {SCENE_ARCHETYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <textarea className="min-h-[80px] w-full rounded border px-2 py-1" placeholder="visualPrompt" value={form.visualPrompt} onChange={(e) => setForm({ ...form, visualPrompt: e.target.value })} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1" onClick={() => setForm(null)}>取消</button>
              <button type="button" className="rounded bg-[#0969da] px-3 py-1 text-white" disabled={saving} onClick={() => void save()}>保存</button>
            </div>
          </div>
        </div>
      ) : null}
    </CatalogListShell>
  );
}

type StoryTheaterVertical = "fashion_apparel" | "bags" | "digital_3c";

type StoryTheaterTopicRow = {
  id: string;
  vertical: StoryTheaterVertical;
  title: string;
  storyCore: string;
  storyType: string;
  tags?: string[];
  sortOrder?: number;
  enabled?: boolean;
};

const STORY_THEATER_VERTICAL_OPTIONS: Array<{ value: StoryTheaterVertical | "all"; label: string }> = [
  { value: "all", label: "全部垂类" },
  { value: "fashion_apparel", label: "服装" },
  { value: "bags", label: "包包" },
  { value: "digital_3c", label: "3C数码" },
];

export function StoryTheaterTopicAdmin() {
  const [rows, setRows] = useState<StoryTheaterTopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<StoryTheaterTopicRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [verticalFilter, setVerticalFilter] = useState<StoryTheaterVertical | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs =
        verticalFilter !== "all"
          ? `?vertical=${encodeURIComponent(verticalFilter)}`
          : "";
      const res = await fetch(`/api/admin/ecom/story-theater-topics/models${qs}`);
      const data = (await res.json()) as { topics?: StoryTheaterTopicRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setRows(data.topics ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [verticalFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const isEdit = form.id && rows.some((r) => r.id === form.id);
      const payload = {
        ...form,
        tags: form.tags ?? [],
      };
      const res = await fetch(
        isEdit
          ? `/api/admin/ecom/story-theater-topics/models/${encodeURIComponent(form.id)}`
          : "/api/admin/ecom/story-theater-topics/models",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: StoryTheaterTopicRow) {
    if (
      !confirmDestructiveTwice(
        `确定删除故事主题「${row.title}」？`,
        "此操作不可恢复，删除后助手将不再展示该选题。",
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/ecom/story-theater-topics/models/${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
    if (res.ok) await load();
  }

  return (
    <CatalogListShell
      title="故事主题库"
      loading={loading}
      error={error}
      onAdd={() =>
        setForm({
          id: "",
          vertical: verticalFilter !== "all" ? verticalFilter : "fashion_apparel",
          title: "",
          storyCore: "",
          storyType: "",
          tags: [],
          sortOrder: 0,
          enabled: true,
        })
      }
    >
      <div className="mb-2">
        <select
          className="rounded border px-2 py-1 text-xs"
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value as StoryTheaterVertical | "all")}
        >
          {STORY_THEATER_VERTICAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-[900px] w-full text-left text-xs">
          <thead className="bg-[#1d1d1f] text-white">
            <tr>
              <th className="px-2 py-2 align-top">ID</th>
              <th className="px-2 py-2 align-top">垂类</th>
              <th className="px-2 py-2 align-top">标题</th>
              <th className="px-2 py-2 align-top">故事核心</th>
              <th className="px-2 py-2 align-top">类型</th>
              <th className="px-2 py-2 align-top">标签</th>
              <th className="px-2 py-2 align-top">排序</th>
              <th className="px-2 py-2 align-top">启用</th>
              <th className="px-2 py-2 align-top">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2 font-mono">{r.id}</td>
                <td className="px-2 py-2">{r.vertical}</td>
                <td className="px-2 py-2">{r.title}</td>
                <td className="max-w-xs px-2 py-2 text-muted-foreground">{r.storyCore}</td>
                <td className="px-2 py-2">{r.storyType}</td>
                <td className="px-2 py-2 text-muted-foreground">
                  {r.tags?.length ? r.tags.join(", ") : "—"}
                </td>
                <td className="px-2 py-2">{r.sortOrder ?? 0}</td>
                <td className="px-2 py-2">{r.enabled !== false ? "是" : "否"}</td>
                <td className="px-2 py-2">
                  <button type="button" className="mr-2 text-[#0969da]" onClick={() => setForm(r)}>
                    编辑
                  </button>
                  <button type="button" className="text-red-600" onClick={() => void remove(r)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow">
            <h4 className="mb-3 font-semibold">
              {form.id && rows.some((r) => r.id === form.id) ? "编辑" : "新建"}故事主题
            </h4>
            <div className="space-y-2 text-xs">
              <input
                className="w-full rounded border px-2 py-1"
                placeholder="id"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
              />
              <select
                className="w-full rounded border px-2 py-1"
                value={form.vertical}
                onChange={(e) =>
                  setForm({ ...form, vertical: e.target.value as StoryTheaterVertical })
                }
              >
                <option value="fashion_apparel">服装 (fashion_apparel)</option>
                <option value="bags">包包 (bags)</option>
                <option value="digital_3c">3C数码 (digital_3c)</option>
              </select>
              <input
                className="w-full rounded border px-2 py-1"
                placeholder="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                className="min-h-[80px] w-full rounded border px-2 py-1"
                placeholder="storyCore"
                value={form.storyCore}
                onChange={(e) => setForm({ ...form, storyCore: e.target.value })}
              />
              <input
                className="w-full rounded border px-2 py-1"
                placeholder="storyType（如：痛点治愈、场景适配）"
                value={form.storyType}
                onChange={(e) => setForm({ ...form, storyType: e.target.value })}
              />
              <input
                className="w-full rounded border px-2 py-1"
                placeholder="tags 逗号分隔"
                value={form.tags?.join(", ") ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tags: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
              <input
                type="number"
                className="w-full rounded border px-2 py-1"
                placeholder="sortOrder"
                value={form.sortOrder ?? 0}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
                }
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.enabled !== false}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                启用
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1" onClick={() => setForm(null)}>
                取消
              </button>
              <button
                type="button"
                className="rounded bg-[#0969da] px-3 py-1 text-white"
                disabled={saving}
                onClick={() => void save()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CatalogListShell>
  );
}
