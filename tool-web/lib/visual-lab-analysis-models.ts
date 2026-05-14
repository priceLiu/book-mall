/**
 * 视觉实验室 · 分析室模型清单：`config/visual-lab-analysis-models.json`
 * 默认模型由 `defaults.analysisModel` 指定（须存在于 `models`）；未配置时取列表第一项。
 */
import raw from "@/config/visual-lab-analysis-models.json";

export type VisualLabAnalysisModelOption = {
  id: string;
  apiModel: string;
  title: string;
  description: string;
  icon: string;
};

type FileShape = {
  defaults?: { analysisModel?: unknown };
  models: unknown;
};

function resolveDefaultId(
  models: VisualLabAnalysisModelOption[],
  configured: unknown,
): string {
  if (typeof configured === "string" && configured.trim()) {
    const id = configured.trim();
    if (!models.some((m) => m.id === id)) {
      throw new Error(
        `config/visual-lab-analysis-models.json · defaults.analysisModel "${id}" must match a models[].id`,
      );
    }
    return id;
  }
  return models[0]!.id;
}

function parseModels(list: unknown): VisualLabAnalysisModelOption[] {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`config/visual-lab-analysis-models.json · "models" must be a non-empty array`);
  }
  const out: VisualLabAnalysisModelOption[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== "object") {
      throw new Error(`config/visual-lab-analysis-models.json · models[${i}] must be an object`);
    }
    const o = item as Record<string, unknown>;
    const id = o.id;
    const apiModel = o.apiModel;
    const title = o.title;
    const description = o.description;
    const icon = o.icon;
    if (
      typeof id !== "string" ||
      typeof apiModel !== "string" ||
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof icon !== "string"
    ) {
      throw new Error(
        `config/visual-lab-analysis-models.json · models[${i}] needs string fields id, apiModel, title, description, icon`,
      );
    }
    out.push({ id, apiModel, title, description, icon });
  }
  return out;
}

const file = raw as FileShape;

export const VISUAL_LAB_ANALYSIS_MODELS = parseModels(file.models);

export const DEFAULT_VISUAL_LAB_ANALYSIS_MODEL_ID = resolveDefaultId(
  VISUAL_LAB_ANALYSIS_MODELS,
  file.defaults?.analysisModel,
);

const byId = new Map(VISUAL_LAB_ANALYSIS_MODELS.map((m) => [m.id, m] as const));

export function getVisualLabAnalysisModelById(
  id: string,
): VisualLabAnalysisModelOption | undefined {
  return byId.get(id);
}

const byApi = new Map(
  VISUAL_LAB_ANALYSIS_MODELS.map((m) => [m.apiModel, m] as const),
);

export function getVisualLabAnalysisModelByApiModel(
  apiModel: string,
): VisualLabAnalysisModelOption | undefined {
  const k = apiModel.trim();
  return k ? byApi.get(k) : undefined;
}
