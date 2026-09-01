"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  createEcomPoseLibraryEntry,
  deleteEcomPoseLibraryEntry,
  fetchEcomPoseLibraryCatalog,
  updateEcomPoseLibraryEntry,
} from "@/lib/ecom-pose-library-api";
import type { EcomPoseLibraryEntry } from "@/lib/ecom-pose-library/types";
import {
  createEcomPropLibraryEntry,
  deleteEcomPropLibraryEntry,
  fetchEcomPropLibraryCatalog,
  updateEcomPropLibraryEntry,
} from "@/lib/ecom-prop-library-api";
import type { EcomPropLibraryEntry } from "@/lib/ecom-prop-library/types";
import {
  ECOM_SCENE_ARCHETYPE_OPTIONS,
  resolveSceneArchetypeFromTags,
} from "@/lib/ecom-scene-archetypes";
import {
  createEcomSceneLibraryEntry,
  deleteEcomSceneLibraryEntry,
  fetchEcomSceneLibraryCatalog,
  updateEcomSceneLibraryEntry,
} from "@/lib/ecom-scene-library-api";
import type { EcomSceneLibraryEntry } from "@/lib/ecom-scene-library/types";
import { cn } from "@/lib/utils";

type Tab = "scene" | "prop" | "pose";

const POSE_CATEGORIES = ["A", "B", "C", "D", "E", "H", "I", "J", "K", "L", "M"];

function LockedBadge({ lockedAt }: { lockedAt?: string | null }) {
  if (!lockedAt) return null;
  return (
    <span
      className="ml-1 rounded bg-[#fff3cd] px-1.5 py-0.5 text-[10px] text-[#856404]"
      title="已被项目引用并确认/出图，不可编辑或删除"
    >
      已锁定
    </span>
  );
}

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

export function ShootCatalogPanel() {
  const { alert, doubleConfirm } = useDialogs();
  const [tab, setTab] = useState<Tab>("scene");
  const [loading, setLoading] = useState(true);
  const [scenes, setScenes] = useState<{ platform: EcomSceneLibraryEntry[]; user: EcomSceneLibraryEntry[] }>({
    platform: [],
    user: [],
  });
  const [props, setProps] = useState<{ platform: EcomPropLibraryEntry[]; user: EcomPropLibraryEntry[] }>({
    platform: [],
    user: [],
  });
  const [poses, setPoses] = useState<{ platform: EcomPoseLibraryEntry[]; user: EcomPoseLibraryEntry[] }>({
    platform: [],
    user: [],
  });
  const [sceneForm, setSceneForm] = useState<{
    id?: string;
    name: string;
    visualPrompt: string;
    archetype: string;
  } | null>(null);
  const [propForm, setPropForm] = useState<{ id?: string; name: string; visualDescription: string } | null>(
    null,
  );
  const [poseForm, setPoseForm] = useState<{
    id?: string;
    category: string;
    title: string;
    baseDescription: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sceneCat, propCat, poseCat] = await Promise.all([
        fetchEcomSceneLibraryCatalog(),
        fetchEcomPropLibraryCatalog(),
        fetchEcomPoseLibraryCatalog(),
      ]);
      setScenes({
        platform: sceneCat.platform ?? sceneCat.scenes.filter((s) => (s.scope ?? "platform") === "platform"),
        user: sceneCat.user ?? sceneCat.scenes.filter((s) => s.scope === "user"),
      });
      setProps({
        platform: propCat.platform ?? propCat.props.filter((p) => (p.scope ?? "platform") === "platform"),
        user: propCat.user ?? propCat.props.filter((p) => p.scope === "user"),
      });
      setPoses({
        platform: poseCat.platform ?? poseCat.poses.filter((p) => (p.scope ?? "platform") === "platform"),
        user: poseCat.user ?? poseCat.poses.filter((p) => p.scope === "user"),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tabLabels = useMemo(
    () =>
      ({
        scene: "场景",
        prop: "道具",
        pose: "姿势",
      }) as const,
    [],
  );

  async function saveScene() {
    if (!sceneForm?.name.trim() || !sceneForm.visualPrompt.trim() || !sceneForm.archetype) {
      await alert({ title: "请填写完整", message: "名称、提示词与场景类型均为必填。", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      if (sceneForm.id) {
        await updateEcomSceneLibraryEntry(sceneForm.id, {
          name: sceneForm.name.trim(),
          visualPrompt: sceneForm.visualPrompt.trim(),
          archetype: sceneForm.archetype,
        });
      } else {
        await createEcomSceneLibraryEntry({
          name: sceneForm.name.trim(),
          visualPrompt: sceneForm.visualPrompt.trim(),
          archetype: sceneForm.archetype,
        });
      }
      setSceneForm(null);
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

  async function saveProp() {
    if (!propForm?.name.trim() || !propForm.visualDescription.trim()) {
      await alert({ title: "请填写完整", message: "名称与描述均为必填。", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      if (propForm.id) {
        await updateEcomPropLibraryEntry(propForm.id, {
          name: propForm.name.trim(),
          visualDescription: propForm.visualDescription.trim(),
        });
      } else {
        await createEcomPropLibraryEntry({
          name: propForm.name.trim(),
          visualDescription: propForm.visualDescription.trim(),
        });
      }
      setPropForm(null);
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

  async function savePose() {
    if (!poseForm?.title.trim() || !poseForm.baseDescription.trim() || !poseForm.category) {
      await alert({ title: "请填写完整", message: "分类、标题与描述均为必填。", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      if (poseForm.id) {
        await updateEcomPoseLibraryEntry(poseForm.id, {
          category: poseForm.category,
          title: poseForm.title.trim(),
          baseDescription: poseForm.baseDescription.trim(),
        });
      } else {
        await createEcomPoseLibraryEntry({
          category: poseForm.category,
          title: poseForm.title.trim(),
          baseDescription: poseForm.baseDescription.trim(),
        });
      }
      setPoseForm(null);
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

  async function removeUserScene(entry: EcomSceneLibraryEntry) {
    if (entry.lockedAt) return;
    if (
      !(await doubleConfirm({
        firstTitle: "删除场景条目",
        firstMessage: `确定删除「${entry.name}」？`,
        secondTitle: "不可恢复",
        secondMessage: "删除后无法恢复；若曾被项目引用，相关计划仍保留当时文案。",
      }))
    ) {
      return;
    }
    try {
      await deleteEcomSceneLibraryEntry(entry.id);
      await reload();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "删除失败",
        variant: "error",
      });
    }
  }

  async function removeUserProp(entry: EcomPropLibraryEntry) {
    if (entry.lockedAt) return;
    if (
      !(await doubleConfirm({
        firstTitle: "删除道具条目",
        firstMessage: `确定删除「${entry.name}」？`,
        secondTitle: "不可恢复",
        secondMessage: "删除后无法恢复。",
      }))
    ) {
      return;
    }
    try {
      await deleteEcomPropLibraryEntry(entry.id);
      await reload();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "删除失败",
        variant: "error",
      });
    }
  }

  async function removeUserPose(entry: EcomPoseLibraryEntry) {
    if (entry.lockedAt) return;
    if (
      !(await doubleConfirm({
        firstTitle: "删除姿势条目",
        firstMessage: `确定删除「${entry.title}」？`,
        secondTitle: "不可恢复",
        secondMessage: "删除后无法恢复。",
      }))
    ) {
      return;
    }
    try {
      await deleteEcomPoseLibraryEntry(entry.id);
      await reload();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "删除失败",
        variant: "error",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[#e8e8ed] pb-3">
        {(["scene", "prop", "pose"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition",
              tab === t ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#424245] hover:bg-[#e8e8ed]",
            )}
            onClick={() => setTab(t)}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-[#86868b]">加载中…</p> : null}

      {tab === "scene" ? (
        <div className="space-y-6">
          <CatalogSection title="系统推荐（只读）">
            <div className="overflow-x-auto rounded-xl border border-[#e5e5ea]">
              <table className="min-w-[640px] w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#1d1d1f] text-white">
                    <th className="px-3 py-2">名称</th>
                    <th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">visualPrompt</th>
                  </tr>
                </thead>
                <tbody>
                  {scenes.platform.map((s) => (
                    <tr key={s.id} className="border-t border-[#e5e5ea]">
                      <td className="px-3 py-2 text-[#1d1d1f]">{s.name}</td>
                      <td className="px-3 py-2 text-[#424245]">
                        {ECOM_SCENE_ARCHETYPE_OPTIONS.find(
                          (o) => o.value === resolveSceneArchetypeFromTags(s.tags),
                        )?.label ?? "—"}
                      </td>
                      <td className="max-w-md px-3 py-2 text-[#6e6e73]">{s.visualPrompt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CatalogSection>

          <CatalogSection title="我的场景">
            <div className="mb-2 flex justify-end">
              <EcomButtonSecondary
                type="button"
                onClick={() => setSceneForm({ name: "", visualPrompt: "", archetype: "studio" })}
              >
                新建场景
              </EcomButtonSecondary>
            </div>
            {scenes.user.length === 0 ? (
              <p className="text-xs text-[#86868b]">暂无自建场景。新建后可在姿势表与助手中点选。</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#e5e5ea]">
                <table className="min-w-[640px] w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#1d1d1f] text-white">
                      <th className="px-3 py-2">名称</th>
                      <th className="px-3 py-2">类型</th>
                      <th className="px-3 py-2">visualPrompt</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenes.user.map((s) => (
                      <tr key={s.id} className="border-t border-[#e5e5ea]">
                        <td className="px-3 py-2">
                          {s.name}
                          <LockedBadge lockedAt={s.lockedAt} />
                        </td>
                        <td className="px-3 py-2">
                          {ECOM_SCENE_ARCHETYPE_OPTIONS.find(
                            (o) => o.value === resolveSceneArchetypeFromTags(s.tags),
                          )?.label ?? "—"}
                        </td>
                        <td className="max-w-md px-3 py-2 text-[#6e6e73]">{s.visualPrompt}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="mr-2 text-[#0071e3] disabled:opacity-40"
                            disabled={!!s.lockedAt}
                            title={s.lockedAt ? "已锁定" : undefined}
                            onClick={() =>
                              setSceneForm({
                                id: s.id,
                                name: s.name,
                                visualPrompt: s.visualPrompt,
                                archetype: resolveSceneArchetypeFromTags(s.tags) || "studio",
                              })
                            }
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="text-red-600 disabled:opacity-40"
                            disabled={!!s.lockedAt}
                            onClick={() => void removeUserScene(s)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CatalogSection>
        </div>
      ) : null}

      {tab === "prop" ? (
        <div className="space-y-6">
          <CatalogSection title="系统推荐（只读）">
            <div className="overflow-x-auto rounded-xl border border-[#e5e5ea]">
              <table className="min-w-[640px] w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#1d1d1f] text-white">
                    <th className="px-3 py-2">名称</th>
                    <th className="px-3 py-2">描述</th>
                    <th className="px-3 py-2">冲突标签</th>
                  </tr>
                </thead>
                <tbody>
                  {props.platform.map((p) => (
                    <tr key={p.id} className="border-t border-[#e5e5ea]">
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="max-w-md px-3 py-2 text-[#6e6e73]">{p.visualDescription}</td>
                      <td className="px-3 py-2 text-[#86868b]">
                        {p.conflictTags?.length ? p.conflictTags.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CatalogSection>

          <CatalogSection title="我的道具">
            <div className="mb-2 flex justify-end">
              <EcomButtonSecondary
                type="button"
                onClick={() => setPropForm({ name: "", visualDescription: "" })}
              >
                新建道具
              </EcomButtonSecondary>
            </div>
            {props.user.length === 0 ? (
              <p className="text-xs text-[#86868b]">暂无自建道具。可在姿势计划表中点选填写。</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#e5e5ea]">
                <table className="min-w-[640px] w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#1d1d1f] text-white">
                      <th className="px-3 py-2">名称</th>
                      <th className="px-3 py-2">描述</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.user.map((p) => (
                      <tr key={p.id} className="border-t border-[#e5e5ea]">
                        <td className="px-3 py-2">
                          {p.name}
                          <LockedBadge lockedAt={p.lockedAt} />
                        </td>
                        <td className="max-w-md px-3 py-2 text-[#6e6e73]">{p.visualDescription}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="mr-2 text-[#0071e3] disabled:opacity-40"
                            disabled={!!p.lockedAt}
                            onClick={() =>
                              setPropForm({
                                id: p.id,
                                name: p.name,
                                visualDescription: p.visualDescription,
                              })
                            }
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="text-red-600 disabled:opacity-40"
                            disabled={!!p.lockedAt}
                            onClick={() => void removeUserProp(p)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CatalogSection>
        </div>
      ) : null}

      {tab === "pose" ? (
        <div className="space-y-6">
          <p className="text-xs text-[#86868b]">
            系统姿势参与助手自动编排；自建姿势仅供姿势表内手动替换，不会进入自动抽取池。
          </p>
          <CatalogSection title="系统推荐（只读）">
            <div className="overflow-x-auto rounded-xl border border-[#e5e5ea]">
              <table className="min-w-[640px] w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#1d1d1f] text-white">
                    <th className="px-3 py-2">类</th>
                    <th className="px-3 py-2">标题</th>
                    <th className="px-3 py-2">baseDescription</th>
                  </tr>
                </thead>
                <tbody>
                  {poses.platform.map((p) => (
                    <tr key={p.id} className="border-t border-[#e5e5ea]">
                      <td className="px-3 py-2">{p.category}</td>
                      <td className="px-3 py-2">{p.title}</td>
                      <td className="max-w-md px-3 py-2 text-[#6e6e73]">{p.baseDescription}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CatalogSection>

          <CatalogSection title="我的姿势">
            <div className="mb-2 flex justify-end">
              <EcomButtonSecondary
                type="button"
                onClick={() =>
                  setPoseForm({ category: "A", title: "", baseDescription: "" })
                }
              >
                新建姿势
              </EcomButtonSecondary>
            </div>
            {poses.user.length === 0 ? (
              <p className="text-xs text-[#86868b]">暂无自建姿势。</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#e5e5ea]">
                <table className="min-w-[640px] w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#1d1d1f] text-white">
                      <th className="px-3 py-2">类</th>
                      <th className="px-3 py-2">标题</th>
                      <th className="px-3 py-2">描述</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poses.user.map((p) => (
                      <tr key={p.id} className="border-t border-[#e5e5ea]">
                        <td className="px-3 py-2">{p.category}</td>
                        <td className="px-3 py-2">
                          {p.title}
                          <LockedBadge lockedAt={p.lockedAt} />
                        </td>
                        <td className="max-w-md px-3 py-2 text-[#6e6e73]">{p.baseDescription}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="mr-2 text-[#0071e3] disabled:opacity-40"
                            disabled={!!p.lockedAt}
                            onClick={() =>
                              setPoseForm({
                                id: p.id,
                                category: p.category,
                                title: p.title,
                                baseDescription: p.baseDescription,
                              })
                            }
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="text-red-600 disabled:opacity-40"
                            disabled={!!p.lockedAt}
                            onClick={() => void removeUserPose(p)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CatalogSection>
        </div>
      ) : null}

      {sceneForm ? (
        <FormModal title={sceneForm.id ? "编辑场景" : "新建场景"} onClose={() => setSceneForm(null)}>
          <label className="block space-y-1 text-xs">
            <span className="text-[#86868b]">名称</span>
            <input
              className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2"
              value={sceneForm.name}
              onChange={(e) => setSceneForm({ ...sceneForm, name: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-[#86868b]">场景类型（用于姿势匹配）</span>
            <select
              className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2"
              value={sceneForm.archetype}
              onChange={(e) => setSceneForm({ ...sceneForm, archetype: e.target.value })}
            >
              {ECOM_SCENE_ARCHETYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-[#86868b]">visualPrompt</span>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-[#d2d2d7] px-3 py-2"
              value={sceneForm.visualPrompt}
              onChange={(e) => setSceneForm({ ...sceneForm, visualPrompt: e.target.value })}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <EcomButtonSecondary type="button" onClick={() => setSceneForm(null)}>
              取消
            </EcomButtonSecondary>
            <EcomButtonPrimary type="button" disabled={saving} onClick={() => void saveScene()}>
              保存
            </EcomButtonPrimary>
          </div>
        </FormModal>
      ) : null}

      {propForm ? (
        <FormModal title={propForm.id ? "编辑道具" : "新建道具"} onClose={() => setPropForm(null)}>
          <label className="block space-y-1 text-xs">
            <span className="text-[#86868b]">名称</span>
            <input
              className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2"
              value={propForm.name}
              onChange={(e) => setPropForm({ ...propForm, name: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-[#86868b]">visualDescription</span>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-[#d2d2d7] px-3 py-2"
              value={propForm.visualDescription}
              onChange={(e) => setPropForm({ ...propForm, visualDescription: e.target.value })}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <EcomButtonSecondary type="button" onClick={() => setPropForm(null)}>
              取消
            </EcomButtonSecondary>
            <EcomButtonPrimary type="button" disabled={saving} onClick={() => void saveProp()}>
              保存
            </EcomButtonPrimary>
          </div>
        </FormModal>
      ) : null}

      {poseForm ? (
        <FormModal title={poseForm.id ? "编辑姿势" : "新建姿势"} onClose={() => setPoseForm(null)}>
          <label className="block space-y-1 text-xs">
            <span className="text-[#86868b]">分类</span>
            <select
              className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2"
              value={poseForm.category}
              onChange={(e) => setPoseForm({ ...poseForm, category: e.target.value })}
            >
              {POSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-[#86868b]">标题</span>
            <input
              className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2"
              value={poseForm.title}
              onChange={(e) => setPoseForm({ ...poseForm, title: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-[#86868b]">baseDescription</span>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-[#d2d2d7] px-3 py-2"
              value={poseForm.baseDescription}
              onChange={(e) => setPoseForm({ ...poseForm, baseDescription: e.target.value })}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <EcomButtonSecondary type="button" onClick={() => setPoseForm(null)}>
              取消
            </EcomButtonSecondary>
            <EcomButtonPrimary type="button" disabled={saving} onClick={() => void savePose()}>
              保存
            </EcomButtonPrimary>
          </div>
        </FormModal>
      ) : null}
    </div>
  );
}

function FormModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-[#1d1d1f]">{title}</h3>
        {children}
        <button type="button" className="sr-only" onClick={onClose}>
          close
        </button>
      </div>
    </div>
  );
}
