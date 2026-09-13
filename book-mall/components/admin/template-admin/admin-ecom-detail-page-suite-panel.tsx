"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { confirmDestructiveTwice } from "@/lib/confirm-destructive-twice";

type ModuleDef = {
  module_id: string;
  module_name: string;
  required: boolean;
  max_num: number;
  candidate_pool: string[];
};

type TemplateRow = {
  id: string;
  platformCode: string;
  categoryKey: string;
  templateName: string;
  categoryLabel: string;
  type: "system" | "user";
  status: "enable" | "disable";
  remark: string | null;
  modules: ModuleDef[];
};

const PLATFORMS = [
  { code: "", label: "全部平台" },
  { code: "taobao-tmall", label: "淘宝/天猫" },
  { code: "jd", label: "京东" },
  { code: "pdd", label: "拼多多" },
  { code: "douyin", label: "抖音电商" },
  { code: "kuaishou", label: "快手小店" },
  { code: "xiaohongshu", label: "小红书商城" },
  { code: "wechat-channels", label: "视频号小店" },
  { code: "1688", label: "1688" },
  { code: "vip", label: "唯品会" },
  { code: "amazon", label: "亚马逊" },
  { code: "shopee-lazada", label: "Shopee/Lazada" },
  { code: "independent", label: "独立站" },
];

export function AdminEcomDetailPageSuitePanel() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformCode, setPlatformCode] = useState("");
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = platformCode
        ? `?platformCode=${encodeURIComponent(platformCode)}`
        : "";
      const res = await fetch(`/api/admin/ecom/detail-page-suite/templates${qs}`);
      const data = (await res.json()) as { items?: TemplateRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setRows(data.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [platformCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalMax = useMemo(() => {
    if (!editing) return 0;
    return editing.modules.reduce((n, m) => n + (Number(m.max_num) || 0), 0);
  }, [editing]);

  async function copyRow(row: TemplateRow) {
    const res = await fetch("/api/admin/ecom/detail-page-suite/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "copy",
        sourceId: row.id,
        templateName: `${row.templateName} 副本`,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "复制失败");
      return;
    }
    await load();
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/ecom/detail-page-suite/templates/${encodeURIComponent(editing.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: editing.templateName,
            status: editing.status,
            remark: editing.remark,
            modules: editing.modules,
          }),
        },
      );
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

  async function remove(row: TemplateRow) {
    if (row.type === "system") return;
    if (
      !confirmDestructiveTwice(
        `从模板列表删除「${row.templateName}」？`,
        "此操作不可恢复。历史任务不受影响，但无法再新建任务选用该模板。",
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/admin/ecom/detail-page-suite/templates/${encodeURIComponent(row.id)}`,
      { method: "DELETE" },
    );
    if (res.ok) await load();
  }

  function exportJson(row: TemplateRow) {
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.platformCode}-${row.categoryKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    const text = await file.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      setError("JSON解析失败，模板结构不符合规范，请检查文件");
      return;
    }
    const res = await fetch("/api/admin/ecom/detail-page-suite/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import", payload }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "导入失败");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-[#1f2328]">详情页套图模板</h3>
        <select
          className="rounded-md border border-[#d0d7de] px-2 py-1 text-xs"
          value={platformCode}
          onChange={(e) => setPlatformCode(e.target.value)}
        >
          {PLATFORMS.map((p) => (
            <option key={p.code || "all"} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="rounded-md border border-[#d0d7de] px-2 py-1 text-xs">
          导入 JSON
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-[#656d76]">{rows.length} 条</span>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-xs text-[#656d76]">加载中…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#d0d7de]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f8fa] text-[#656d76]">
              <tr>
                <th className="px-3 py-2">名称</th>
                <th className="px-3 py-2">平台</th>
                <th className="px-3 py-2">类目</th>
                <th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">模块/张数</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sum = row.modules.reduce((n, m) => n + m.max_num, 0);
                return (
                  <tr key={row.id} className="border-t border-[#d0d7de]">
                    <td className="px-3 py-2">{row.templateName}</td>
                    <td className="px-3 py-2">{row.platformCode}</td>
                    <td className="px-3 py-2">{row.categoryLabel}</td>
                    <td className="px-3 py-2">{row.type === "system" ? "系统" : "自定义"}</td>
                    <td className="px-3 py-2">{row.status === "enable" ? "启用" : "禁用"}</td>
                    <td className="px-3 py-2">
                      {row.modules.length} / {sum}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-[#d0d7de] px-2 py-0.5"
                          onClick={() => setEditing(structuredClone(row))}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="rounded border border-[#d0d7de] px-2 py-0.5"
                          onClick={() => void copyRow(row)}
                        >
                          复制
                        </button>
                        <button
                          type="button"
                          className="rounded border border-[#d0d7de] px-2 py-0.5"
                          onClick={() => exportJson(row)}
                        >
                          导出
                        </button>
                        {row.type === "user" ? (
                          <button
                            type="button"
                            className="rounded border border-[#d0d7de] px-2 py-0.5 text-red-600"
                            onClick={() => void remove(row)}
                          >
                            删除
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <div className="space-y-3 rounded-md border border-[#d0d7de] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              编辑 {editing.templateName}
              <span className="ml-2 text-xs font-normal text-[#656d76]">
                合计 max {totalMax}（全局上限 44）
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-[#d0d7de] px-3 py-1 text-xs"
                onClick={() => setEditing(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-md bg-[#1f2328] px-3 py-1 text-xs text-white disabled:opacity-50"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
          <label className="block text-xs">
            名称
            <input
              className="mt-1 w-full rounded-md border border-[#d0d7de] px-2 py-1"
              value={editing.templateName}
              onChange={(e) => setEditing({ ...editing, templateName: e.target.value })}
            />
          </label>
          <label className="block text-xs">
            状态
            <select
              className="mt-1 rounded-md border border-[#d0d7de] px-2 py-1"
              value={editing.status}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  status: e.target.value === "disable" ? "disable" : "enable",
                })
              }
            >
              <option value="enable">启用</option>
              <option value="disable">禁用</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded-md border border-[#d0d7de] px-3 py-1 text-xs"
            onClick={() => {
              const id = `mod_custom_${Date.now()}`;
              setEditing({
                ...editing,
                modules: [
                  ...editing.modules,
                  {
                    module_id: id,
                    module_name: "自定义模块",
                    required: false,
                    max_num: 1,
                    candidate_pool: ["主视觉"],
                  },
                ],
              });
            }}
          >
            + 大模块
          </button>
          {editing.modules.map((mod, mi) => (
            <div key={mod.module_id} className="rounded border border-[#eaeef2] p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  className="rounded border border-[#d0d7de] px-2 py-0.5 font-medium"
                  value={mod.module_name}
                  onChange={(e) => {
                    const modules = editing.modules.map((m, i) =>
                      i === mi ? { ...m, module_name: e.target.value } : m,
                    );
                    setEditing({ ...editing, modules });
                  }}
                />
                <span className="text-[#656d76]">{mod.module_id}</span>
                <label className="text-xs">
                  max_num
                  <input
                    type="number"
                    min={1}
                    className="ml-1 w-16 rounded border border-[#d0d7de] px-1 py-0.5"
                    value={mod.max_num}
                    onChange={(e) => {
                      const modules = editing.modules.map((m, i) =>
                        i === mi ? { ...m, max_num: Number(e.target.value) || 1 } : m,
                      );
                      setEditing({ ...editing, modules });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => {
                    setEditing({
                      ...editing,
                      modules: editing.modules.filter((_, i) => i !== mi),
                    });
                  }}
                >
                  删除模块
                </button>
                <button
                  type="button"
                  className="text-xs text-[#0969da]"
                  onClick={() => {
                    const modules = editing.modules.map((m, i) =>
                      i === mi
                        ? { ...m, candidate_pool: [...m.candidate_pool, ""] }
                        : m,
                    );
                    setEditing({ ...editing, modules });
                  }}
                >
                  + 子维度
                </button>
              </div>
              <div className="space-y-1">
                {mod.candidate_pool.map((item, ii) => (
                  <div key={`${mod.module_id}-${ii}`} className="flex gap-1">
                    <input
                      className="flex-1 rounded border border-[#d0d7de] px-2 py-1 text-xs"
                      value={item}
                      onChange={(e) => {
                        const modules = editing.modules.map((m, i) => {
                          if (i !== mi) return m;
                          const pool = m.candidate_pool.map((p, j) =>
                            j === ii ? e.target.value : p,
                          );
                          return { ...m, candidate_pool: pool };
                        });
                        setEditing({ ...editing, modules });
                      }}
                    />
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => {
                        const modules = editing.modules.map((m, i) =>
                          i === mi
                            ? {
                                ...m,
                                candidate_pool: m.candidate_pool.filter((_, j) => j !== ii),
                              }
                            : m,
                        );
                        setEditing({ ...editing, modules });
                      }}
                    >
                      删
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
