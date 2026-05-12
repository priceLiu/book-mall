"use client";

import * as echarts from "echarts";
import { useEffect, useRef } from "react";

export type ToolUsageBarDatum = { label: string; count: number };

function barFill(isDark: boolean): echarts.graphic.LinearGradient {
  return new echarts.graphic.LinearGradient(
    0,
    0,
    0,
    1,
    isDark
      ? [
          { offset: 0, color: "#93c5fd" },
          { offset: 0.45, color: "#38bdf8" },
          { offset: 1, color: "#0ea5e9" },
        ]
      : [
          { offset: 0, color: "#7dd3fc" },
          { offset: 0.5, color: "#0284c7" },
          { offset: 1, color: "#0369a1" },
        ],
  );
}

/**
 * 管理后台概览：各工具入账流水条数柱状图（ECharts）。
 * 柱体使用亮色系渐变，在深色主题下仍清晰可见。
 */
export function AdminToolUsageBarChart({ data }: { data: ToolUsageBarDatum[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const el = hostRef.current;
    if (!el || data.length === 0) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(el, undefined, { renderer: "canvas" });
    }
    const chart = chartRef.current;

    const paint = () => {
      const d = dataRef.current;
      if (d.length === 0) return;

      const isDark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");

      const labels = d.map((x) => x.label);
      const counts = d.map((x) => x.count);
      const axisColor = isDark ? "#a1a1aa" : "#52525b";
      const splitLine = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

      chart.setOption(
        {
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params: unknown) => {
              const list = Array.isArray(params) ? params : [params];
              const first = list[0] as { name?: string; value?: number } | undefined;
              if (!first) return "";
              return `${first.name ?? ""}<br/>次数：${first.value ?? 0}`;
            },
          },
          grid: {
            left: "2%",
            right: "2%",
            bottom: "2%",
            top: "10%",
            containLabel: true,
          },
          xAxis: {
            type: "category",
            data: labels,
            axisLine: { lineStyle: { color: axisColor } },
            axisTick: { lineStyle: { color: axisColor } },
            axisLabel: {
              interval: 0,
              rotate: labels.some((l) => l.length > 6) ? 28 : 0,
              fontSize: 11,
              color: axisColor,
            },
          },
          yAxis: {
            type: "value",
            minInterval: 1,
            axisLine: { show: false },
            axisLabel: { color: axisColor },
            splitLine: {
              lineStyle: { type: "dashed", color: splitLine },
            },
          },
          series: [
            {
              name: "使用次数",
              type: "bar",
              data: counts,
              barMaxWidth: 48,
              itemStyle: {
                color: barFill(isDark),
                borderRadius: [6, 6, 2, 2],
                shadowBlur: isDark ? 12 : 8,
                shadowColor: isDark
                  ? "rgba(56, 189, 248, 0.35)"
                  : "rgba(2, 132, 199, 0.22)",
              },
              emphasis: {
                itemStyle: {
                  shadowBlur: 18,
                  shadowColor: "rgba(56, 189, 248, 0.55)",
                },
              },
            },
          ],
        },
        true,
      );
    };

    paint();

    const mo = new MutationObserver(() => paint());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const ro = new ResizeObserver(() => {
      chart.resize();
    });
    ro.observe(el);

    return () => {
      mo.disconnect();
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [data]);

  return <div ref={hostRef} className="h-[280px] w-full min-w-0" />;
}
