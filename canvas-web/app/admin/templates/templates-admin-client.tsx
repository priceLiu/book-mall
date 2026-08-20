"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, ShieldOff, ToggleLeft, ToggleRight } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";
import {
  listAdminPro2TemplatePacks,
  listAdminPro2Templates,
  patchAdminPro2Template,
  patchAdminPro2TemplatePack,
} from "@/lib/canvas-api";
import type {
  Pro2PromptBlock,
  Pro2PromptTemplatePassKind,
  Pro2PromptTemplateRecord,
  Pro2TemplatePackRecord,
} from "@/lib/canvas/pro2-prompt-template-types";
import { resolvePro2ScriptPromptFromBlocks } from "@/lib/canvas/pro2-prompt-template-types";
import { validatePro2TemplateBlocksForSave } from "@/lib/canvas/pro2-template-admin-validate";
import { cn } from "@/lib/utils";

type AdminTab = "packs" | "script" | "asset";

const SCRIPT_PASS_LABELS: Record<
  Extract<
    Pro2PromptTemplatePassKind,
    "OUTLINE" | "CHARACTER" | "SCENE" | "STORYBOARD"
  >,
  string
> = {
  OUTLINE: "大纲",
  CHARACTER: "角色",
  SCENE: "场景",
  STORYBOARD: "分镜",
};

const ASSET_PASS_LABELS: Record<
  Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
  string
> = {
  CHARACTER_FOUR_VIEW: "角色四视图",
  SCENE_FOUR_PANORAMA: "场景四全景",
  PROP_SIX_VIEW: "道具六视图",
};

const SCRIPT_PASS_ORDER: Extract<
  Pro2PromptTemplatePassKind,
  "OUTLINE" | "CHARACTER" | "SCENE" | "STORYBOARD"
>[] = ["OUTLINE", "CHARACTER", "SCENE", "STORYBOARD"];

const ASSET_PASS_ORDER: Extract<
  Pro2PromptTemplatePassKind,
  "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
>[] = ["CHARACTER_FOUR_VIEW", "SCENE_FOUR_PANORAMA", "PROP_SIX_VIEW"];

const PACK_DISPLAY_ORDER = ["default-master", "gu-feng-tian-chong"] as const;

type PassKindGroup<T extends Pro2PromptTemplatePassKind> = {
  passKind: T;
  label: string;
  items: Pro2PromptTemplateRecord[];
};

type ScriptPackGroup = {
  packKey: string;
  packName: string;
  packEnabled: boolean;
  passGroups: PassKindGroup<
    Extract<Pro2PromptTemplatePassKind, "OUTLINE" | "CHARACTER" | "SCENE" | "STORYBOARD">
  >[];
};

function templateForScriptPass(
  pack: Pro2TemplatePackRecord,
  passKind: Extract<
    Pro2PromptTemplatePassKind,
    "OUTLINE" | "CHARACTER" | "SCENE" | "STORYBOARD"
  >,
): Pro2PromptTemplateRecord | undefined {
  switch (passKind) {
    case "OUTLINE":
      return pack.outlineTemplate;
    case "CHARACTER":
      return pack.characterTemplate;
    case "SCENE":
      return pack.sceneTemplate;
    case "STORYBOARD":
      return pack.storyboardTemplate;
    default:
      return undefined;
  }
}

function groupScriptTemplatesByPack(
  packs: Pro2TemplatePackRecord[],
): ScriptPackGroup[] {
  const sorted = [...packs].sort((a, b) => {
    const ai = PACK_DISPLAY_ORDER.indexOf(a.packKey as (typeof PACK_DISPLAY_ORDER)[number]);
    const bi = PACK_DISPLAY_ORDER.indexOf(b.packKey as (typeof PACK_DISPLAY_ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return sorted.map((pack) => ({
    packKey: pack.packKey,
    packName: pack.name,
    packEnabled: pack.enabled,
    passGroups: SCRIPT_PASS_ORDER.map((passKind) => ({
      passKind,
      label: SCRIPT_PASS_LABELS[passKind],
      items: (() => {
        const tpl = templateForScriptPass(pack, passKind);
        return tpl ? [tpl] : [];
      })(),
    })).filter((g) => g.items.length > 0),
  }));
}

function groupTemplatesByPassKind<T extends Pro2PromptTemplatePassKind>(
  templates: Pro2PromptTemplateRecord[],
  order: readonly T[],
  labels: Record<T, string>,
): PassKindGroup<T>[] {
  return order
    .map((passKind) => ({
      passKind,
      label: labels[passKind],
      items: templates.filter((t) => t.passKind === passKind),
    }))
    .filter((g) => g.items.length > 0);
}

function PackSetSection({
  title,
  subtitle,
  enabled,
  passGroups,
  selectedTemplateId,
  onSelectTemplate,
  onToggleTemplateEnabled,
}: {
  title: string;
  subtitle?: string;
  enabled?: boolean;
  passGroups: PassKindGroup<Pro2PromptTemplatePassKind>[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onToggleTemplateEnabled: (tpl: Pro2PromptTemplateRecord) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle ? <p className="text-xs text-white/45">{subtitle}</p> : null}
        </div>
        {enabled != null ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              enabled
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-white/10 text-white/40",
            )}
          >
            {enabled ? "模板包已启用" : "模板包已停用"}
          </span>
        ) : null}
      </div>
      <div className="space-y-4 p-3">
        {passGroups.map((group) => (
          <div key={group.passKind} className="space-y-2">
            <h3 className="text-xs font-medium text-white/50">{group.label}</h3>
            <div className="space-y-2">
              {group.items.map((tpl) => (
                <TemplateListRow
                  key={tpl.id}
                  tpl={tpl}
                  selected={selectedTemplateId === tpl.id}
                  onSelect={() => onSelectTemplate(tpl.id)}
                  onToggleEnabled={() => onToggleTemplateEnabled(tpl)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TemplateListRow({
  tpl,
  selected,
  onSelect,
  onToggleEnabled,
}: {
  tpl: Pro2PromptTemplateRecord;
  selected: boolean;
  onSelect: () => void;
  onToggleEnabled: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition",
        selected
          ? "border-[var(--canvas-accent)]/50 bg-[var(--canvas-accent)]/10"
          : "border-white/10 bg-black/30 hover:bg-black/40",
      )}
    >
      <div>
        <div className="font-medium text-white">{tpl.name}</div>
        <div className="text-xs text-white/50">
          {tpl.templateKey} · v{tpl.version}
          {tpl.enabled ? " · 已启用" : " · 已停用"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Pencil className="size-3.5 text-white/40" />
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleEnabled();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onToggleEnabled();
            }
          }}
          className="text-white/70"
          aria-label={tpl.enabled ? "停用" : "启用"}
        >
          {tpl.enabled ? (
            <ToggleRight className="size-5 text-emerald-400" />
          ) : (
            <ToggleLeft className="size-5" />
          )}
        </span>
      </div>
    </button>
  );
}

function BlockEditor({
  blocks,
  onChange,
  onSave,
  saving,
}: {
  blocks: Pro2PromptBlock[];
  onChange: (blocks: Pro2PromptBlock[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { confirm } = useDialogs();
  const [unlockedBlockIds, setUnlockedBlockIds] = useState<Set<string>>(() => new Set());

  const updateBlock = async (index: number, content: string) => {
    const block = blocks[index];
    if (block.locked && !unlockedBlockIds.has(block.id)) {
      const ok = await confirm({
        title: "编辑平台锁定块",
        message: `「${block.label}」为平台锁定内容，修改将影响全站 Pro2 生图/LLM 行为，且不可轻易回滚。`,
        confirmLabel: "确认修改",
        danger: true,
      });
      if (!ok) return;
      setUnlockedBlockIds((prev) => new Set(prev).add(block.id));
    }
    const next = [...blocks];
    next[index] = { ...block, content };
    onChange(next);
  };

  const isLargeBlock = (block: Pro2PromptBlock) =>
    block.id === "prompt_body" || block.id === "composition_spec";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-2">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            className="flex flex-col rounded-lg border border-white/10 bg-black/30 p-3"
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <span className="text-sm font-medium text-white">
                {block.label}
                <span className="ml-2 text-xs text-white/50">({block.source})</span>
              </span>
              {block.locked ? (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                  平台锁定
                </span>
              ) : null}
            </div>
            <textarea
              value={block.content}
              onChange={(e) => void updateBlock(index, e.target.value)}
              className={cn(
                "w-full resize-y rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs leading-relaxed text-white/90",
                isLargeBlock(block) ? "min-h-[320px]" : "min-h-[88px]",
              )}
            />
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-white/10 bg-black/15 pt-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--canvas-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          保存块内容
        </button>
      </div>
    </div>
  );
}

function AdminEditorPane({
  title,
  subtitle,
  children,
  empty,
}: {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  empty?: string;
}) {
  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black/15">
      {title ? (
        <div className="shrink-0 border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-white/50">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
        {children ?? (
          <p className="text-sm text-white/50">{empty ?? "选择左侧项目进行编辑"}</p>
        )}
      </div>
    </aside>
  );
}

function AdminSplitLayout({
  list,
  editor,
}: {
  list: React.ReactNode;
  editor: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="w-[min(420px,36vw)] shrink-0 overflow-y-auto border-r border-white/10 bg-black/10 p-4">
        {list}
      </aside>
      {editor}
    </div>
  );
}

export function TemplatesAdminClient() {
  const base = useBookMallBaseUrl();
  const isAdmin = useCanvasAdmin();
  const { alert } = useDialogs();
  const [tab, setTab] = useState<AdminTab>("packs");
  const [loading, setLoading] = useState(true);
  const [packs, setPacks] = useState<Pro2TemplatePackRecord[]>([]);
  const [scriptTemplates, setScriptTemplates] = useState<Pro2PromptTemplateRecord[]>([]);
  const [assetTemplates, setAssetTemplates] = useState<Pro2PromptTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [editBlocks, setEditBlocks] = useState<Pro2PromptBlock[]>([]);
  const [editCategoryTitle, setEditCategoryTitle] = useState("");
  const [editCategoryBody, setEditCategoryBody] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, a] = await Promise.all([
        listAdminPro2TemplatePacks(base),
        listAdminPro2Templates(base, { registry: "SCRIPT" }),
        listAdminPro2Templates(base, { registry: "ASSET" }),
      ]);
      setPacks(p);
      setScriptTemplates(s);
      setAssetTemplates(a);
    } catch (err) {
      await alert({
        title: "加载失败",
        message: err instanceof Error ? err.message : "无法加载模板列表",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [alert, base]);

  useEffect(() => {
    if (isAdmin) void reload();
  }, [isAdmin, reload]);

  const scriptPackGroups = useMemo(
    () => groupScriptTemplatesByPack(packs),
    [packs],
  );

  const assetTemplateGroups = useMemo(
    () => groupTemplatesByPassKind(assetTemplates, ASSET_PASS_ORDER, ASSET_PASS_LABELS),
    [assetTemplates],
  );

  const selectedTemplate = useMemo(() => {
    const all = [...scriptTemplates, ...assetTemplates];
    return all.find((t) => t.id === selectedTemplateId) ?? null;
  }, [assetTemplates, scriptTemplates, selectedTemplateId]);

  const selectedPack = useMemo(
    () => packs.find((p) => p.id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  useEffect(() => {
    if (selectedTemplate) {
      setEditBlocks(selectedTemplate.blocks.map((b) => ({ ...b })));
    }
  }, [selectedTemplate]);

  useEffect(() => {
    if (selectedPack) {
      setEditCategoryTitle(selectedPack.categoryDocTitle ?? "");
      setEditCategoryBody(selectedPack.categoryDocBody ?? "");
    }
  }, [selectedPack]);

  const toggleTemplateEnabled = async (tpl: Pro2PromptTemplateRecord) => {
    setSaving(true);
    try {
      await patchAdminPro2Template(base, tpl.id, { enabled: !tpl.enabled });
      await reload();
    } catch (err) {
      await alert({
        title: "操作失败",
        message: err instanceof Error ? err.message : "无法更新模板",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveTemplateBlocks = async () => {
    if (!selectedTemplate) return;
    const validationError = validatePro2TemplateBlocksForSave(editBlocks);
    if (validationError) {
      await alert({
        title: "校验失败",
        message: validationError,
        variant: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await patchAdminPro2Template(base, selectedTemplate.id, { blocks: editBlocks });
      await reload();
      await alert({ title: "已保存", message: "模板块内容已更新。" });
    } catch (err) {
      await alert({
        title: "保存失败",
        message: err instanceof Error ? err.message : "无法保存",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePack = async () => {
    if (!selectedPack) return;
    setSaving(true);
    try {
      await patchAdminPro2TemplatePack(base, selectedPack.id, {
        categoryDocTitle: editCategoryTitle || null,
        categoryDocBody: editCategoryBody || null,
      });
      await reload();
      await alert({ title: "已保存", message: "模板包已更新。" });
    } catch (err) {
      await alert({
        title: "保存失败",
        message: err instanceof Error ? err.message : "无法保存",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePackEnabled = async (pack: Pro2TemplatePackRecord) => {
    setSaving(true);
    try {
      await patchAdminPro2TemplatePack(base, pack.id, { enabled: !pack.enabled });
      await reload();
    } catch (err) {
      await alert({
        title: "操作失败",
        message: err instanceof Error ? err.message : "无法更新模板包",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-white/70">
        <ShieldOff className="size-10 text-white/40" />
        <p>仅平台管理员可访问模板管理</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <p className="text-sm text-white/60">
          Pro2 双轨模板：剧本 LLM Pass 与节点资产 Dock 分轨治理。金标准见{" "}
          <code className="text-white/80">docs/画布提示词.md</code>。
        </p>
        <div className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-black/40 p-1">
        {(
          [
            ["packs", "剧本模板包"],
            ["script", "剧本 Pass"],
            ["asset", "节点资产模板"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setSelectedTemplateId(null);
              setSelectedPackId(null);
            }}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              tab === id
                ? "bg-[var(--canvas-accent)]/20 text-white"
                : "text-white/60 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-8 animate-spin text-white/50" />
        </div>
      ) : null}

      {!loading && tab === "packs" ? (
        <AdminSplitLayout
          list={
            <div className="space-y-2">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPackId(pack.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                    selectedPackId === pack.id
                      ? "border-[var(--canvas-accent)]/50 bg-[var(--canvas-accent)]/10"
                      : "border-white/10 bg-black/30 hover:bg-black/40",
                  )}
                >
                  <div>
                    <div className="font-medium text-white">{pack.name}</div>
                    <div className="text-xs text-white/50">{pack.packKey}</div>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePackEnabled(pack);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        void togglePackEnabled(pack);
                      }
                    }}
                    className="text-white/70"
                    aria-label={pack.enabled ? "停用" : "启用"}
                  >
                    {pack.enabled ? (
                      <ToggleRight className="size-5 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="size-5" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          }
          editor={
            <AdminEditorPane
              title={selectedPack?.name}
              subtitle={selectedPack?.packKey}
              empty="选择左侧模板包进行编辑"
            >
              {selectedPack ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                  <div className="grid shrink-0 gap-2 text-xs text-white/70">
                    <div>大纲 · {selectedPack.outlineTemplate?.name ?? selectedPack.outlineTemplateId}</div>
                    <div>角色 · {selectedPack.characterTemplate?.name ?? selectedPack.characterTemplateId}</div>
                    <div>场景 · {selectedPack.sceneTemplate?.name ?? selectedPack.sceneTemplateId}</div>
                    <div>分镜 · {selectedPack.storyboardTemplate?.name ?? selectedPack.storyboardTemplateId}</div>
                  </div>
                  <label className="block shrink-0 text-sm text-white/80">
                    类别说明标题
                    <input
                      value={editCategoryTitle}
                      onChange={(e) => setEditCategoryTitle(e.target.value)}
                      className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                    />
                  </label>
                  <label className="flex min-h-0 flex-1 flex-col text-sm text-white/80">
                    类别说明正文
                    <textarea
                      value={editCategoryBody}
                      onChange={(e) => setEditCategoryBody(e.target.value)}
                      className="mt-1 min-h-[min(360px,40vh)] flex-1 resize-none rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-xs text-white"
                    />
                  </label>
                  <div className="shrink-0 border-t border-white/10 pt-3">
                    <button
                      type="button"
                      onClick={() => void savePack()}
                      disabled={saving}
                      className="rounded-lg bg-[var(--canvas-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      保存模板包
                    </button>
                  </div>
                </div>
              ) : null}
            </AdminEditorPane>
          }
        />
      ) : null}

      {!loading && (tab === "script" || tab === "asset") ? (
        <AdminSplitLayout
          list={
            <div className="space-y-4">
              {tab === "script"
                ? scriptPackGroups.map((packGroup) => (
                    <PackSetSection
                      key={packGroup.packKey}
                      title={packGroup.packName}
                      subtitle="一套 · 大纲 / 角色 / 场景 / 分镜"
                      enabled={packGroup.packEnabled}
                      passGroups={packGroup.passGroups}
                      selectedTemplateId={selectedTemplateId}
                      onSelectTemplate={setSelectedTemplateId}
                      onToggleTemplateEnabled={(tpl) => void toggleTemplateEnabled(tpl)}
                    />
                  ))
                : (
                    <PackSetSection
                      title="平台金标准"
                      subtitle="一套 · 角色四视图 / 场景四全景 / 道具六视图"
                      passGroups={assetTemplateGroups}
                      selectedTemplateId={selectedTemplateId}
                      onSelectTemplate={setSelectedTemplateId}
                      onToggleTemplateEnabled={(tpl) => void toggleTemplateEnabled(tpl)}
                    />
                  )}
            </div>
          }
          editor={
            <AdminEditorPane
              title={selectedTemplate?.name}
              subtitle={selectedTemplate?.templateKey}
              empty="选择左侧模板进行编辑"
            >
              {selectedTemplate ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {selectedTemplate.registry === "SCRIPT" ? (
                    <details className="mb-3 shrink-0 text-xs text-white/60">
                      <summary className="cursor-pointer">预览解析后 Prompt</summary>
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2">
                        {resolvePro2ScriptPromptFromBlocks(editBlocks).slice(0, 2000)}
                        {resolvePro2ScriptPromptFromBlocks(editBlocks).length > 2000
                          ? "\n…"
                          : ""}
                      </pre>
                    </details>
                  ) : null}
                  <BlockEditor
                    key={selectedTemplate.id}
                    blocks={editBlocks}
                    onChange={setEditBlocks}
                    onSave={() => void saveTemplateBlocks()}
                    saving={saving}
                  />
                </div>
              ) : null}
            </AdminEditorPane>
          }
        />
      ) : null}
      </div>
    </div>
  );
}
