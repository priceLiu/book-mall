"use client";

import { useCallback, useEffect, useState } from "react";

import {
  confirmDestructiveTwice,
  CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
} from "@/lib/confirm-destructive-twice";

type PoseRow = {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  enabled?: boolean;
  sortOrder?: number;
};

type PropRow = {
  id: string;
  name: string;
  visualDescription: string;
  ossUrl?: string;
  enabled?: boolean;
  sortOrder?: number;
};

type SceneRow = {
  id: string;
  name: string;
  visualPrompt: string;
  enabled?: boolean;
  sortOrder?: number;
};

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
      !(await confirmDestructiveTwice({
        firstTitle: "删除姿势条目",
        firstMessage: `确定删除「${row.title}」？`,
        secondTitle: "不可恢复",
        secondMessage: CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
      }))
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
              <th className="px-2 py-2 align-top">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2">{r.id}</td>
                <td className="px-2 py-2">{r.name}</td>
                <td className="max-w-md px-2 py-2 text-muted-foreground">{r.visualDescription}</td>
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
      const res = await fetch(
        isEdit ? `/api/admin/ecom/scene-library/models/${encodeURIComponent(form.id)}` : "/api/admin/ecom/scene-library/models",
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
    <CatalogListShell title="场景库" loading={loading} error={error} onAdd={() => setForm({ id: "", name: "", visualPrompt: "", sortOrder: 0, enabled: true })}>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-[720px] w-full text-left text-xs">
          <thead className="bg-[#1d1d1f] text-white">
            <tr>
              <th className="px-2 py-2 align-top">ID</th>
              <th className="px-2 py-2 align-top">名称</th>
              <th className="px-2 py-2 align-top">visualPrompt</th>
              <th className="px-2 py-2 align-top">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2">{r.id}</td>
                <td className="px-2 py-2">{r.name}</td>
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
