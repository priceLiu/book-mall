"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { toolActionToLabelZh } from "@/lib/tool-action-label";
import styles from "./price-list.module.css";

export type BillablePriceRow = {
  id: string;
  toolKey: string;
  action: string;
  pricePoints: number;
  yuan: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
};

export type VisualLabAnalysisSchemeARow = {
  modelId: string;
  title: string;
  pricePoints: number;
  yuan: number;
  note: string;
};

export type ToolsSchemeARow = {
  segment: string;
  lineId: string;
  title: string;
  pricePoints: number;
  yuan: number;
  note: string;
};

const TOOLS_SCHEME_SEGMENT_LABEL: Record<string, string> = {
  aiTryOn: "AI 试衣",
  textToImage: "文生图",
  imageToVideo: "视频合成（图生 / 文生 / 参考生）",
};

export function PriceListClient() {
  const [rows, setRows] = useState<BillablePriceRow[] | null>(null);
  const [analysisSchemeA, setAnalysisSchemeA] = useState<VisualLabAnalysisSchemeARow[] | null>(
    null,
  );
  const [toolsSchemeA, setToolsSchemeA] = useState<ToolsSchemeARow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/tool-billable-prices", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await r.json().catch(() => null)) as
        | {
            prices?: BillablePriceRow[];
            analysisSchemeA?: VisualLabAnalysisSchemeARow[];
            toolsSchemeA?: ToolsSchemeARow[];
            error?: string;
          }
        | null;
      if (!r.ok) {
        setRows(null);
        setAnalysisSchemeA(null);
        setToolsSchemeA(null);
        setError(typeof data?.error === "string" ? data.error : `请求失败（${r.status}）`);
        return;
      }
      const list = Array.isArray(data?.prices) ? data!.prices! : [];
      const analysis = Array.isArray(data?.analysisSchemeA) ? data!.analysisSchemeA! : [];
      const tools = Array.isArray(data?.toolsSchemeA) ? data!.toolsSchemeA! : [];
      setRows(list);
      setAnalysisSchemeA(analysis.length > 0 ? analysis : null);
      setToolsSchemeA(tools.length > 0 ? tools : null);
    } catch {
      setRows(null);
      setAnalysisSchemeA(null);
      setToolsSchemeA(null);
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="tw-muted">加载价格表…</p>;
  }

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        {error}
        <button
          type="button"
          className="tw-mt-2 tw-block tw-text-sm tw-underline"
          onClick={() => void load()}
        >
          重试
        </button>
      </div>
    );
  }

  if (!rows?.length && !analysisSchemeA?.length && !toolsSchemeA?.length) {
    return (
      <p className="tw-muted">
        暂未配置生效中的按次单价。请稍后在主站「工具管理 → 按次单价」或工具站分析室配置维护后刷新本页。
      </p>
    );
  }

  return (
    <>
      {analysisSchemeA && analysisSchemeA.length > 0 ? (
        <div className="tw-mb-10">
          <h2 className="tw-mb-3 tw-text-base tw-font-semibold tw-text-[var(--tool-text)]">
            视觉实验室 · 分析室（方案 A · 按所选模型）
          </h2>
          <p className={`tw-mb-4 tw-text-sm ${styles.noteCell}`}>
            单次扣费由工具站按官网中国内地首档价（元 / 百万 Token）与约定等价用量折算后与实扣一致；见{" "}
            <Link href="/visual-lab/analysis">分析室</Link>。
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">模型</th>
                  <th scope="col">单次（点）</th>
                  <th scope="col">单次（人民币）</th>
                  <th scope="col">说明</th>
                </tr>
              </thead>
              <tbody>
                {analysisSchemeA.map((p) => (
                  <tr key={p.modelId}>
                    <td>
                      <div className="tw-font-medium tw-text-[var(--tool-text)]">{p.title}</div>
                      <div className={`${styles.noteCell} tw-mt-0.5 ${styles.mono}`}>{p.modelId}</div>
                    </td>
                    <td className={styles.mono}>
                      {Math.max(0, Math.floor(p.pricePoints)).toLocaleString("zh-CN")}
                    </td>
                    <td className={styles.mono}>¥{p.yuan.toFixed(2)}</td>
                    <td className={styles.noteCell}>{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {toolsSchemeA && toolsSchemeA.length > 0 ? (
        <div className="tw-mb-10">
          <h2 className="tw-mb-3 tw-text-base tw-font-semibold tw-text-[var(--tool-text)]">
            AI 试衣 / 文生图 / 视频（方案 A）
          </h2>
          <p className={`tw-mb-4 tw-text-sm ${styles.noteCell}`}>
            扣费由工具站按「中国内地官网价目 × 约定计量（张 / 秒）× 系数」计算后，经{" "}
            <code className={styles.mono}>costPoints</code> 上报主站；与下方主站过期行不同步属正常。
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">场景</th>
                  <th scope="col">说明</th>
                  <th scope="col">参考（点）</th>
                  <th scope="col">参考（人民币）</th>
                  <th scope="col">备注</th>
                </tr>
              </thead>
              <tbody>
                {toolsSchemeA.map((p) => (
                  <tr key={p.lineId}>
                    <td className="tw-font-medium tw-text-[var(--tool-text)]">
                      {TOOLS_SCHEME_SEGMENT_LABEL[p.segment] ?? p.segment}
                    </td>
                    <td>
                      <div className="tw-font-medium tw-text-[var(--tool-text)]">{p.title}</div>
                    </td>
                    <td className={styles.mono}>
                      {Math.max(0, Math.floor(p.pricePoints)).toLocaleString("zh-CN")}
                    </td>
                    <td className={styles.mono}>¥{p.yuan.toFixed(2)}</td>
                    <td className={styles.noteCell}>{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {rows?.length ? (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">产品 / 工具</th>
              <th scope="col">计费动作</th>
              <th scope="col">单价（点）</th>
              <th scope="col">单价（人民币）</th>
              <th scope="col">说明</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="tw-font-medium tw-text-[var(--tool-text)]">
                    {toolKeyToLabel(p.toolKey)}
                  </div>
                  <div className={`${styles.noteCell} tw-mt-0.5 ${styles.mono}`}>{p.toolKey}</div>
                </td>
                <td>{toolActionToLabelZh(p.action)}</td>
                <td className={styles.mono}>
                  {Math.max(0, Math.floor(p.pricePoints)).toLocaleString("zh-CN")}
                </td>
                <td className={styles.mono}>¥{(p.pricePoints / 100).toFixed(2)}</td>
                <td className={styles.noteCell}>{p.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : null}
      <p className={styles.footerNote}>
        主站表内为其它工具仍生效的「工具管理 → 按次单价」行；分析室与试衣 / 文生图 / 视频以方案 A
        列表及实扣为准。规则见{" "}
        <Link href="/app-history/plan-rules">计费规则说明</Link>。
      </p>
    </>
  );
}
