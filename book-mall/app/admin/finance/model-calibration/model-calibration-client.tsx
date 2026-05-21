"use client";

import { useMemo, useState, useTransition } from "react";
import { useActionState } from "@/lib/use-action-state";
import { Check, Plus, Upload, X, ChevronDown, ChevronRight, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  upsertModelCatalogAction,
  setAliasCatalogAction,
  detachAliasAction,
  acceptAllHighSuggestionsAction,
  ingestCandidatesAction,
  runAutoCalibrationAction,
} from "@/app/actions/model-calibration";
// v003 修：`"use server"` 文件不能 export 非函数；常量/类型挪到了 -state。
import {
  calibrationActionIdle,
  type CalibrationActionState,
} from "@/app/actions/model-calibration-state";
import type {
  ModelCatalogRow,
  PendingAliasRow,
} from "@/lib/model-catalog/queries";

const BILLING_KINDS = [
  { value: "TOKEN_IN_OUT", label: "按 Token（in/out）" },
  { value: "OUTPUT_IMAGE", label: "按张" },
  { value: "COST_PER_IMAGE", label: "按张（成本式）" },
  { value: "VIDEO_MODEL_SPEC", label: "按秒（视频）" },
];

const ALIAS_SOURCES = [
  { value: "VENDOR_COMMODITY_CODE", label: "云·商品 Code" },
  { value: "VENDOR_BILLABLE_ITEM", label: "云·计费项 Code" },
  { value: "VENDOR_RESOURCE_SPEC", label: "云·规格/资源" },
  { value: "VENDOR_PRODUCT_NAME", label: "云·产品名称" },
  { value: "INTERNAL_TOOLKEY", label: "我们·toolKey" },
  { value: "INTERNAL_ACTION", label: "我们·action" },
  { value: "INTERNAL_SCHEME_A_MODEL", label: "我们·scheme A 模型" },
  { value: "PRICE_MD_LABEL", label: "price.md 标签" },
  { value: "MANUAL_OTHER", label: "其他（手动）" },
];

function FeedbackBanner({ state }: { state: CalibrationActionState }) {
  if (state.kind === "idle") return null;
  const ok = state.kind === "ok";
  return (
    <div
      className={cn(
        "rounded border px-3 py-2 text-sm",
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200",
      )}
    >
      <span className="font-semibold">{ok ? "成功：" : "失败："}</span>
      <span className="ml-1">{state.message}</span>
    </div>
  );
}

export function ModelCalibrationClient({
  catalogs,
  pending,
}: {
  catalogs: ModelCatalogRow[];
  pending: PendingAliasRow[];
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [expandedCatalogId, setExpandedCatalogId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");

  const vendors = useMemo(() => {
    const set = new Set(catalogs.map((c) => c.vendor));
    return ["all", ...Array.from(set).sort()];
  }, [catalogs]);

  const filteredCatalogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogs.filter((c) => {
      if (vendorFilter !== "all" && c.vendor !== vendorFilter) return false;
      if (!q) return true;
      return (
        c.canonicalKey.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        c.vendor.toLowerCase().includes(q) ||
        c.aliases.some((a) => a.aliasValue.toLowerCase().includes(q))
      );
    });
  }, [catalogs, search, vendorFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AutoCalibrateButton />
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> 单个录入（新建标准 + 别名）
        </Button>
        <Button variant="outline" onClick={() => setShowIngestModal(true)}>
          <Upload className="mr-1.5 h-4 w-4" /> 导入候选别名 JSON
        </Button>
        <AcceptAllHighButton />
        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="搜索 canonicalKey / 厂商 / 别名…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="h-9 rounded border bg-background px-2 text-sm"
          >
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v === "all" ? "全部厂商" : v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>待审别名（{pending.length}）</span>
              <span className="text-xs font-normal text-muted-foreground">
                自动建议：HIGH/MEDIUM/LOW；点「✓」接受，点 catalog 行 + 选「+ 接收」可改挂
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.length === 0 ? (
              <div className="rounded border border-dashed py-8 text-center text-sm text-muted-foreground">
                暂无待审别名 — 导入 CSV 或粘贴候选 JSON 后会在此列出
              </div>
            ) : (
              <ul className="space-y-1.5">
                {pending.map((a) => (
                  <PendingRow
                    key={a.id}
                    pending={a}
                    catalogs={catalogs}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>标准模型（{filteredCatalogs.length}/{catalogs.length}）</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredCatalogs.length === 0 ? (
              <div className="rounded border border-dashed py-8 text-center text-sm text-muted-foreground">
                无匹配的标准模型 — 点击左上「单个录入」开始
              </div>
            ) : (
              <ul className="space-y-1.5">
                {filteredCatalogs.map((c) => (
                  <CatalogRow
                    key={c.id}
                    catalog={c}
                    expanded={expandedCatalogId === c.id}
                    onToggle={() =>
                      setExpandedCatalogId((p) => (p === c.id ? null : c.id))
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {showCreateModal && (
        <CreateCatalogModal onClose={() => setShowCreateModal(false)} />
      )}
      {showIngestModal && (
        <IngestCandidatesModal onClose={() => setShowIngestModal(false)} />
      )}
    </div>
  );
}

function AcceptAllHighButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          startTransition(async () => {
            const r = await acceptAllHighSuggestionsAction();
            setMsg(`已接受 ${r.accepted} 条 HIGH 建议`);
            setTimeout(() => setMsg(null), 2500);
          })
        }
        disabled={pending}
      >
        批量接受 HIGH
      </Button>
      {msg ? <span className="text-xs text-emerald-700">{msg}</span> : null}
    </>
  );
}

/**
 * v003 一键自动校准：
 *  - 从 ToolBillablePrice 派生 catalog（最权威）
 *  - 从 PricingSourceLine（最新版）派生（云成本真源）
 *  - 把 pending alias 按 HIGH/MEDIUM 自动绑定（LOW 留待审）
 */
function AutoCalibrateButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <>
      <Button
        size="sm"
        variant="default"
        onClick={() =>
          startTransition(async () => {
            const r = await runAutoCalibrationAction();
            if (r.kind === "ok") {
              setMsg({ ok: true, text: r.message });
            } else if (r.kind === "error") {
              setMsg({ ok: false, text: r.message });
            }
            setTimeout(() => setMsg(null), 8000);
          })
        }
        disabled={pending}
        title="从 ToolBillablePrice / PricingSourceLine 自动建立标准 + 自动绑定 pending alias"
      >
        <Wand2 className="mr-1.5 h-4 w-4" />
        {pending ? "校准中…" : "一键自动校准"}
      </Button>
      {msg ? (
        <span
          className={cn(
            "text-xs",
            msg.ok ? "text-emerald-700" : "text-rose-700",
          )}
        >
          {msg.text}
        </span>
      ) : null}
    </>
  );
}

function PendingRow({
  pending,
  catalogs,
}: {
  pending: PendingAliasRow;
  catalogs: ModelCatalogRow[];
}) {
  const [picking, setPicking] = useState(false);
  const [state, formAction] = useActionState(setAliasCatalogAction, calibrationActionIdle);
  const [searchPick, setSearchPick] = useState("");
  const filtered = useMemo(() => {
    const q = searchPick.trim().toLowerCase();
    if (!q) return catalogs.slice(0, 25);
    return catalogs
      .filter(
        (c) =>
          c.canonicalKey.toLowerCase().includes(q) ||
          c.displayName.toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [searchPick, catalogs]);

  return (
    <li className="rounded border p-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {pending.source}
            </Badge>
            <span className="break-all font-mono">{pending.aliasValue}</span>
            {pending.tierRawHint ? (
              <span className="text-xs text-muted-foreground">[{pending.tierRawHint}]</span>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            置信 {pending.confidence}
            {pending.matchedBy ? ` · ${pending.matchedBy}` : ""}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPicking((p) => !p)}
          className="shrink-0"
        >
          {picking ? "收起" : "改挂…"}
        </Button>
      </div>
      <FeedbackBanner state={state} />
      {picking && (
        <div className="mt-2 rounded border bg-muted/30 p-2">
          <Input
            value={searchPick}
            onChange={(e) => setSearchPick(e.target.value)}
            placeholder="搜索 canonicalKey…"
            className="mb-2"
          />
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted">
                <span className="truncate">
                  <span className="font-mono">{c.canonicalKey}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.vendor} · {c.displayName}
                  </span>
                </span>
                <form action={formAction} className="shrink-0">
                  <input type="hidden" name="aliasId" value={pending.id} />
                  <input type="hidden" name="catalogId" value={c.id} />
                  <Button type="submit" size="sm" variant="ghost" className="h-7">
                    挂到此处
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function CatalogRow({
  catalog,
  expanded,
  onToggle,
}: {
  catalog: ModelCatalogRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [detachState, detachFormAction] = useActionState(detachAliasAction, calibrationActionIdle);
  return (
    <li className="rounded border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="font-mono">{catalog.canonicalKey}</span>
            <Badge variant="secondary" className="text-xs">
              {catalog.vendor}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {catalog.billingKind}
            </Badge>
            <span className="text-xs text-muted-foreground">{catalog.unitLabel}</span>
          </div>
          <div className="mt-0.5 ml-6 text-xs text-muted-foreground">
            {catalog.displayName}
            {catalog.defaultTierRaw ? ` · 默认 ${catalog.defaultTierRaw}` : ""}
            {!catalog.active ? "（已停用）" : ""}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {catalog.aliases.length} 别名
        </span>
      </button>
      {expanded && (
        <div className="space-y-1 border-t bg-muted/20 px-2 py-2">
          <FeedbackBanner state={detachState} />
          {catalog.aliases.length === 0 ? (
            <div className="py-2 text-center text-xs text-muted-foreground">
              暂无别名
            </div>
          ) : (
            <ul className="space-y-1">
              {catalog.aliases.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Badge variant="outline" className="mr-2 text-xs">
                      {a.source}
                    </Badge>
                    <span className="break-all font-mono text-xs">{a.aliasValue}</span>
                    {a.tierRawHint ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        [{a.tierRawHint}]
                      </span>
                    ) : null}
                  </div>
                  <form action={detachFormAction}>
                    <input type="hidden" name="aliasId" value={a.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-rose-700"
                      aria-label="解挂"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function CreateCatalogModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(upsertModelCatalogAction, calibrationActionIdle);
  const [aliasList, setAliasList] = useState<
    Array<{ source: string; aliasValue: string; tierRawHint: string }>
  >([{ source: "VENDOR_COMMODITY_CODE", aliasValue: "", tierRawHint: "" }]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">单个录入 — 新建标准模型 + 别名</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form action={formAction} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="canonicalKey">标准模型 key *</Label>
              <Input id="canonicalKey" name="canonicalKey" required placeholder="happyhorse-1.0-i2v" />
            </div>
            <div>
              <Label htmlFor="displayName">显示名 *</Label>
              <Input id="displayName" name="displayName" required placeholder="HappyHorse 图生视频 1.0" />
            </div>
            <div>
              <Label htmlFor="vendor">厂商 *</Label>
              <Input id="vendor" name="vendor" required placeholder="aliyun" />
            </div>
            <div>
              <Label htmlFor="billingKind">计费维度 *</Label>
              <select
                id="billingKind"
                name="billingKind"
                required
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {BILLING_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="unitLabel">单位标签 *</Label>
              <Input id="unitLabel" name="unitLabel" required placeholder="元/秒" />
            </div>
            <div>
              <Label htmlFor="defaultTierRaw">默认档位</Label>
              <Input id="defaultTierRaw" name="defaultTierRaw" placeholder="1080P" />
            </div>
          </div>
          <div>
            <Label htmlFor="note">备注（可选）</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>别名（同时挂载到此标准）</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setAliasList((p) => [
                    ...p,
                    { source: "VENDOR_COMMODITY_CODE", aliasValue: "", tierRawHint: "" },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> 加一行
              </Button>
            </div>
            <div className="mt-1 space-y-2">
              {aliasList.map((a, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <select
                    value={a.source}
                    onChange={(e) =>
                      setAliasList((p) =>
                        p.map((x, idx) => (idx === i ? { ...x, source: e.target.value } : x)),
                      )
                    }
                    className="col-span-4 h-9 rounded border bg-background px-2 text-sm"
                  >
                    {ALIAS_SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="col-span-5"
                    value={a.aliasValue}
                    onChange={(e) =>
                      setAliasList((p) =>
                        p.map((x, idx) => (idx === i ? { ...x, aliasValue: e.target.value } : x)),
                      )
                    }
                    placeholder="alias 字串"
                  />
                  <Input
                    className="col-span-2"
                    value={a.tierRawHint}
                    onChange={(e) =>
                      setAliasList((p) =>
                        p.map((x, idx) => (idx === i ? { ...x, tierRawHint: e.target.value } : x)),
                      )
                    }
                    placeholder="档位提示"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="col-span-1"
                    onClick={() => setAliasList((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <input
            type="hidden"
            name="aliases"
            value={JSON.stringify(
              aliasList
                .filter((a) => a.aliasValue.trim().length > 0)
                .map((a) => ({
                  source: a.source,
                  aliasValue: a.aliasValue.trim(),
                  ...(a.tierRawHint.trim() ? { tierRawHint: a.tierRawHint.trim() } : {}),
                })),
            )}
          />
          <input type="hidden" name="active" value="on" />
          <FeedbackBanner state={state} />
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              关闭
            </Button>
            <Button type="submit">
              <Check className="mr-1 h-4 w-4" />
              保存
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IngestCandidatesModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(ingestCandidatesAction, calibrationActionIdle);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">导入候选别名（JSON 数组）</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          每项形如 <code>{`{ "source": "VENDOR_COMMODITY_CODE", "aliasValue": "sfm_inferenceHH_public_cn" }`}</code>
          ；source 可选值见单录入弹窗。
        </p>
        <form action={formAction} className="space-y-2">
          <Textarea
            name="candidates"
            rows={12}
            placeholder='[ { "source": "VENDOR_COMMODITY_CODE", "aliasValue": "sfm_inferenceHH_public_cn" } ]'
            className="font-mono text-xs"
          />
          <FeedbackBanner state={state} />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              关闭
            </Button>
            <Button type="submit">
              <Upload className="mr-1 h-4 w-4" />
              导入并自动建议
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
