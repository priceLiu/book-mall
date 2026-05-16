"use client";

import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  createToolBillablePrice,
  updateToolBillablePrice,
} from "@/app/actions/tool-apps-admin";
import type {
  BillableRowPayload,
  BillableRowStatus,
} from "@/lib/tool-billable-row-payloads";
import type { SchemeAModelOption } from "@/lib/tool-billable-scheme-a-shared";
import { schemeABillableOptionsKey } from "@/lib/tool-billable-scheme-a-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function formatDatetimeLocalChina(dIso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(dIso));
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

function retailYuan(costStr: string, multStr: string): number {
  const c = Number(costStr);
  const m = Number(multStr);
  if (!Number.isFinite(c) || !Number.isFinite(m)) return 0;
  return c * m;
}

/** 后台表单时间串 `YYYY-MM-DDTHH:mm` → 两行展示，与「生效起/止」列一致 */
function wallDatetimeParts(value: string): { date: string; time: string } | null {
  const v = value.trim();
  if (!v) return null;
  const i = v.indexOf("T");
  if (i === -1) return { date: v, time: "" };
  return { date: v.slice(0, i), time: v.slice(i + 1) };
}

function WallDatetimeTwoLines({
  value,
  className = "",
  title,
}: {
  value: string;
  className?: string;
  title?: string;
}) {
  const parts = wallDatetimeParts(value);
  if (!parts) {
    return (
      <span className={`font-mono text-xs tabular-nums text-muted-foreground ${className}`}>--</span>
    );
  }
  return (
    <div
      className={`flex flex-col font-mono text-xs tabular-nums text-muted-foreground leading-tight ${className}`}
      title={title}
    >
      <span>{parts.date}</span>
      {parts.time ? <span>{parts.time}</span> : null}
    </div>
  );
}

const COMBO_MIN_WIDTH_PX = 320;

type SchemeARefModelComboProps = {
  form?: string;
  name: string;
  value: string;
  onValueChange: (next: string) => void;
  options: SchemeAModelOption[];
  inputClassName?: string;
  placeholder?: string;
  title?: string;
};

/**
 * 自定义建议列表（替代原生 datalist）：宽度与输入对齐、分层阴影，避免浏览器默认窄条与背景「糊在一起」。
 */
function SchemeARefModelCombo({
  form,
  name,
  value,
  onValueChange,
  options,
  inputClassName,
  placeholder,
  title,
}: SchemeARefModelComboProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const updateCoords = useCallback(() => {
    const el = wrapRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, COMBO_MIN_WIDTH_PX);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setCoords({
      left,
      top: r.bottom + 6,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, updateCoords, value]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updateCoords();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (wrapRef.current?.contains(node)) return;
      if (listRef.current?.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.catalogModelId.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q),
    );
  }, [options, value]);

  const showList = open && options.length > 0;

  const listEl =
    showList && coords && typeof document !== "undefined" ? (
      createPortal(
        <div
          ref={listRef}
          role="listbox"
          className="fixed z-[100] overflow-y-auto rounded-lg border border-border bg-card py-1 text-card-foreground shadow-xl ring-1 ring-black/10 dark:ring-white/10"
          style={{
            left: coords.left,
            top: coords.top,
            width: coords.width,
            maxHeight: "min(16rem, 70vh)",
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              无匹配建议，可直接使用当前输入作为 id
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.catalogModelId}
                type="button"
                role="option"
                className="flex w-full flex-col items-stretch gap-0.5 px-3 py-2 text-left text-xs hover:bg-muted/80 focus:bg-muted/80 focus:outline-none"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onValueChange(o.catalogModelId);
                  setOpen(false);
                }}
              >
                <span className="font-mono font-medium">{o.catalogModelId}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {o.label}
                </span>
              </button>
            ))
          )}
        </div>,
        document.body,
      )
    ) : null;

  return (
    <div ref={wrapRef} className="relative w-full min-w-[14rem]">
      <div className="relative flex w-full items-stretch">
        <Input
          form={form}
          name={name}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={() => {
            updateCoords();
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className={[inputClassName, "pr-9"].filter(Boolean).join(" ")}
          placeholder={placeholder}
          spellCheck={false}
          title={title}
          autoComplete="off"
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="展开建议列表"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            updateCoords();
            setOpen((v) => !v);
          }}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {listEl}
    </div>
  );
}

function schemeMismatchHint(
  modelId: string,
  options: SchemeAModelOption[],
): string | null {
  const id = modelId.trim();
  if (!id) return null;
  const opt = options.find((o) => o.catalogModelId === id);
  if (!opt) {
    return options.length > 0
      ? "该 id 不在当前价目 catalog 列表中：可先行保存（手填成本）；须补齐 price.md/import、sync map、emit 与工具站模型配置后，标价与实扣才能一致。"
      : null;
  }
  if (opt.defaultCostYuan == null) {
    return "当前价目库无匹配行：请 import/映射后刷新本页预填成本，或直接手填成本（元）。";
  }
  return null;
}

const STATUS_LABEL: Record<BillableRowStatus, string> = {
  current: "当前生效",
  future: "未来生效",
  expired: "已过期",
  inactive: "已停用",
};

function StatusBadge({ status }: { status: BillableRowStatus }) {
  const cls =
    status === "current"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
      : status === "future"
        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/15"
        : status === "expired"
          ? "bg-muted text-muted-foreground hover:bg-muted"
          : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-500/15";
  return (
    <Badge
      variant="secondary"
      className={`${cls} whitespace-nowrap px-1.5 py-0 text-[10px]`}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function BillableRowEditor({
  row,
  options,
  showToolKeyCell,
}: {
  row: BillableRowPayload;
  options: SchemeAModelOption[];
  showToolKeyCell: boolean;
}) {
  const [pickingEffectiveEnd, setPickingEffectiveEnd] = useState(false);
  const modelId = row.schemeARefModelKey ?? "";
  const rowHint = schemeMismatchHint(modelId, options);
  const fid = `upd-tool-price-${row.id}`;
  const retailYuanFromDb = row.pricePoints / 100;
  const costDisp = Number.isFinite(row.initialCost)
    ? row.initialCost.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })
    : "—";
  const multDisp = Number.isFinite(row.initialMult)
    ? row.initialMult.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
    : "—";
  const canEditEffectiveTo = row.effectiveTo.trim().length === 0;
  const isCurrent = row.status === "current";
  const dimRow = row.status === "inactive" || row.status === "expired";

  const driftAbs =
    row.cloudCostDriftPercent != null
      ? Math.abs(row.cloudCostDriftPercent)
      : null;
  const driftHigh = driftAbs != null && driftAbs >= 0.01;
  const driftText =
    row.cloudCostDriftPercent != null
      ? `${row.cloudCostDriftPercent > 0 ? "+" : ""}${(row.cloudCostDriftPercent * 100).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}%`
      : null;

  return (
    <tr
      className={
        dimRow
          ? "border-b border-secondary/70 align-middle last:border-0 bg-muted/25 text-muted-foreground hover:bg-muted/30"
          : isCurrent
            ? "border-b border-secondary/70 align-middle last:border-0 hover:bg-muted/20"
            : "border-b border-secondary/70 align-middle last:border-0 hover:bg-muted/20"
      }
    >
      <td className="p-2 align-top">
        {showToolKeyCell ? (
          <span className="break-all font-mono text-xs leading-snug">{row.toolKey}</span>
        ) : (
          <span className="text-xs text-muted-foreground/60">↳</span>
        )}
      </td>
      <td className="p-2 align-top font-mono text-xs">{row.action ?? "—"}</td>
      <td className="p-2 align-top">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="break-all font-mono text-xs" title="不可在此修改；调价请下方「新增定价」">
              {modelId || "—"}
            </span>
            <StatusBadge status={row.status} />
          </div>
          {row.cloudBillingKind ? (
            <div className="text-[10px] leading-snug text-muted-foreground">
              <span className="font-mono">{row.cloudBillingKind}</span>
              {row.cloudTierRaw ? <span> · {row.cloudTierRaw}</span> : null}
            </div>
          ) : null}
          {rowHint ? (
            <p className="max-w-[14rem] text-[11px] leading-snug text-amber-700 dark:text-amber-400">
              {rowHint}
            </p>
          ) : null}
        </div>
      </td>
      <td className="p-2 align-top">
        <div className="flex flex-col gap-0.5 font-mono text-xs tabular-nums">
          <span title="本行落库时的成本快照 (schemeAUnitCostYuan)">
            行：{costDisp}
          </span>
          {row.cloudCostDisplay ? (
            <span
              className={driftHigh ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}
              title={
                row.cloudUnitLabel
                  ? `云厂商当前 (${row.cloudUnitLabel})`
                  : "云厂商当前"
              }
            >
              云：{row.cloudCostDisplay}
              {driftText ? <span className="ml-1">({driftText})</span> : null}
            </span>
          ) : (
            <span className="text-muted-foreground/70">云：—</span>
          )}
        </div>
      </td>
      <td className="p-2 align-top font-mono text-xs tabular-nums text-muted-foreground">{multDisp}</td>
      <td className="p-2 align-top font-mono text-xs tabular-nums text-muted-foreground">
        {retailYuanFromDb.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })}
      </td>
      <td className="p-2 align-top w-[118px] max-w-[118px]">
        <WallDatetimeTwoLines value={row.effectiveFrom} />
      </td>
      <td className="p-2 align-top w-[118px] max-w-[118px]">
        {canEditEffectiveTo ? (
          pickingEffectiveEnd ? (
            <Input
              form={fid}
              name="effectiveTo"
              type="datetime-local"
              defaultValue=""
              className="h-8 w-[9.75rem] max-w-full font-mono text-xs"
              title="北京时间；保存后不可再改"
            />
          ) : (
            <div className="flex flex-col gap-1">
              <WallDatetimeTwoLines value="" />
              <Button
                type="button"
                variant="link"
                className="h-auto self-start p-0 text-xs font-normal leading-none"
                onClick={() => setPickingEffectiveEnd(true)}
              >
                填写
              </Button>
            </div>
          )
        ) : (
          <WallDatetimeTwoLines value={row.effectiveTo} title="已设置生效止，不可修改" />
        )}
      </td>
      <td className="p-2 text-center align-top text-xs whitespace-nowrap">
        {row.active ? "是" : "否"}
      </td>
      <td className="p-2 align-top">
        {canEditEffectiveTo ? (
          <Button type="submit" form={fid} size="sm" className="whitespace-nowrap">
            保存生效止
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

const ALL_STATUSES: BillableRowStatus[] = ["current", "future", "expired", "inactive"];

export function AdminToolBillablePricingClient({
  rowPayloads,
  optionsByKeyJson,
}: {
  rowPayloads: BillableRowPayload[];
  optionsByKeyJson: string;
}) {
  const optionsByKey = useMemo(
    () => JSON.parse(optionsByKeyJson) as Record<string, SchemeAModelOption[]>,
    [optionsByKeyJson],
  );

  const [newTk, setNewTk] = useState("");
  const [newAc, setNewAc] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newMult, setNewMult] = useState("2");

  const newOpts =
    optionsByKey[schemeABillableOptionsKey(newTk, newAc || null)] ?? [];

  const onNewModelInput = (v: string) => {
    setNewModel(v);
    const opt = newOpts.find((o) => o.catalogModelId === v);
    if (opt?.defaultCostYuan != null) setNewCost(String(opt.defaultCostYuan));
  };

  const newRetail = retailYuan(newCost, newMult);
  const newHint = schemeMismatchHint(newModel, newOpts);

  // —— 筛选与搜索 ——
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const allToolKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of rowPayloads) s.add(r.toolKey);
    return Array.from(s).sort();
  }, [rowPayloads]);
  const [tkSel, setTkSel] = useState<Set<string>>(new Set());
  const [stSel, setStSel] = useState<Set<BillableRowStatus>>(
    new Set(ALL_STATUSES),
  );
  const [driftOnly, setDriftOnly] = useState(false);

  const toggleSet = <T,>(prev: Set<T>, v: T) => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const filteredRows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return rowPayloads.filter((r) => {
      if (tkSel.size > 0 && !tkSel.has(r.toolKey)) return false;
      if (!stSel.has(r.status)) return false;
      if (
        driftOnly &&
        !(
          r.cloudCostDriftPercent != null &&
          Math.abs(r.cloudCostDriftPercent) >= 0.01
        )
      )
        return false;
      if (q) {
        const hay = `${r.toolKey} ${r.action ?? ""} ${r.schemeARefModelKey ?? ""} ${r.cloudModelKey ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rowPayloads, tkSel, stSel, driftOnly, deferredQuery]);

  // —— 按 toolKey 分组：保留原顺序，连续相同 toolKey 视为同组；首行单元格显示 toolKey，其余仅显示 ↳ ——
  type Group = { toolKey: string; rows: BillableRowPayload[] };
  const groups = useMemo(() => {
    const out: Group[] = [];
    let cur: Group | null = null;
    for (const r of filteredRows) {
      if (!cur || cur.toolKey !== r.toolKey) {
        cur = { toolKey: r.toolKey, rows: [] };
        out.push(cur);
      }
      cur.rows.push(r);
    }
    return out;
  }, [filteredRows]);

  const groupCurrentCount = (rows: BillableRowPayload[]) =>
    rows.filter((r) => r.status === "current").length;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">不会自动新增</strong>价目库行、sync map 或工具站模型清单；新工具 / 新模型须按{" "}
        <span className="font-medium text-foreground">方案文档 §5.4.6</span>（
        <code className="text-xs">tool-web/doc/product/learning-pricing-solution.md</code>
        ）逐项补齐。
        下表<strong className="text-foreground">已有行</strong>若当前为<strong className="text-foreground">长期有效</strong>（生效止为空），可<strong className="text-foreground">填一次生效止</strong>并保存；已设结束时间的行不可再改。
        「新增」仍支持建议列表与手填参考模型；价目未匹配时请 import/映射或手填成本。
      </p>

      {/* —— 工具栏：搜索 + toolKey 多选 + 状态多选 + 仅漂移 —— */}
      <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[18rem] flex-1">
            <Label htmlFor="bp-search" className="sr-only">
              搜索
            </Label>
            <Input
              id="bp-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索 toolKey / action / 模型 id / cloudModelKey"
              className="h-9 font-mono text-xs"
              spellCheck={false}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={driftOnly}
              onChange={(e) => setDriftOnly(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span>仅看与云厂商成本漂移 ≥ 1%</span>
          </label>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            筛选后 {filteredRows.length} 行 / {groups.length} 个 toolKey
          </span>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">toolKey</span>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant={tkSel.size === 0 ? "secondary" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setTkSel(new Set())}
              >
                全部
              </Button>
              {allToolKeys.map((tk) => {
                const on = tkSel.has(tk);
                return (
                  <Button
                    key={tk}
                    type="button"
                    variant={on ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 px-2 font-mono text-xs"
                    onClick={() => setTkSel((p) => toggleSet(p, tk))}
                  >
                    {tk}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">状态</span>
            <div className="flex flex-wrap gap-1">
              {ALL_STATUSES.map((st) => {
                const on = stSel.has(st);
                return (
                  <Button
                    key={st}
                    type="button"
                    variant={on ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setStSel((p) => toggleSet(p, st))}
                  >
                    {STATUS_LABEL[st]}
                  </Button>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setStSel(new Set(["current"]))}
                title="只看运行时实扣的「当前生效」行"
              >
                仅当前生效
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setStSel(new Set(ALL_STATUSES))}
              >
                全部状态
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden" aria-hidden="true">
        {rowPayloads.map((r) => (
          <form key={`upd-${r.id}`} id={`upd-tool-price-${r.id}`} action={updateToolBillablePrice}>
            <input type="hidden" name="id" value={r.id} />
          </form>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[12rem]">
                toolKey
              </th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground">action</th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground min-w-[16rem]">
                参考模型 · 状态
              </th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[180px]">
                成本(元) — 行 / 云
              </th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[88px]">
                系数 M
              </th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[92px]">
                单价(元)
              </th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[118px] max-w-[118px]">
                生效起
              </th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[118px] max-w-[118px]">
                生效止
              </th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[52px] text-center whitespace-nowrap">
                启用
              </th>
              <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[100px]" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-muted-foreground">
                  {rowPayloads.length === 0
                    ? "暂无定价；请在下方新增。"
                    : "没有匹配当前筛选的行；请清空筛选或切换关键字。"}
                </td>
              </tr>
            ) : (
              groups.flatMap((g) => {
                const head = (
                  <tr
                    key={`grp-${g.toolKey}`}
                    className="border-y border-secondary/80 bg-muted/40"
                  >
                    <td colSpan={10} className="px-2 py-1 text-xs">
                      <span className="font-mono font-semibold text-foreground">
                        {g.toolKey}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {g.rows.length} 行 · 当前生效 {groupCurrentCount(g.rows)}
                      </span>
                    </td>
                  </tr>
                );
                const rows = g.rows.map((r, idx) => (
                  <BillableRowEditor
                    key={`${r.id}-${r.effectiveTo || "long"}`}
                    row={r}
                    options={
                      optionsByKey[schemeABillableOptionsKey(r.toolKey, r.action)] ?? []
                    }
                    showToolKeyCell={idx === 0}
                  />
                ));
                return [head, ...rows];
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-dashed border-secondary bg-muted/20 p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold">新增定价</h3>
        </div>
        <form id="new-tool-price-form" action={createToolBillablePrice} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-toolKey">toolKey</Label>
              <Input
                id="new-toolKey"
                name="toolKey"
                required
                value={newTk}
                onChange={(e) => setNewTk(e.target.value)}
                placeholder="fitting-room__ai-fit（AI智能试衣页）或 text-to-image"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-action">action（可空=通配）</Label>
              <Input
                id="new-action"
                name="action"
                value={newAc}
                onChange={(e) => setNewAc(e.target.value)}
                placeholder="如 try_on、invoke"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>参考模型（sync map catalog；可手填未列出 id）</Label>
              {newOpts.length > 0 ? (
                <div className="space-y-1">
                  <SchemeARefModelCombo
                    name="schemeARefModelKey"
                    value={newModel}
                    onValueChange={onNewModelInput}
                    options={newOpts}
                    inputClassName="font-mono text-sm"
                    placeholder="建议列表或手填，须与工具站 modelId 一致"
                    title="新模型可先行手填：须同步 tool-web 模型 JSON、scheme A catalog、sync map 与价目 import。"
                  />
                  {newHint ? (
                    <p className="text-xs leading-snug text-amber-700 dark:text-amber-400">
                      {newHint}
                    </p>
                  ) : null}
                </div>
              ) : (
                <Input
                  name="schemeARefModelKey"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="自定义模型 id（先填 toolKey+action；未配置方案 A 映射时仅此输入）"
                  className="font-mono text-sm"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-cost">成本（元）</Label>
                <Input
                  id="new-cost"
                  name="schemeAUnitCostYuan"
                  type="number"
                  step="any"
                  min={0}
                  required
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-mult">系数 M</Label>
                <Input
                  id="new-mult"
                  name="schemeAAdminRetailMultiplier"
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  value={newMult}
                  onChange={(e) => setNewMult(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-secondary/80 bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">单价（元，自动）</span>{" "}
            <span className="font-mono tabular-nums font-medium">
              {newRetail >= 0
                ? newRetail.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })
                : "—"}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[11rem] flex-1 space-y-1.5">
              <Label htmlFor="new-from" className="text-xs">
                生效起（北京时间）
              </Label>
              <Input
                id="new-from"
                name="effectiveFrom"
                type="datetime-local"
                required
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="min-w-[11rem] flex-1 space-y-1.5">
              <Label htmlFor="new-to" className="text-xs">
                生效止（留空=长期）
              </Label>
              <Input id="new-to" name="effectiveTo" type="datetime-local" className="h-9 font-mono text-xs" />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <input
                type="checkbox"
                name="active"
                defaultChecked
                className="h-4 w-4 rounded border-input"
                id="new-active"
              />
              <Label htmlFor="new-active" className="whitespace-nowrap text-sm font-normal leading-none">
                启用
              </Label>
            </div>
          </div>

          <div className="flex justify-center pt-1">
            <Button type="submit" variant="subscription" className="min-w-[22rem] px-16">
              添加
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
