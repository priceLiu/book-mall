"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  TestTube2,
  Trash2,
  X,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  createCanvasProvider,
  deleteCanvasProvider,
  listCanvasProviders,
  patchCanvasProvider,
  patchCanvasProviderModel,
  refreshCanvasProviderModels,
  testCanvasProvider,
  type CanvasProviderDto,
  type CanvasProviderKindLiteral,
  type CanvasProviderModelDto,
} from "@/lib/canvas-providers-api";
import {
  listCanvasEngineModels,
  type CanvasEngineModel,
} from "@/lib/canvas-api";
import { PromptTemplatesTab } from "./prompt-templates-tab";
import { useGatewayLinkStatus } from "@/lib/canvas/use-gateway-link-status";
import { isGatewayProviderId } from "@/lib/canvas/system-providers";

function isManagedProviderId(id: string): boolean {
  return id.startsWith("system:") || isGatewayProviderId(id);
}

const HUNYUAN_PRO_BASE = "https://api.ai3d.cloud.tencent.com";
const HUNYUAN_TC_API_BASE = "https://ai3d.tencentcloudapi.com";
const HUNYUAN_TOKENHUB_BASE = "https://tokenhub.tencentmaas.com";

const KIND_LABEL: Record<CanvasProviderKindLiteral, string> = {
  KIE: "KIE.ai 聚合（推荐）",
  ALI_BAILIAN: "阿里百炼 / DashScope",
  OPENAI_COMPAT: "OpenAI 兼容（自定义 baseUrl）",
  GEMINI_NATIVE: "Google AI Studio · 原生（暂不可用）",
  HUNYUAN_3D: "腾讯混元生3D",
};

const KIND_HINT: Record<CanvasProviderKindLiteral, string> = {
  KIE: "一把 key 同时调 LLM + 图像 + 视频。baseUrl 默认 https://api.kie.ai",
  ALI_BAILIAN:
    "DashScope OpenAI 兼容入口。baseUrl 默认 https://dashscope.aliyuncs.com/compatible-mode/v1",
  OPENAI_COMPAT: "通用 OpenAI 兼容服务（如 OpenRouter / 自部署）。必须填 baseUrl",
  GEMINI_NATIVE: "（占位）请改用 OPENAI_COMPAT 接入第三方网关",
  HUNYUAN_3D:
    "混元生3D：专业版走 api.ai3d（sk- Key）；极速版/普通版走官方 API（SecretId + SecretKey）。",
};

type HunyuanTier = "pro" | "express";
type HunyuanExpressAuth = "tc3" | "tokenhub";

type AddForm = {
  alias: string;
  kind: CanvasProviderKindLiteral;
  apiKey: string;
  baseUrl: string;
  hunyuanTier: HunyuanTier;
  hunyuanExpressAuth: HunyuanExpressAuth;
  hunyuanSecretId: string;
  hunyuanSecretKey: string;
  hunyuanRegion: string;
};

const EMPTY_ADD: AddForm = {
  alias: "",
  kind: "KIE",
  apiKey: "",
  baseUrl: "",
  hunyuanTier: "pro",
  hunyuanExpressAuth: "tc3",
  hunyuanSecretId: "",
  hunyuanSecretKey: "",
  hunyuanRegion: "ap-guangzhou",
};

function hunyuanPreset(tier: HunyuanTier): Partial<AddForm> {
  if (tier === "express") {
    return {
      kind: "HUNYUAN_3D",
      hunyuanTier: "express",
      hunyuanExpressAuth: "tc3",
      alias: "混元生3D · 极速版",
      baseUrl: HUNYUAN_TC_API_BASE,
      apiKey: "",
      hunyuanSecretId: "",
      hunyuanSecretKey: "",
      hunyuanRegion: "ap-guangzhou",
    };
  }
  return {
    kind: "HUNYUAN_3D",
    hunyuanTier: "pro",
    hunyuanExpressAuth: "tc3",
    alias: "混元生3D · 专业版",
    baseUrl: HUNYUAN_PRO_BASE,
    apiKey: "",
    hunyuanSecretId: "",
    hunyuanSecretKey: "",
    hunyuanRegion: "ap-guangzhou",
  };
}

type Tab = "providers" | "models" | "system" | "prompts";

function Inner() {
  const base = useBookMallBaseUrl();
  const dialogs = useDialogs();
  const {
    linked: gatewayLinked,
    boundKinds,
    accountUrl,
    gatewayConsoleUrl,
    gatewayGuideUrl,
  } = useGatewayLinkStatus();
  const [tab, setTab] = useState<Tab>("providers");
  const [providers, setProviders] = useState<CanvasProviderDto[]>([]);
  const [systemModels, setSystemModels] = useState<CanvasEngineModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addInitial, setAddInitial] = useState<Partial<AddForm> | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const [listRes, sysRes] = await Promise.all([
        listCanvasProviders(base),
        listCanvasEngineModels(base).catch(() => ({ models: [] as CanvasEngineModel[] })),
      ]);
      setProviders(listRes.providers);
      setSystemModels(sysRes.models);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const setBusyFor = (id: string, b: boolean) =>
    setBusy((cur) => ({ ...cur, [id]: b }));

  const handleTest = useCallback(
    async (p: CanvasProviderDto) => {
      if (!base) return;
      setBusyFor(`test:${p.id}`, true);
      try {
        const r = await testCanvasProvider(base, p.id);
        if (r.ok) {
          await dialogs.alert({
            title: "连通正常",
            message: `Provider「${p.alias}」当前可用。`,
            variant: "success",
          });
        } else {
          await dialogs.alert({
            title: "连通失败",
            message: `Provider「${p.alias}」: ${r.message ?? "unknown"}`,
            variant: "error",
          });
        }
        await load();
      } catch (e) {
        await dialogs.alert({
          title: "测试失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      } finally {
        setBusyFor(`test:${p.id}`, false);
      }
    },
    [base, load, dialogs],
  );

  const handleRefresh = useCallback(
    async (p: CanvasProviderDto) => {
      if (!base) return;
      setBusyFor(`refresh:${p.id}`, true);
      try {
        await refreshCanvasProviderModels(base, p.id);
        await load();
      } catch (e) {
        await dialogs.alert({
          title: "刷新模型清单失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      } finally {
        setBusyFor(`refresh:${p.id}`, false);
      }
    },
    [base, load, dialogs],
  );

  const handleToggleActive = useCallback(
    async (p: CanvasProviderDto) => {
      if (!base) return;
      try {
        await patchCanvasProvider(base, p.id, { active: !p.active });
        await load();
      } catch (e) {
        await dialogs.alert({
          title: "更新失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      }
    },
    [base, load, dialogs],
  );

  const handleDelete = useCallback(
    async (p: CanvasProviderDto) => {
      if (!base) return;
      const ok = await dialogs.doubleConfirm({
        first: {
          title: `删除 Provider「${p.alias}」？`,
          message: "将同时删除其下所有模型条目。",
          confirmLabel: "继续",
          danger: true,
        },
        second: {
          title: "再次确认 · 不可恢复",
          message:
            "删除后不可恢复；已用此 Provider 的画布历史任务会失去关联（任务记录保留，下次运行需切换 Provider）。",
          confirmLabel: "永久删除",
          danger: true,
        },
      });
      if (!ok) return;
      setBusyFor(`del:${p.id}`, true);
      try {
        await deleteCanvasProvider(base, p.id);
        await load();
      } catch (e) {
        await dialogs.alert({
          title: "删除失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      } finally {
        setBusyFor(`del:${p.id}`, false);
      }
    },
    [base, load, dialogs],
  );

  const handleToggleModel = useCallback(
    async (p: CanvasProviderDto, m: CanvasProviderModelDto) => {
      if (!base) return;
      if (p.id.startsWith("system:")) {
        await dialogs.alert({
          title: "系统 Provider",
          message: "系统 Provider 内置模型不可逐项启停。",
        });
        return;
      }
      try {
        await patchCanvasProviderModel(base, p.id, m.id, { enabled: !m.enabled });
        await load();
      } catch (e) {
        await dialogs.alert({
          title: "更新失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      }
    },
    [base, load, dialogs],
  );

  const allMyModels = useMemo(
    () =>
      providers.flatMap((p) =>
        p.models.map((m) => ({ provider: p, model: m })),
      ),
    [providers],
  );

  return (
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="twenty-eyebrow">canvas-web · settings</p>
          <h1 className="canvas-serif mt-2 text-3xl text-white">画布配置</h1>
          <p className="mt-2 text-sm text-[var(--canvas-muted)]">
            AI 能力经 Gateway 代理（断直连）。在 Gateway 控制台绑定厂商凭证，并在 Book 个人中心关联 sk-gw 后即可选用下方模型。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {gatewayConsoleUrl ? (
            <a
              href={gatewayConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:border-white/30"
            >
              Gateway 控制台
            </a>
          ) : null}
          {accountUrl ? (
            <a
              href={accountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="twenty-btn-accent"
            >
              Book 个人中心关联 sk-gw
            </a>
          ) : null}
        </div>
      </header>

      {gatewayLinked ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Gateway 已关联
          {boundKinds.length > 0
            ? ` · 已绑定：${boundKinds.join(" / ")}`
            : " · 请在 Gateway 控制台绑定厂商凭证"}
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">尚未关联 Gateway API Key</p>
          <p className="mt-1 text-amber-100/85">
            流程：Gateway 绑定 KIE / 百炼 / DeepSeek / 混元 → 创建 sk-gw → Book 个人中心粘贴验证。
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {gatewayGuideUrl ? (
              <a
                href={gatewayGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-200 underline underline-offset-2 hover:text-white"
              >
                用户需知 →
              </a>
            ) : null}
            {gatewayConsoleUrl ? (
              <a
                href={gatewayConsoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-200 underline underline-offset-2 hover:text-white"
              >
                Gateway 控制台 →
              </a>
            ) : null}
            {accountUrl ? (
              <a
                href={accountUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-200 underline underline-offset-2 hover:text-white"
              >
                Book 个人中心关联 →
              </a>
            ) : null}
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-1 rounded-xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-1 text-sm">
        {[
          { k: "providers" as const, label: `Gateway Providers (${providers.length})` },
          { k: "models" as const, label: `我的模型 (${allMyModels.length})` },
          { k: "prompts" as const, label: "提示词模板" },
          { k: "system" as const, label: `系统模板模型 (${systemModels.length})` },
        ].map(({ k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              tab === k
                ? "bg-white/10 text-white"
                : "text-[var(--canvas-muted)] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </div>
      ) : tab === "providers" ? (
        <ProvidersTab
          providers={providers}
          busy={busy}
          onTest={handleTest}
          onRefresh={handleRefresh}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
          onToggleModel={handleToggleModel}
        />
      ) : tab === "models" ? (
        <MyModelsTab
          providers={providers}
          onToggleModel={handleToggleModel}
        />
      ) : tab === "prompts" ? (
        <PromptTemplatesTab />
      ) : (
        <SystemModelsTab models={systemModels} />
      )}

      {addOpen ? (
        <AddProviderModal
          base={base}
          initial={addInitial}
          onClose={() => {
            setAddOpen(false);
            setAddInitial(null);
          }}
          onCreated={async () => {
            setAddOpen(false);
            setAddInitial(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function ProvidersTab({
  providers,
  busy,
  onTest,
  onRefresh,
  onToggleActive,
  onDelete,
  onToggleModel,
}: {
  providers: CanvasProviderDto[];
  busy: Record<string, boolean>;
  onTest: (p: CanvasProviderDto) => void;
  onRefresh: (p: CanvasProviderDto) => void;
  onToggleActive: (p: CanvasProviderDto) => void;
  onDelete: (p: CanvasProviderDto) => void;
  onToggleModel: (p: CanvasProviderDto, m: CanvasProviderModelDto) => void;
}) {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setOpenIds((cur) => ({ ...cur, [id]: !cur[id] }));

  if (providers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[var(--canvas-surface)] px-6 py-10 text-center text-sm text-[var(--canvas-muted)]">
        尚未加载到 Gateway Provider。请先在 Gateway 控制台绑定厂商凭证，并在 Book 个人中心关联 sk-gw。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {providers.map((p) => {
        const open = !!openIds[p.id];
        const llm = p.models.filter((m) => m.role === "LLM");
        const image = p.models.filter((m) => m.role === "IMAGE");
        const video = p.models.filter((m) => m.role === "VIDEO");
        return (
          <section
            key={p.id}
            className="overflow-hidden rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)]"
          >
            <header className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="flex shrink-0 items-center gap-2 text-white"
                aria-label={open ? "收起" : "展开"}
              >
                {open ? (
                  <ChevronDown className="size-4 text-[var(--canvas-muted)]" />
                ) : (
                  <ChevronRight className="size-4 text-[var(--canvas-muted)]" />
                )}
                <span className="text-base font-medium">{p.alias}</span>
              </button>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-[var(--canvas-muted)]">
                {p.kind}
              </span>
              {p.active ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                  启用
                </span>
              ) : (
                <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] text-zinc-300">
                  停用
                </span>
              )}
              <span className="text-[12px] text-[var(--canvas-muted)]">
                {p.models.filter((m) => m.enabled).length} / {p.models.length} 模型已启用
              </span>
              {p.lastTestedAt ? (
                <span className="text-[11px] text-[var(--canvas-muted)]">
                  最后测试：{new Date(p.lastTestedAt).toLocaleString()}
                  {p.lastTestStatus
                    ? ` · ${p.lastTestStatus.startsWith("ok") ? "✓" : "✗"} ${p.lastTestStatus}`
                    : ""}
                </span>
              ) : null}

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {isManagedProviderId(p.id) ? (
                  <>
                    <span className="rounded-full border border-[var(--canvas-accent)]/40 bg-[var(--canvas-accent)]/15 px-2 py-0.5 text-[11px] text-white/85">
                      {isGatewayProviderId(p.id)
                        ? "Gateway 代理 · 只读"
                        : "系统共享 · 无需配置"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onTest(p)}
                      disabled={!!busy[`test:${p.id}`]}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--canvas-muted)] hover:border-white/30 hover:text-white disabled:opacity-60"
                    >
                      {busy[`test:${p.id}`] ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <TestTube2 className="size-3" />
                      )}
                      测试
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onTest(p)}
                      disabled={!!busy[`test:${p.id}`]}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--canvas-muted)] hover:border-white/30 hover:text-white disabled:opacity-60"
                    >
                      {busy[`test:${p.id}`] ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <TestTube2 className="size-3" />
                      )}
                      测试
                    </button>
                    <button
                      type="button"
                      onClick={() => onRefresh(p)}
                      disabled={!!busy[`refresh:${p.id}`]}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--canvas-muted)] hover:border-white/30 hover:text-white disabled:opacity-60"
                    >
                      {busy[`refresh:${p.id}`] ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      刷新模型
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActive(p)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
                    >
                      {p.active ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      disabled={!!busy[`del:${p.id}`]}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2 py-1 text-xs text-red-200 hover:border-red-500/50 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      <Trash2 className="size-3" />
                      删除
                    </button>
                  </>
                )}
              </div>
            </header>

            {open ? (
              <div className="border-t border-white/5 px-4 py-3 text-[12px] text-[var(--canvas-muted)]">
                <p>
                  apiKey: <span className="font-mono text-white">{p.apiKeyMasked}</span>
                  {p.baseUrl ? (
                    <>
                      ·  baseUrl: <span className="font-mono text-white">{p.baseUrl}</span>
                    </>
                  ) : null}
                </p>
                <ModelGroup
                  title="LLM"
                  list={llm}
                  provider={p}
                  onToggle={onToggleModel}
                />
                <ModelGroup
                  title="IMAGE"
                  list={image}
                  provider={p}
                  onToggle={onToggleModel}
                />
                {video.length > 0 ? (
                  <ModelGroup
                    title="VIDEO"
                    list={video}
                    provider={p}
                    onToggle={onToggleModel}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function ModelGroup({
  title,
  list,
  provider,
  onToggle,
}: {
  title: string;
  list: CanvasProviderModelDto[];
  provider: CanvasProviderDto;
  onToggle: (p: CanvasProviderDto, m: CanvasProviderModelDto) => void;
}) {
  if (list.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {list.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggle(provider, m)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
              m.enabled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : "border-white/10 bg-black/20 text-[var(--canvas-muted)] hover:border-white/30"
            }`}
          >
            {m.enabled ? <CheckCircle2 className="size-3" /> : null}
            <span className="font-mono">{m.modelKey}</span>
            <span className="text-[10px] opacity-70">· {m.displayName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MyModelsTab({
  providers,
  onToggleModel,
}: {
  providers: CanvasProviderDto[];
  onToggleModel: (p: CanvasProviderDto, m: CanvasProviderModelDto) => void;
}) {
  const all = useMemo(
    () =>
      providers.flatMap((p) =>
        p.models.map((m) => ({ provider: p, model: m })),
      ),
    [providers],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, typeof all>();
    for (const item of all) {
      const arr = map.get(item.model.role) ?? [];
      arr.push(item);
      map.set(item.model.role, arr);
    }
    return map;
  }, [all]);

  if (all.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[var(--canvas-surface)] px-6 py-10 text-center text-sm text-[var(--canvas-muted)]">
        还没有从 Provider 拉到模型。请到「我的 Providers」点「刷新模型」。
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([role, list]) => (
        <section
          key={role}
          className="overflow-hidden rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)]"
        >
          <header className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-2.5">
            <p className="text-xs uppercase tracking-wider text-[var(--canvas-muted)]">
              {role}
            </p>
            <p className="text-[11px] text-[var(--canvas-muted)]">{list.length} 个</p>
          </header>
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--canvas-muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">来源</th>
                <th className="px-4 py-2 font-medium">modelKey</th>
                <th className="px-4 py-2 font-medium">展示名</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {list.map(({ provider: p, model: m }) => (
                <tr key={m.id} className="text-white">
                  <td className="px-4 py-2.5 text-[12px] text-[var(--canvas-muted)]">
                    {p.alias} <span className="opacity-60">({p.kind})</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">
                    {m.modelKey}
                  </td>
                  <td className="px-4 py-2.5">{m.displayName}</td>
                  <td className="px-4 py-2.5">
                    {m.enabled ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                        启用
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] text-zinc-300">
                        禁用
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleModel(p, m)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
                    >
                      {m.enabled ? "禁用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function SystemModelsTab({ models }: { models: CanvasEngineModel[] }) {
  if (models.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[var(--canvas-surface)] px-6 py-10 text-center text-sm text-[var(--canvas-muted)]">
        系统暂未配置模板模型。
      </div>
    );
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)]">
      <header className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-2.5">
        <p className="text-xs uppercase tracking-wider text-[var(--canvas-muted)]">
          系统模板模型 (canvas-web 内置)
        </p>
        <p className="text-[11px] text-[var(--canvas-muted)]">{models.length} 个</p>
      </header>
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--canvas-muted)]">
          <tr>
            <th className="px-4 py-2 font-medium">modelKey</th>
            <th className="px-4 py-2 font-medium">展示名</th>
            <th className="px-4 py-2 font-medium">厂商</th>
            <th className="px-4 py-2 font-medium">说明</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {models.map((m) => (
            <tr key={m.id} className="text-white">
              <td className="px-4 py-2.5 font-mono text-[12px]">{m.modelKey}</td>
              <td className="px-4 py-2.5">{m.displayName}</td>
              <td className="px-4 py-2.5 text-[var(--canvas-muted)]">{m.vendor}</td>
              <td className="max-w-[28rem] px-4 py-2.5 text-[12px] text-[var(--canvas-muted)]">
                {m.description ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AddProviderModal({
  base,
  initial,
  onClose,
  onCreated,
}: {
  base: string;
  initial?: Partial<AddForm> | null;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<AddForm>({
    ...EMPTY_ADD,
    ...(initial ?? {}),
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onChangeKind = (e: ChangeEvent<HTMLSelectElement>) => {
    const kind = e.target.value as CanvasProviderKindLiteral;
    if (kind === "HUNYUAN_3D") {
      setForm({ ...form, kind, ...hunyuanPreset(form.hunyuanTier) });
      return;
    }
    setForm({ ...form, kind, baseUrl: "" });
  };

  const onChangeHunyuanTier = (tier: HunyuanTier) => {
    setForm({ ...form, ...hunyuanPreset(tier) });
  };

  const onSubmit = async () => {
    const isHunyuanExpressTc3 =
      form.kind === "HUNYUAN_3D" &&
      form.hunyuanTier === "express" &&
      form.hunyuanExpressAuth === "tc3";

    if (!form.alias.trim()) {
      setErr("别名不能为空");
      return;
    }
    if (isHunyuanExpressTc3) {
      if (!form.hunyuanSecretId.trim() || !form.hunyuanSecretKey.trim()) {
        setErr("极速版需填写 SecretId 与 SecretKey");
        return;
      }
    } else if (!form.apiKey.trim()) {
      setErr("alias / apiKey 不能为空");
      return;
    }
    if (form.kind === "OPENAI_COMPAT" && !form.baseUrl.trim()) {
      setErr("OPENAI_COMPAT 必须填写 baseUrl");
      return;
    }
    if (form.kind === "HUNYUAN_3D" && !form.baseUrl.trim()) {
      setErr("混元 Provider 必须选择版本（专业版 / 极速版）");
      return;
    }

    let apiKey = form.apiKey.trim();
    let baseUrl = form.baseUrl.trim() || null;
    if (form.kind === "HUNYUAN_3D" && form.hunyuanTier === "express") {
      if (form.hunyuanExpressAuth === "tc3") {
        apiKey = JSON.stringify({
          t: "tc3",
          id: form.hunyuanSecretId.trim(),
          key: form.hunyuanSecretKey.trim(),
          region: form.hunyuanRegion.trim() || "ap-guangzhou",
        });
        baseUrl = HUNYUAN_TC_API_BASE;
      } else {
        baseUrl = HUNYUAN_TOKENHUB_BASE;
      }
    }

    setSubmitting(true);
    setErr(null);
    try {
      await createCanvasProvider(base, {
        alias: form.alias.trim(),
        kind: form.kind,
        apiKey,
        baseUrl,
      });
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const showHunyuanTc3Fields =
    form.kind === "HUNYUAN_3D" &&
    form.hunyuanTier === "express" &&
    form.hunyuanExpressAuth === "tc3";

  const apiKeyPlaceholder =
    form.kind === "HUNYUAN_3D" && form.hunyuanTier === "express"
      ? "TokenHub API Key（非 AKID SecretId）"
      : form.kind === "HUNYUAN_3D"
        ? "sk-...（混元控制台 → API Key 管理）"
        : "sk-... 或厂商签发的 key";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface)] text-white shadow-xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <p className="text-sm font-medium">添加 Provider</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-3 p-5 text-sm">
          {err ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              {err}
            </p>
          ) : null}

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
              kind（Provider 类型）
            </span>
            <select
              value={form.kind}
              onChange={onChangeKind}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] focus:border-[var(--canvas-accent)]/60 focus:outline-none"
            >
              {(
                ["KIE", "ALI_BAILIAN", "OPENAI_COMPAT", "HUNYUAN_3D", "GEMINI_NATIVE"] as CanvasProviderKindLiteral[]
              ).map((k) => (
                <option key={k} value={k} disabled={k === "GEMINI_NATIVE"}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-[var(--canvas-muted)]">
              {KIND_HINT[form.kind]}
            </span>
          </label>

          {form.kind === "HUNYUAN_3D" ? (
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                混元版本
              </span>
              <select
                value={form.hunyuanTier}
                onChange={(e) =>
                  onChangeHunyuanTier(e.target.value as HunyuanTier)
                }
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] focus:border-[var(--canvas-accent)]/60 focus:outline-none"
              >
                <option value="pro">专业版 · api.ai3d.cloud.tencent.com</option>
                <option value="express">
                  极速版 / 普通版 · ai3d.tencentcloudapi.com（约 90 秒出模）
                </option>
              </select>
              {form.hunyuanTier === "express" ? (
                <select
                  value={form.hunyuanExpressAuth}
                  onChange={(e) => {
                    const auth = e.target.value as HunyuanExpressAuth;
                    setForm({
                      ...form,
                      hunyuanExpressAuth: auth,
                      baseUrl:
                        auth === "tc3" ? HUNYUAN_TC_API_BASE : HUNYUAN_TOKENHUB_BASE,
                      apiKey: "",
                      hunyuanSecretId: "",
                      hunyuanSecretKey: "",
                    });
                  }}
                  className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] focus:border-[var(--canvas-accent)]/60 focus:outline-none"
                >
                  <option value="tc3">官方 API · SecretId + SecretKey（推荐）</option>
                  <option value="tokenhub">TokenHub · 单独 API Key（可选）</option>
                </select>
              ) : null}
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--canvas-muted)]">
                {form.hunyuanTier === "express" ? (
                  form.hunyuanExpressAuth === "tc3" ? (
                    <>
                      使用腾讯云{" "}
                      <a
                        href="https://cloud.tencent.com/document/product/1804/123463"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--canvas-accent-soft)] underline"
                      >
                        SubmitHunyuanTo3DRapidJob
                      </a>
                      ；在{" "}
                      <a
                        href="https://console.cloud.tencent.com/cam/capi"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--canvas-accent-soft)] underline"
                      >
                        访问管理 → API 密钥
                      </a>{" "}
                      获取 SecretId / SecretKey。模型为{" "}
                      <code className="text-white/80">hunyuan-3d-express</code>。
                    </>
                  ) : (
                    <>
                      在{" "}
                      <a
                        href="https://cloud.tencent.com/document/product/1823/130082"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--canvas-accent-soft)] underline"
                      >
                        TokenHub 混元生3D
                      </a>{" "}
                      创建 API Key 后粘贴（与官方 SecretId 不是同一套凭证）。
                    </>
                  )
                ) : (
                  <>
                    在{" "}
                    <a
                      href="https://console.cloud.tencent.com/ai3d/start"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--canvas-accent-soft)] underline"
                    >
                      混元控制台
                    </a>{" "}
                    创建 <code className="text-white/80">sk-</code> 开头 API Key。模型为{" "}
                    <code className="text-white/80">hunyuan-3d-pro</code>。
                  </>
                )}
              </span>
            </label>
          ) : null}

          <Field
            label="别名（仅供你识别）"
            value={form.alias}
            placeholder="如：我的 KIE 账号"
            onChange={(v) => setForm({ ...form, alias: v })}
          />
          {showHunyuanTc3Fields ? (
            <>
              <Field
                label="SecretId（AKID 开头）"
                value={form.hunyuanSecretId}
                placeholder="AKID..."
                onChange={(v) => setForm({ ...form, hunyuanSecretId: v })}
              />
              <Field
                label="SecretKey"
                value={form.hunyuanSecretKey}
                placeholder="在访问管理 → API 密钥中查看"
                onChange={(v) => setForm({ ...form, hunyuanSecretKey: v })}
                isPassword
              />
              <Field
                label="Region（地域）"
                value={form.hunyuanRegion}
                placeholder="ap-guangzhou"
                onChange={(v) => setForm({ ...form, hunyuanRegion: v })}
                hint="默认 ap-guangzhou，详见混元生3D 地域列表"
              />
            </>
          ) : (
            <Field
              label="API Key"
              value={form.apiKey}
              placeholder={apiKeyPlaceholder}
              onChange={(v) => setForm({ ...form, apiKey: v })}
              isPassword
            />
          )}
          {form.kind === "HUNYUAN_3D" ? (
            <Field
              label="baseUrl（按版本自动填写）"
              value={form.baseUrl}
              placeholder={HUNYUAN_PRO_BASE}
              onChange={(v) => setForm({ ...form, baseUrl: v })}
              hint="极速版官方 API 为 ai3d.tencentcloudapi.com；专业版为 api.ai3d.cloud.tencent.com"
            />
          ) : (
            <Field
              label={`baseUrl ${form.kind === "OPENAI_COMPAT" ? "(必填)" : "(可选，留空走默认)"}`}
              value={form.baseUrl}
              placeholder={
                form.kind === "ALI_BAILIAN"
                  ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
                  : form.kind === "KIE"
                    ? "https://api.kie.ai"
                    : "https://example.com/v1"
              }
              onChange={(v) => setForm({ ...form, baseUrl: v })}
            />
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--canvas-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--canvas-accent-soft)] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-3 animate-spin" /> : null}
            创建并自动拉取模型清单
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  placeholder,
  isPassword,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  isPassword?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
        {label}
      </span>
      <input
        type={isPassword ? "password" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] focus:border-[var(--canvas-accent)]/60 focus:outline-none"
        autoComplete="off"
      />
      {hint ? (
        <span className="mt-1 block text-[10px] text-[var(--canvas-muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function ProvidersClient() {
  return <Inner />;
}
