import {
  ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX,
  type DetailPageSuiteBrief,
  type DetailPageSuiteChatMessage,
  type DetailPageSuiteMeta,
  type DetailPageSuiteModuleDef,
  type DetailPageSuiteModuleState,
  type DetailPageSuiteReference,
  type DetailPageSuiteSettings,
  type DetailPageSuiteSlot,
  type DetailPageSuiteState,
  type DetailPageSuiteTemplateDto,
} from "./types";

export function parseModulesJson(raw: unknown): DetailPageSuiteModuleDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const module_id = String(o.module_id ?? "").trim();
      const module_name = String(o.module_name ?? "").trim();
      if (!module_id || !module_name) return null;
      const pool = Array.isArray(o.candidate_pool)
        ? o.candidate_pool.map((x) => String(x).trim()).filter(Boolean)
        : [];
      const max_num = Math.max(1, Math.round(Number(o.max_num) || 1));
      return {
        module_id,
        module_name,
        required: o.required === true,
        max_num,
        candidate_pool: pool,
      } satisfies DetailPageSuiteModuleDef;
    })
    .filter((x): x is DetailPageSuiteModuleDef => Boolean(x));
}

export function sanitizeReferences(raw: unknown): DetailPageSuiteReference[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const ossUrl = String(o.ossUrl ?? "").trim();
      if (!ossUrl) return null;
      return {
        id: String(o.id ?? ossUrl),
        label: String(o.label ?? "产品图"),
        role: "product" as const,
        ossUrl,
      };
    })
    .filter((x): x is DetailPageSuiteReference => Boolean(x));
}

export function sanitizeChat(raw: unknown): DetailPageSuiteChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const role = o.role === "assistant" ? "assistant" : "user";
      const content = String(o.content ?? "");
      if (!content) return null;
      return {
        id: String(o.id ?? `m-${Date.now()}`),
        role,
        content,
        createdAt: String(o.createdAt ?? new Date().toISOString()),
      };
    })
    .filter((x): x is DetailPageSuiteChatMessage => Boolean(x));
}

export function emptySuite(): DetailPageSuiteState {
  return { modules: [] };
}

export function suiteFromTemplate(template: DetailPageSuiteTemplateDto): DetailPageSuiteState {
  return {
    templateId: template.id,
    templateSnapshot: template,
    modules: template.modules.map((m) => ({
      module_id: m.module_id,
      module_name: m.module_name,
      enable: true,
      generate_count: m.max_num,
      max_num: m.max_num,
      select_mode: "manual",
      candidate_pool: [...m.candidate_pool],
      selected_item_list: [...m.candidate_pool].slice(0, m.max_num),
      slots: [],
    })),
  };
}

export function parseSuite(raw: unknown): DetailPageSuiteState {
  if (!raw || typeof raw !== "object") return emptySuite();
  const o = raw as Record<string, unknown>;
  const modules = Array.isArray(o.modules)
    ? o.modules.flatMap((item): DetailPageSuiteModuleState[] => {
        if (!item || typeof item !== "object") return [];
        const m = item as Record<string, unknown>;
        const module_id = String(m.module_id ?? "").trim();
        if (!module_id) return [];
        const max_num = Math.max(1, Math.round(Number(m.max_num) || 1));
        const generate_count = Math.max(0, Math.round(Number(m.generate_count) || 0));
        const selected = Array.isArray(m.selected_item_list)
          ? m.selected_item_list.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const pool = Array.isArray(m.candidate_pool)
          ? m.candidate_pool.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const slots = Array.isArray(m.slots)
          ? m.slots.flatMap((s): DetailPageSuiteSlot[] => {
              if (!s || typeof s !== "object") return [];
              const slot = s as Record<string, unknown>;
              const item_label = String(slot.item_label ?? "").trim();
              if (!item_label) return [];
              return [
                {
                  item_key: String(slot.item_key ?? item_label),
                  item_label,
                  source: slot.source === "user" ? "user" : "template",
                  positive_prompt: String(slot.positive_prompt ?? ""),
                  imageUrl: typeof slot.imageUrl === "string" ? slot.imageUrl : undefined,
                  assetId: typeof slot.assetId === "string" ? slot.assetId : undefined,
                  promptEdited: slot.promptEdited === true,
                },
              ];
            })
          : [];
        return [
          {
            module_id,
            module_name: String(m.module_name ?? module_id),
            enable: m.enable !== false && generate_count > 0,
            generate_count,
            max_num,
            select_mode: m.select_mode === "random" ? "random" : "manual",
            candidate_pool: pool,
            selected_item_list: selected,
            slots,
          },
        ];
      })
    : [];
  return {
    templateId: typeof o.templateId === "string" ? o.templateId : undefined,
    templateSnapshot:
      o.templateSnapshot && typeof o.templateSnapshot === "object"
        ? (o.templateSnapshot as DetailPageSuiteTemplateDto)
        : null,
    modules,
  };
}

export function parseBrief(raw: unknown): DetailPageSuiteBrief | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as DetailPageSuiteBrief;
}

export function parseSettings(raw: unknown): DetailPageSuiteSettings {
  if (!raw || typeof raw !== "object") return {};
  return raw as DetailPageSuiteSettings;
}

export function parseMeta(raw: unknown): DetailPageSuiteMeta | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as DetailPageSuiteMeta;
}

export function enabledGenerateTotal(suite: DetailPageSuiteState): number {
  return suite.modules
    .filter((m) => m.enable)
    .reduce((n, m) => n + Math.max(0, m.generate_count), 0);
}

export function assertSuiteCounts(suite: DetailPageSuiteState): string | null {
  const enabled = suite.modules.filter((m) => m.enable && m.generate_count > 0);
  if (enabled.length === 0) return "请至少开启 1 个模块并设置生成张数";
  const total = enabledGenerateTotal(suite);
  if (total > ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX) {
    return `全部开启模块合计不能超过 ${ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX} 张`;
  }
  for (const m of enabled) {
    if (m.generate_count > m.max_num) {
      return `${m.module_name} 最多 ${m.max_num} 张`;
    }
  }
  return null;
}
