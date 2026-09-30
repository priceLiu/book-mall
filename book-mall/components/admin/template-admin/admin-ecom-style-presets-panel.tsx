"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminMediaField } from "@/components/admin/template-admin/admin-media-field";
import { AdminMediaPasteProvider } from "@/components/admin/template-admin/admin-media-paste-context";
import { AdminMediaThumb } from "@/components/admin/template-admin/admin-media-thumb";

type PresetRow = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  layoutPrompt?: string;
  thumbUrl?: string;
  sortOrder: number;
  enabled?: boolean;
};

async function uploadPresetThumbFile(id: string, file: File): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  form.set("id", id);
  const res = await fetch("/api/admin/ecom/style-presets/upload", {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { error?: string; thumbUrl?: string };
  if (!res.ok) throw new Error(data.error ?? "上传失败");
  return data.thumbUrl ?? "";
}

export function AdminEcomStylePresetsPanel() {
  const [rows, setRows] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PresetRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [rows],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ecom/style-presets?kind=sellpoint_layout");
      const data = (await res.json()) as { presets?: PresetRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setRows(data.presets ?? []);
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

  async function saveEditing() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/ecom/style-presets/${encodeURIComponent(editing.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing.title,
          subtitle: editing.subtitle ?? null,
          layoutPrompt: editing.layoutPrompt ?? null,
          sortOrder: editing.sortOrder,
          enabled: editing.enabled !== false,
          thumbUrl: editing.thumbUrl ?? null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const uploadThumb = useCallback(
    async (file: File, id: string, opts?: { reload?: boolean }) => {
      const thumbUrl = await uploadPresetThumbFile(id, file);
      if (editing?.id === id && thumbUrl) {
        setEditing((prev) => (prev ? { ...prev, thumbUrl } : prev));
      }
      if (opts?.reload !== false) await load();
      return thumbUrl;
    },
    [editing, load],
  );

  async function batchUpload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setBatchNotice(null);
    try {
      const withoutThumb = sortedRows.filter((r) => !(r.thumbUrl ?? "").trim());
      const targets =
        withoutThumb.length >= files.length ? withoutThumb : sortedRows;
      const n = Math.min(files.length, targets.length);
      let ok = 0;
      for (let i = 0; i < n; i++) {
        await uploadThumb(files[i]!, targets[i]!.id, { reload: false });
        ok += 1;
      }
      await load();
      setBatchNotice(
        n < files.length
          ? `已上传 ${ok} 张（共 ${files.length} 张，仅匹配前 ${n} 条版式）`
          : `已上传 ${ok} 张版式缩略图`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AdminMediaPasteProvider>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">卖点图版式库</h2>
          <p className="mt-1 text-sm text-neutral-600">
            维护「AI 商品套图 · 选择卖点图版式」弹层中的缩略图与版式名称。图片上传至 OSS
            （ecom/style-presets/），前台只读 API 拉取。
          </p>
        </div>

        <AdminMediaField
          pasteFieldId="style-preset-batch"
          label="批量上传版式缩略图"
          accept="image"
          multiple
          disabled={uploading || loading}
          onFiles={(files) => void batchUpload(files)}
        />

        {batchNotice ? (
          <p className="rounded-md bg-[#ddf4ff] px-3 py-2 text-sm text-[#0969da]">{batchNotice}</p>
        ) : null}

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-neutral-500">加载中…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">缩略图</th>
                  <th className="px-3 py-2 font-medium">版式名</th>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">排序</th>
                  <th className="px-3 py-2 font-medium">启用</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">
                      <AdminMediaThumb
                        src={row.thumbUrl ?? ""}
                        title={row.title}
                        className="h-14 w-14"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-neutral-900">{row.title}</td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-500">{row.id}</td>
                    <td className="px-3 py-2">{row.sortOrder}</td>
                    <td className="px-3 py-2">{row.enabled === false ? "否" : "是"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => setEditing({ ...row, enabled: row.enabled !== false })}
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
              <h3 className="text-base font-semibold">编辑版式 · {editing.id}</h3>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-neutral-600">
                  版式名
                  <input
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium text-neutral-600">
                  副标题（可选）
                  <input
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    value={editing.subtitle ?? ""}
                    onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium text-neutral-600">
                  排序
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    value={editing.sortOrder}
                    onChange={(e) =>
                      setEditing({ ...editing, sortOrder: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.enabled !== false}
                    onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                  />
                  在前台展示
                </label>
                <label className="block text-xs font-medium text-neutral-600">
                  生成用 layoutPrompt
                  <textarea
                    className="mt-1 h-28 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    value={editing.layoutPrompt ?? ""}
                    onChange={(e) => setEditing({ ...editing, layoutPrompt: e.target.value })}
                  />
                </label>
                <AdminMediaField
                  pasteFieldId="style-preset-thumb"
                  label="版式示意图（OSS）"
                  url={editing.thumbUrl ?? ""}
                  accept="image"
                  disabled={uploading}
                  onUrlChange={(url) => setEditing({ ...editing, thumbUrl: url })}
                  onFiles={(files) => {
                    const f = files[0];
                    if (!f) return;
                    setUploading(true);
                    void uploadThumb(f, editing.id)
                      .catch((e) => setError(e instanceof Error ? e.message : "上传失败"))
                      .finally(() => setUploading(false));
                  }}
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                  onClick={() => setEditing(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  disabled={saving}
                  onClick={() => void saveEditing()}
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminMediaPasteProvider>
  );
}
