"use client";

import * as echarts from "echarts";
import { useEffect, useRef } from "react";

export type CockpitChartDatum = { label: string; value: number };

export type CockpitTrendDatum = { date: string; value: number };

function isDarkTheme() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

function axisColors(isDark: boolean) {
  return {
    axis: isDark ? "#a1a1aa" : "#656d76",
    split: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    tooltipBg: isDark ? "rgba(24,24,27,0.92)" : "rgba(255,255,255,0.96)",
    tooltipBorder: isDark ? "#3f3f46" : "#d1d9e0",
  };
}

function horizontalGradient(isDark: boolean): echarts.graphic.LinearGradient {
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: isDark ? "#6366f1" : "#818cf8" },
    { offset: 0.55, color: isDark ? "#38bdf8" : "#0ea5e9" },
    { offset: 1, color: isDark ? "#22d3ee" : "#0284c7" },
  ]);
}

function verticalGradient(isDark: boolean): echarts.graphic.LinearGradient {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: isDark ? "#a78bfa" : "#8b5cf6" },
    { offset: 0.5, color: isDark ? "#6366f1" : "#6366f1" },
    { offset: 1, color: isDark ? "#4338ca" : "#4f46e5" },
  ]);
}

function useEchartsHost(
  dataLength: number,
  paint: (chart: echarts.EChartsType, isDark: boolean) => void,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  useEffect(() => {
    const el = hostRef.current;
    if (!el || dataLength === 0) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(el, undefined, { renderer: "canvas" });
    }
    const chart = chartRef.current;

    const run = () => paintRef.current(chart, isDarkTheme());

    run();

    const mo = new MutationObserver(run);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);

    return () => {
      mo.disconnect();
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [dataLength]);

  return hostRef;
}

/** 用户与身份 · 横向柱状图 */
export function AdminCockpitHorizontalBarChart({ data }: { data: CockpitChartDatum[] }) {
  const hostRef = useEchartsHost(data.length, (chart, isDark) => {
    const colors = axisColors(isDark);
    const labels = data.map((d) => d.label);
    const values = data.map((d) => d.value);

    chart.setOption(
      {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: colors.tooltipBg,
          borderColor: colors.tooltipBorder,
          textStyle: { color: isDark ? "#fafafa" : "#1f2328" },
          formatter: (params: unknown) => {
            const list = Array.isArray(params) ? params : [params];
            const first = list[0] as { name?: string; value?: number } | undefined;
            if (!first) return "";
            return `${first.name ?? ""}<br/>${(first.value ?? 0).toLocaleString("zh-CN")} 人`;
          },
        },
        grid: { left: "2%", right: "8%", bottom: "2%", top: "4%", containLabel: true },
        xAxis: {
          type: "value",
          minInterval: 1,
          axisLine: { show: false },
          axisLabel: { color: colors.axis },
          splitLine: { lineStyle: { type: "dashed", color: colors.split } },
        },
        yAxis: {
          type: "category",
          data: labels,
          inverse: true,
          axisLine: { lineStyle: { color: colors.axis } },
          axisTick: { show: false },
          axisLabel: { color: colors.axis, fontSize: 12, width: 96, overflow: "truncate" },
        },
        series: [
          {
            type: "bar",
            data: values,
            barMaxWidth: 22,
            itemStyle: {
              color: horizontalGradient(isDark),
              borderRadius: [0, 8, 8, 0],
              shadowBlur: isDark ? 10 : 6,
              shadowColor: "rgba(99, 102, 241, 0.25)",
            },
            label: {
              show: true,
              position: "right",
              color: colors.axis,
              formatter: ({ value }: { value?: number }) =>
                (value ?? 0).toLocaleString("zh-CN"),
            },
          },
        ],
      },
      true,
    );
  });

  if (data.length === 0) return <ChartEmpty />;
  return <div ref={hostRef} className="h-[260px] w-full min-w-0" />;
}

/** 积分与计费 · 竖向柱状图 */
export function AdminCockpitVerticalBarChart({ data }: { data: CockpitChartDatum[] }) {
  const hostRef = useEchartsHost(data.length, (chart, isDark) => {
    const colors = axisColors(isDark);
    const labels = data.map((d) => d.label);
    const values = data.map((d) => d.value);

    chart.setOption(
      {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: colors.tooltipBg,
          borderColor: colors.tooltipBorder,
          textStyle: { color: isDark ? "#fafafa" : "#1f2328" },
          formatter: (params: unknown) => {
            const list = Array.isArray(params) ? params : [params];
            const first = list[0] as { name?: string; value?: number } | undefined;
            if (!first) return "";
            return `${first.name ?? ""}<br/>${(first.value ?? 0).toLocaleString("zh-CN")} 点`;
          },
        },
        grid: { left: "2%", right: "2%", bottom: "2%", top: "12%", containLabel: true },
        xAxis: {
          type: "category",
          data: labels,
          axisLine: { lineStyle: { color: colors.axis } },
          axisTick: { lineStyle: { color: colors.axis } },
          axisLabel: {
            interval: 0,
            rotate: labels.some((l) => l.length > 5) ? 22 : 0,
            fontSize: 11,
            color: colors.axis,
          },
        },
        yAxis: {
          type: "value",
          minInterval: 1,
          axisLine: { show: false },
          axisLabel: {
            color: colors.axis,
            formatter: (v: number) =>
              v >= 10000 ? `${Math.round(v / 1000) / 10}万` : String(v),
          },
          splitLine: { lineStyle: { type: "dashed", color: colors.split } },
        },
        series: [
          {
            type: "bar",
            data: values,
            barMaxWidth: 52,
            itemStyle: {
              color: verticalGradient(isDark),
              borderRadius: [8, 8, 2, 2],
              shadowBlur: isDark ? 12 : 8,
              shadowColor: "rgba(99, 102, 241, 0.28)",
            },
            emphasis: {
              itemStyle: { shadowBlur: 18, shadowColor: "rgba(139, 92, 246, 0.45)" },
            },
          },
        ],
      },
      true,
    );
  });

  if (data.length === 0) return <ChartEmpty />;
  return <div ref={hostRef} className="h-[300px] w-full min-w-0" />;
}

/** 积分消耗 · 折线趋势图 */
export function AdminCockpitLineChart({ data }: { data: CockpitTrendDatum[] }) {
  const hostRef = useEchartsHost(data.length, (chart, isDark) => {
    const colors = axisColors(isDark);
    const dates = data.map((d) => d.date.slice(5));
    const values = data.map((d) => d.value);

    chart.setOption(
      {
        tooltip: {
          trigger: "axis",
          backgroundColor: colors.tooltipBg,
          borderColor: colors.tooltipBorder,
          textStyle: { color: isDark ? "#fafafa" : "#1f2328" },
          formatter: (params: unknown) => {
            const list = Array.isArray(params) ? params : [params];
            const first = list[0] as { axisValue?: string; value?: number; dataIndex?: number } | undefined;
            if (!first) return "";
            const fullDate = data[first.dataIndex ?? 0]?.date ?? first.axisValue ?? "";
            return `${fullDate}<br/>消耗 ${(first.value ?? 0).toLocaleString("zh-CN")} 点`;
          },
        },
        grid: { left: "2%", right: "3%", bottom: "2%", top: "14%", containLabel: true },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: dates,
          axisLine: { lineStyle: { color: colors.axis } },
          axisLabel: { color: colors.axis, fontSize: 11 },
        },
        yAxis: {
          type: "value",
          minInterval: 1,
          axisLine: { show: false },
          axisLabel: {
            color: colors.axis,
            formatter: (v: number) =>
              v >= 10000 ? `${Math.round(v / 1000) / 10}万` : String(v),
          },
          splitLine: { lineStyle: { type: "dashed", color: colors.split } },
        },
        series: [
          {
            type: "line",
            smooth: 0.35,
            symbol: "circle",
            symbolSize: 7,
            data: values,
            lineStyle: {
              width: 3,
              color: isDark ? "#38bdf8" : "#0284c7",
              shadowColor: "rgba(14, 165, 233, 0.35)",
              shadowBlur: 8,
            },
            itemStyle: {
              color: isDark ? "#7dd3fc" : "#0ea5e9",
              borderColor: isDark ? "#0c4a6e" : "#fff",
              borderWidth: 2,
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: isDark ? "rgba(56, 189, 248, 0.35)" : "rgba(14, 165, 233, 0.28)" },
                { offset: 1, color: isDark ? "rgba(56, 189, 248, 0.02)" : "rgba(14, 165, 233, 0.02)" },
              ]),
            },
          },
        ],
      },
      true,
    );
  });

  if (data.length === 0) return <ChartEmpty />;
  return <div ref={hostRef} className="h-[280px] w-full min-w-0" />;
}

function ChartEmpty() {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-[#d1d9e0] bg-[#f6f8fa] text-sm text-[#656d76]">
      暂无数据
    </div>
  );
}
