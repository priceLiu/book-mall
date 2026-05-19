/**
 * v003 模型校准（Model Catalog / ModelAlias）—— 公共接口入口。
 *
 * 目标：把"主站 toolKey/schemeARefModelKey"、"价目 modelKey"、"云 CSV 商品Code/计费项Code/规格"等
 * 各种"模型字串"统一映射到一个 `canonicalKey`（标准模型名），全站对账与 UI 以此为聚合主键。
 *
 * 该模块只导出函数，不依赖任何 React 框架，便于在 server actions / scripts / API 复用。
 */

export {
  suggestAliasMatches,
  ingestCandidateAliases,
  type CandidateAlias,
  type SuggestResult,
} from "./suggest";

export {
  upsertModelCatalogWithAliases,
  setAliasCatalog,
  detachAlias,
  type UpsertModelCatalogInput,
} from "./mutations";

export { canonicalKeyForAlias, canonicalKeysByAliases } from "./resolve";

export { listModelCatalogs, listPendingAliases, calibrationKpi } from "./queries";

export {
  runFullAutoCalibration,
  autoBindPendingAliases,
  type AutoCalibrateResult,
} from "./auto-calibrate";
