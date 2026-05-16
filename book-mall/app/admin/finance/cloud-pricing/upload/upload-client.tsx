"use client";

import { useState, useTransition } from "react";
import { Check, Download, Upload, X, AlertTriangle, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  analyzeUploadAction,
  importUploadAction,
  type AnalyzeResult,
} from "./actions";

const CANONICAL_COLS = [
  "region",
  "model_key",
  "tier_raw",
  "billing_kind",
  "input_yuan_per_million",
  "output_yuan_per_million",
  "cost_json",
] as const;

const KIND_PRESETS = [
  { value: "aliyun", label: "阿里云" },
  { value: "tencent", label: "腾讯云" },
  { value: "volc", label: "火山引擎 / Doubao" },
  { value: "zhipu", label: "智谱 AI" },
  { value: "moonshot", label: "Moonshot / Kimi" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "baidu", label: "百度文心" },
  { value: "csv", label: "通用 CSV" },
];

export function CloudPricingUploadClient() {
  const [csvText, setCsvText] = useState("");
  const [aliasesText, setAliasesText] = useState("");
  const [vendorKind, setVendorKind] = useState("aliyun");
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [pending, startTransition] = useTransition();

  /** 二次确认状态：null | 1 | 2，2 时点击「确认导入」即真正提交 */
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [importResult, setImportResult] = useState<
    | { ok: true; versionId: string; rowCount: number }
    | { ok: false; error: string }
    | null
  >(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const txt = reader.result;
      if (typeof txt === "string") {
        setCsvText(txt);
        setResult(null);
        setImportResult(null);
        setConfirmStep(0);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function analyze() {
    setImportResult(null);
    setConfirmStep(0);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("csv", csvText);
      fd.set("aliases", aliasesText);
      const r = await analyzeUploadAction(fd);
      setResult(r);
    });
  }

  function downloadCanonical() {
    if (!result || !result.ok || !result.canonicalCsv) return;
    const blob = new Blob([result.canonicalCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pricing-canonical-${vendorKind}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function tryImport() {
    if (confirmStep === 0) {
      setConfirmStep(1);
      return;
    }
    if (confirmStep === 1) {
      setConfirmStep(2);
      return;
    }
    // confirmStep === 2 → submit
    startTransition(async () => {
      const fd = new FormData();
      fd.set("csv", csvText);
      fd.set("aliases", aliasesText);
      fd.set("vendorKind", vendorKind);
      fd.set("label", label);
      fd.set("confirm", "yes");
      fd.set("confirm2", "yes");
      const r = await importUploadAction(fd);
      setImportResult(r);
      setConfirmStep(0);
    });
  }

  function loadSample() {
    const sample = [
      "region,model_key,tier_raw,billing_kind,input_yuan_per_million,output_yuan_per_million,cost_json",
      "china_mainland,qwen3-plus,—,TOKEN_IN_OUT,0.4,1.2,",
      "china_mainland,wan2.6,720P,VIDEO_MODEL_SPEC,,,\"{\"\"perSecondYuan\"\":0.3}\"",
    ].join("\n");
    setCsvText(sample);
    setResult(null);
    setImportResult(null);
    setConfirmStep(0);
  }

  const canImport =
    result?.ok &&
    result.canonicalCsv &&
    !result.parseError &&
    result.header.missingCanonical.length === 0;

  return (
    <div className="space-y-5">
      {/* 1. 输入区 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. 粘贴或上传 CSV</CardTitle>
          <CardDescription className="text-xs">
            支持 阿里云 / 腾讯云 / 火山 / 智谱 / Moonshot / 百度 等常见表头别名；
            未识别时可在「列别名补丁」里追加 <code>{"{\"原表头\":\"canonical_name\"}"}</code>。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">厂商 / 源类型</label>
              <select
                value={vendorKind}
                onChange={(e) => setVendorKind(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {KIND_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}（{p.value}）
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">版本标签（可选）</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="例：阿里云 2026-05 导入"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">CSV 内容</label>
              <div className="flex items-center gap-2">
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => document.getElementById("csv-file")?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  选择文件
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={loadSample}
                  className="text-xs"
                >
                  示例
                </Button>
              </div>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setResult(null);
                setImportResult(null);
                setConfirmStep(0);
              }}
              rows={10}
              placeholder="粘贴 CSV 文本；首行为表头。"
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              列别名补丁（可选，JSON）
            </label>
            <Input
              value={aliasesText}
              onChange={(e) => setAliasesText(e.target.value)}
              placeholder='{"产品名":"model_key","计费方式":"billing_kind"}'
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={analyze} disabled={!csvText.trim() || pending}>
              {pending ? "分析中…" : "分析表头与数据"}
            </Button>
            {result?.ok && result.canonicalCsv ? (
              <Button variant="outline" onClick={downloadCanonical}>
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                下载规范 CSV
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 2. 分析结果 */}
      {result == null ? (
        <Card className="border-dashed bg-card/40">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Info className="mx-auto mb-2 h-5 w-5 opacity-60" aria-hidden />
            粘贴 CSV → 点「分析表头与数据」即可看到识别报告与导入按钮。
          </CardContent>
        </Card>
      ) : !result.ok ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex gap-3 py-5">
            <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-destructive">分析失败</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <AnalyzeReport
          result={result}
          confirmStep={confirmStep}
          onTryImport={tryImport}
          onCancelConfirm={() => setConfirmStep(0)}
          canImport={Boolean(canImport)}
          pending={pending}
          importResult={importResult}
          onClearImportResult={() => setImportResult(null)}
        />
      )}
    </div>
  );
}

function AnalyzeReport({
  result,
  confirmStep,
  onTryImport,
  onCancelConfirm,
  canImport,
  pending,
  importResult,
  onClearImportResult,
}: {
  result: Extract<AnalyzeResult, { ok: true }>;
  confirmStep: 0 | 1 | 2;
  onTryImport: () => void;
  onCancelConfirm: () => void;
  canImport: boolean;
  pending: boolean;
  importResult:
    | { ok: true; versionId: string; rowCount: number }
    | { ok: false; error: string }
    | null;
  onClearImportResult: () => void;
}) {
  const { header, rowCount, sampleRows, parseError, canonicalCsv } = result;
  const allOk = header.missingCanonical.length === 0 && !parseError;

  return (
    <div className="space-y-4">
      {/* 表头识别 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">2. 表头识别</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                已识别 {header.recognized.length}
              </Badge>
              {header.unrecognized.length > 0 ? (
                <Badge variant="outline" className="text-[10px]">
                  未识别 {header.unrecognized.length}
                </Badge>
              ) : null}
              {header.missingCanonical.length > 0 ? (
                <Badge variant="destructive" className="text-[10px]">
                  缺失 {header.missingCanonical.length}
                </Badge>
              ) : null}
            </div>
          </div>
          <CardDescription className="text-xs">
            识别共 {header.rawHeaders.length} 列；规范列必须 7 项齐全才能导入。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 必需列状态 */}
          <div className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
            {CANONICAL_COLS.map((col) => {
              const hit = header.recognized.find((h) => h.canonical === col);
              return (
                <div
                  key={col}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                    hit
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-destructive/40 bg-destructive/5 text-destructive",
                  )}
                >
                  {hit ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <X className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <code className="text-[11px]">{col}</code>
                  {hit ? (
                    <span className="ml-auto truncate text-muted-foreground" title={hit.raw}>
                      ← {hit.raw}
                    </span>
                  ) : (
                    <span className="ml-auto text-[10px]">缺失</span>
                  )}
                </div>
              );
            })}
          </div>
          {header.unrecognized.length > 0 ? (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
              <p className="mb-1 font-medium text-foreground">
                未识别表头（将被忽略）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {header.unrecognized.map((h) => (
                  <code
                    key={h}
                    className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {h}
                  </code>
                ))}
              </div>
              <p className="mt-2 text-muted-foreground">
                若其中包含规范字段（如阿里云的「输入价格(元/百万Tokens)」），可在「列别名补丁」里追加 <code>{`{"原表头":"input_yuan_per_million"}`}</code> 重试。
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 数据预览 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">3. 数据预览</CardTitle>
          <CardDescription className="text-xs">
            共 {rowCount} 行数据；下表展示前 8 行（裁短显示，按原顺序）。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  {header.rawHeaders.map((h, i) => {
                    const canon = header.recognized.find((r) => r.raw === h)?.canonical;
                    return (
                      <th
                        key={`${h}-${i}`}
                        className="whitespace-nowrap border-b border-border bg-muted/40 px-2.5 py-2 text-left font-medium"
                      >
                        <div className="text-foreground">{h}</div>
                        {canon ? (
                          <code className="text-[10px] text-emerald-600 dark:text-emerald-500">
                            → {canon}
                          </code>
                        ) : (
                          <code className="text-[10px] text-muted-foreground">忽略</code>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    {row.map((c, j) => (
                      <td
                        key={j}
                        className="max-w-[260px] truncate border-b border-border/60 px-2.5 py-1.5 text-foreground"
                        title={c}
                      >
                        {c || <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {parseError ? (
        <Card className="border-amber-400/40 bg-amber-50 dark:bg-amber-500/10">
          <CardContent className="flex gap-3 py-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                数据解析未通过
              </p>
              <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
                {parseError}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : allOk ? (
        <Card className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/5">
          <CardContent className="flex gap-3 py-5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                表头识别完整 · 数据解析通过
              </p>
              <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                可下载规范 CSV 备份，或直接导入并设为当前生效版本。
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 导入区 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">4. 导入并设为当前生效版本</CardTitle>
          <CardDescription className="text-xs">
            导入会创建新的 <code className="text-foreground">PricingSourceVersion</code> 并把它设为 <code className="text-foreground">isCurrent=true</code>；
            原 current 自动降为「历史」。CSV 行按 fingerprint 与现有库合并（同 fingerprint 覆盖，其余保留）。
            <strong className="ml-1 text-foreground">不可一键回滚 — 请确认。</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canImport ? (
            <p className="text-sm text-muted-foreground">
              请先满足：表头 7 列齐全 + 数据解析通过，才能导入。
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {confirmStep === 0 ? (
              <Button onClick={onTryImport} disabled={!canImport || pending}>
                导入到数据库
              </Button>
            ) : confirmStep === 1 ? (
              <>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  第 1 次确认：导入后<strong>不可一键回滚</strong>，旧版本仍保留为历史。继续吗？
                </p>
                <Button onClick={onTryImport} variant="destructive" size="sm">
                  继续
                </Button>
                <Button onClick={onCancelConfirm} variant="ghost" size="sm">
                  取消
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-destructive">
                  第 2 次确认：现在执行导入并设为 current。
                </p>
                <Button
                  onClick={onTryImport}
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                >
                  {pending ? "导入中…" : "确认导入"}
                </Button>
                <Button onClick={onCancelConfirm} variant="ghost" size="sm" disabled={pending}>
                  取消
                </Button>
              </>
            )}
          </div>

          {importResult ? (
            importResult.ok ? (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">
                  导入成功 · versionId={" "}
                  <code className="text-foreground">
                    {importResult.versionId.slice(0, 12)}…
                  </code>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  合并后共 {importResult.rowCount} 行；已设为当前生效版本。
                  <a
                    href={`/admin/finance/cloud-pricing/${importResult.versionId}`}
                    className="ml-2 text-primary hover:underline"
                  >
                    查看明细 →
                  </a>
                </p>
                <button
                  type="button"
                  onClick={onClearImportResult}
                  className="mt-1 text-[10px] text-muted-foreground hover:underline"
                >
                  关闭
                </button>
              </div>
            ) : (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                <p className="font-medium text-destructive">导入失败</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{importResult.error}</p>
                <button
                  type="button"
                  onClick={onClearImportResult}
                  className="mt-1 text-[10px] text-muted-foreground hover:underline"
                >
                  关闭
                </button>
              </div>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
