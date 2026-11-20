import type { TemplateCatalog } from "./model-template-catalog";
import { modelKeysForTemplate } from "./model-template-catalog";

/**
 * 场景模板目录（t2i/i2i）与节点白名单取并集。
 * 避免目录未绑定 4.5/5.5 时把画布已开放的 Seedream 挡掉。
 */
export function resolveDockAllowedModelKeys(input: {
  sceneTemplateId?: string;
  catalog: TemplateCatalog | null;
  allowedModelKeys?: readonly string[];
}): readonly string[] | undefined {
  const fromTemplate = input.sceneTemplateId
    ? modelKeysForTemplate(input.catalog, input.sceneTemplateId)
    : [];
  const fromCaller = input.allowedModelKeys ?? [];
  if (fromTemplate.length > 0 && fromCaller.length > 0) {
    return [...new Set([...fromTemplate, ...fromCaller])];
  }
  if (fromTemplate.length > 0) return fromTemplate;
  if (fromCaller.length > 0) return fromCaller;
  return undefined;
}