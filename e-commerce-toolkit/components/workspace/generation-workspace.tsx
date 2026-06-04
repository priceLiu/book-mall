"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import type { EcomModuleDef } from "@/lib/modules/registry";
import {
  deleteAsset,
  fetchBillableEstimate,
  fetchBillingMode,
  generateImage,
  generateVideo,
  listAssets,
  type EcomAsset,
  type EcomBillingMode,
} from "@/lib/ecom-api";
import { cn } from "@/lib/utils";

export function GenerationWorkspace({ module }: { module: EcomModuleDef }) {
  const { confirm, doubleConfirm, alert } = useDialogs();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<EcomAsset[]>([]);
  const [billingMode, setBillingMode] = useState<EcomBillingMode | null>(null);
  const [estimatePts, setEstimatePts] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [items, mode] = await Promise.all([
      listAssets(module.id),
      fetchBillingMode(),
    ]);
    setAssets(items);
    setBillingMode(mode);
    if (mode === "PLATFORM_METERED") {
      const pts = await fetchBillableEstimate(
        module.toolKey,
        module.action,
      ).catch(() => null);
      setEstimatePts(pts);
    }
  }, [module]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [load]);

  async function handleGenerate() {
    if (!prompt.trim()) {
      await alert({ title: "提示", message: "请先填写创作描述" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (module.kind === "video") {
        await generateVideo({
          toolKey: module.toolKey,
          action: module.action,
          prompt: prompt.trim(),
          module: module.id,
          durationSec: 5,
        });
      } else {
        await generateImage({
          toolKey: module.toolKey,
          action: module.action,
          prompt: prompt.trim(),
          module: module.id,
          estimatedPoints: estimatePts ?? undefined,
        });
      }
      setPrompt("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      setError(msg);
      await alert({ title: "生成失败", message: msg, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(asset: EcomAsset) {
    const label = asset.title ?? "本条资产";
    if (
      !(await confirm({
        title: "删除资产",
        message: `确定从我的资产库删除「${label}」？`,
        variant: "destructive",
      }))
    ) {
      return;
    }
    if (
      !(await doubleConfirm({
        title: "再次确认",
        message: "此操作不可恢复。",
        secondTitle: "不可恢复",
        secondMessage:
          "删除后库记录将移除；若文件在云端存储（OSS）将尝试一并删除。",
        confirmLabel: "确认删除",
      }))
    ) {
      return;
    }
    try {
      await deleteAsset(asset.id);
      await load();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  const billingHint =
    billingMode === "PLATFORM_METERED"
      ? estimatePts != null
        ? `代付按次 · 预估约 ${estimatePts} 点/次`
        : "代付按次 · 按挂牌价×2 扣点"
      : "自备 Key + 月费 · 生成不扣点";

  return (
    <div className="mx-auto max-w-[980px] px-6 py-12">
      <Link href="/" className="text-sm text-[var(--ecom-primary)]">
        ← 返回首页
      </Link>
      <h1 className="mt-4 text-[40px] font-semibold tracking-tight">{module.title}</h1>
      <p className="mt-2 text-[17px] text-[var(--ecom-muted)]">{module.tagline}</p>
      <p className="mt-1 text-xs text-[var(--ecom-muted)]">{billingHint}</p>

      <div className="mt-8 rounded-[18px] border border-[var(--ecom-hairline)] bg-white p-6">
        <label className="block text-sm font-semibold">创作描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="mt-2 w-full resize-y rounded-xl border border-[var(--ecom-hairline)] p-3 text-[17px] outline-none focus:border-[var(--ecom-primary)]"
          placeholder="描述商品、风格、镜头与卖点…"
        />
        {error ? (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        ) : null}
        <div className="mt-4 max-w-[270px]">
          <EcomButtonPrimary
            fullWidth
            altLabel="生成中…"
            flipActive={busy}
            disabled={busy}
            onClick={handleGenerate}
          >
            生成
          </EcomButtonPrimary>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">本模块资产</h2>
        {assets.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--ecom-muted)]">暂无作品，生成后将显示在这里。</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {assets.map((a) => (
              <li
                key={a.id}
                className="overflow-hidden rounded-[18px] border border-[var(--ecom-hairline)] bg-white"
              >
                <div className="relative aspect-square bg-[var(--ecom-parchment)]">
                  {a.kind === "image" ? (
                    <Image
                      src={a.thumbnailUrl ?? a.ossUrl}
                      alt={a.title ?? ""}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <video
                      src={a.ossUrl}
                      controls
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-4">
                  <span className="truncate text-sm">{a.title ?? "未命名"}</span>
                  <button
                    type="button"
                    className={cn("text-sm text-red-600")}
                    onClick={() => handleDelete(a)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
