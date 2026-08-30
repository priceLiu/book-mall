import { getProVerticalConfig } from "@/lib/pro-vertical/registry";
import type { DimensionStepDef, ProVerticalId } from "@/lib/pro-vertical/types";
import { FASHION_DIMENSION_STEPS } from "@/lib/fashion-dimensions";

export function getDimensionSteps(vertical: ProVerticalId): DimensionStepDef[] {
  return getProVerticalConfig(vertical)?.dimensionSteps ?? [...FASHION_DIMENSION_STEPS];
}

export function proDimensionPrompt(vertical: ProVerticalId, stepIndex: number): string {
  const steps = getDimensionSteps(vertical);
  const step = steps[stepIndex];
  if (!step) return "请选择参数";
  if (step.freeText) {
    const hint =
      vertical === "bags" ? "通勤、出差、旅行" : "都市通勤、周末露营";
    return `请输入${step.label}（如：${hint}）`;
  }
  return `请选择${step.label}`;
}

export function proDimensionStepProgress(vertical: ProVerticalId, stepIndex: number): string {
  const steps = getDimensionSteps(vertical);
  if (stepIndex < 0 || stepIndex >= steps.length) return "";
  return `${stepIndex + 1}/${steps.length}`;
}

const POST_DIMENSION_USER_MESSAGES = new Set([
  "AI自动生成卖点",
  "确认卖点清单",
  "重新生成口播文案",
  "重新生成卖点",
  "确认分镜，生成运营包",
  "重新选择分镜版本",
  "重新生成分镜",
  "分镜脚本交付",
  "故事版一键成片",
  "已上传产品图",
]);

function isDimensionReviseMessage(text: string): boolean {
  return text.trim().startsWith("修改七维·");
}

function parseDimensionReviseStepIndex(text: string, vertical: ProVerticalId): number | null {
  if (!isDimensionReviseMessage(text)) return null;
  const label = text.trim().slice("修改七维·".length);
  const idx = getDimensionSteps(vertical).findIndex((s) => s.label === label);
  return idx >= 0 ? idx : null;
}

function isPostDimensionUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (POST_DIMENSION_USER_MESSAGES.has(trimmed)) return true;
  if (trimmed.startsWith("选择口播")) return true;
  if (trimmed.startsWith("选择分镜")) return true;
  if (trimmed.startsWith("fashion-step:")) return true;
  if (trimmed.startsWith("pro-step:")) return true;
  return false;
}

export type ProDimensionMessageLabel = {
  label: string;
  stepIndex: number;
  progress: string;
};

export function buildProDimensionMessageLabels(
  vertical: ProVerticalId,
  messages: Array<{ id: string; role: string; content: string }>,
): Map<string, ProDimensionMessageLabel> {
  const steps = getDimensionSteps(vertical);
  const labels = new Map<string, ProDimensionMessageLabel>();
  let dimStep = 0;
  let awaitingCustom = false;

  for (const m of messages) {
    if (m.role !== "user") continue;
    const trimmed = m.content.trim();
    if (!trimmed || trimmed === "已上传产品图") continue;

    const reviseStep = parseDimensionReviseStepIndex(trimmed, vertical);
    if (reviseStep != null) {
      dimStep = reviseStep;
      awaitingCustom = false;
      continue;
    }

    if (dimStep >= steps.length) break;
    if (isPostDimensionUserMessage(trimmed)) break;

    const step = steps[dimStep]!;
    const progress = proDimensionStepProgress(vertical, dimStep);

    if (trimmed === "自定义") {
      labels.set(m.id, { label: `${step.label} · 自定义`, stepIndex: dimStep, progress });
      awaitingCustom = true;
      continue;
    }

    if (awaitingCustom) {
      labels.set(m.id, { label: step.label, stepIndex: dimStep, progress });
      awaitingCustom = false;
      dimStep++;
      continue;
    }

    labels.set(m.id, { label: step.label, stepIndex: dimStep, progress });
    dimStep++;
  }

  return labels;
}

export function buildProDimensionsFromChat(
  vertical: ProVerticalId,
  messages: Array<{ role: string; content: string }>,
): Partial<Record<string, string>> {
  const steps = getDimensionSteps(vertical);
  const dimensions: Partial<Record<string, string>> = {};
  let dimStep = 0;
  let awaitingCustom = false;

  for (const m of messages) {
    if (m.role !== "user") continue;
    const trimmed = m.content.trim();
    if (!trimmed || trimmed === "已上传产品图") continue;

    const reviseStep = parseDimensionReviseStepIndex(trimmed, vertical);
    if (reviseStep != null) {
      dimStep = reviseStep;
      awaitingCustom = false;
      for (let i = reviseStep; i < steps.length; i++) {
        delete dimensions[steps[i]!.key];
      }
      continue;
    }

    if (dimStep >= steps.length) break;
    if (isPostDimensionUserMessage(trimmed)) break;

    const step = steps[dimStep]!;
    if (trimmed === "自定义") {
      awaitingCustom = true;
      continue;
    }
    if (awaitingCustom) {
      dimensions[step.key] = trimmed;
      awaitingCustom = false;
      dimStep++;
      continue;
    }
    dimensions[step.key] = trimmed;
    dimStep++;
  }
  return dimensions;
}

export function mergeProDimensionSources(
  vertical: ProVerticalId,
  ...sources: Array<Partial<Record<string, string>> | undefined>
): Partial<Record<string, string>> {
  const steps = getDimensionSteps(vertical);
  const next: Partial<Record<string, string>> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const step of steps) {
      const value = source[step.key]?.trim();
      if (value) next[step.key] = value;
    }
  }
  return next;
}
