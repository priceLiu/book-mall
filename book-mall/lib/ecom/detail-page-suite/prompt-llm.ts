import { z } from "zod";

import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import { assertSuiteCounts } from "./parse";
import { getDetailPageSuiteProject, updateDetailPageSuiteProject } from "./project-service";
import {
  BLANK_PLATE_MODULE_IDS,
  DETAIL_PAGE_SUITE_FENCE,
  DETAIL_PAGE_SUITE_SCHEMA_VERSION,
  ECOM_DETAIL_PAGE_SUITE_TOOL_KEY,
  type DetailPageSuiteSlot,
} from "./types";

const ItemSchema = z.object({
  item_key: z.string().optional(),
  item_label: z.string().min(1),
  positive_prompt: z.string().min(8),
});

const ModulePromptSchema = z.object({
  schemaVersion: z.string().optional(),
  module_id: z.string(),
  items: z.array(ItemSchema).min(1),
});

function extractFenceJson(text: string): unknown {
  const fence = new RegExp("```" + DETAIL_PAGE_SUITE_FENCE + "\\s*([\\s\\S]*?)```", "i");
  const m = text.match(fence);
  const raw = (m?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("大模型未返回有效 JSON");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

function buildSystemPrompt(opts: {
  moduleName: string;
  blankPlate: boolean;
  lang: string;
}): string {
  const langLine =
    opts.lang.includes("英") || opts.lang.toLowerCase().startsWith("en")
      ? "输出提示词使用英文。"
      : "输出提示词使用中文。";
  const blank = opts.blankPlate
    ? "本模块是留白底板：画面内禁止出现任何文字、数字、表格、logo 字、水印。"
    : "";
  return `你的任务：根据传入参数生成电商服装生图正向提示词。
硬性规则：
1. 只允许使用【selected_item_list】里的项目，严禁自行创造列表以外的拍摄部位、姿势、场景。每一条对应列表中的一项。
2. 只做摄影层面润色：构图、光影、微距、景深、质感。不修改核心拍摄主体。
3. 每条须按该子维度区分景别/光位/构图，禁止多条复制粘贴只换主语。
4. 风格：电商商业摄影，写实照片，8K超清，影棚柔和布光，主体清晰对焦，简洁背景，无水印，画面内不出现任何文字。
5. 禁止 3D、插画、手绘、卡通、二次元。
6. ${blank}
7. ${langLine}
8. 必须只输出一个围栏，围栏名为 ${DETAIL_PAGE_SUITE_FENCE}，内为 JSON 对象，不要解释。
JSON 形状：
{
  "schemaVersion": "${DETAIL_PAGE_SUITE_SCHEMA_VERSION}",
  "module_id": "当前模块 id",
  "items": [
    { "item_key": "短英文key", "item_label": "必须与选中子维度原文一致", "positive_prompt": "完整正向提示词" }
  ]
}`;
}

export async function generateModulePrompts(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  modelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteProject>>>> {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const countErr = assertSuiteCounts(project.suite);
  if (countErr) throw new Error(countErr);

  const mod = project.suite.modules.find((m) => m.module_id === opts.moduleId);
  if (!mod || !mod.enable || mod.generate_count < 1) {
    throw new Error("该模块未开启");
  }
  let selected = mod.selected_item_list.slice(0, mod.generate_count);
  if (selected.length < mod.generate_count) {
    const extra = mod.candidate_pool.filter((x) => !selected.includes(x));
    selected = [...selected, ...extra].slice(0, mod.generate_count);
  }
  if (selected.length !== mod.generate_count) {
    throw new Error(`${mod.module_name} 请先选满 ${mod.generate_count} 个子维度`);
  }

  const modelKey = opts.modelKey?.trim() || project.settings.chatModelKey || ECOM_DEFAULT_VISION_MODEL;
  const brief = project.brief ?? {};
  const lang = brief.outputLanguage ?? "中文";
  const system = buildSystemPrompt({
    moduleName: mod.module_name,
    blankPlate: BLANK_PLATE_MODULE_IDS.has(mod.module_id),
    lang,
  });
  const user = [
    `商品描述：${brief.productDesc ?? ""}`,
    `商品卖点：${(brief.sellPoints ?? []).map((s) => s.text).join("，")}`,
    `目标平台：${brief.platform ?? brief.platformCode ?? ""}`,
    `输出语言：${lang}`,
    `当前模块：${mod.module_id} ${mod.module_name}`,
    `N：${mod.generate_count}`,
    `selected_item_list：${JSON.stringify(selected)}`,
  ].join("\n");

  let lastErr = "生成失败";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(opts.userId, opts.projectId, `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__chat`),
      });
      const parsed = ModulePromptSchema.parse(extractFenceJson(text));
      if (parsed.module_id !== mod.module_id && parsed.items.length !== selected.length) {
        /* allow module_id drift if counts match */
      }
      if (parsed.items.length !== selected.length) {
        throw new Error(`返回条数 ${parsed.items.length} 不等于 ${selected.length}`);
      }
      const slots: DetailPageSuiteSlot[] = parsed.items.map((item, i) => {
        const label = selected[i]!;
        if (!item.item_label.includes(label.slice(0, 4)) && !label.includes(item.item_label.slice(0, 4))) {
          if (!item.positive_prompt.includes(label.slice(0, 4))) {
            throw new Error(`第 ${i + 1} 条未覆盖子维度「${label}」`);
          }
        }
        const prev = mod.slots[i];
        return {
          item_key: item.item_key?.trim() || `item_${i + 1}`,
          item_label: label,
          source: "template",
          positive_prompt: item.positive_prompt.trim(),
          imageUrl: prev?.imageUrl,
          assetId: prev?.assetId,
          imageHistory: prev?.imageHistory,
          activeImageIndex: prev?.activeImageIndex,
          selectedForImage: prev?.selectedForImage ?? true,
        };
      });
      const modules = project.suite.modules.map((m) =>
        m.module_id === mod.module_id
          ? { ...m, selected_item_list: selected, slots }
          : m,
      );
      const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
        suite: { ...project.suite, modules },
        meta: { ...(project.meta ?? {}), phase: "prompts" },
      });
      if (!updated) throw new Error("保存失败");
      return updated;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

export async function rewriteSlotPrompt(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  slotKey: string;
  modelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteProject>>>> {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const mod = project.suite.modules.find((m) => m.module_id === opts.moduleId);
  if (!mod) throw new Error("模块不存在");
  const slot = mod.slots.find((s) => s.item_key === opts.slotKey);
  if (!slot) throw new Error("该条提示词不存在");

  const modelKey = opts.modelKey?.trim() || project.settings.chatModelKey || ECOM_DEFAULT_VISION_MODEL;
  const brief = project.brief ?? {};
  const lang = brief.outputLanguage ?? "中文";
  const system = buildSystemPrompt({
    moduleName: mod.module_name,
    blankPlate: BLANK_PLATE_MODULE_IDS.has(mod.module_id),
    lang,
  });
  const user = [
    `只重写这一条子维度的提示词，禁止改拍摄主体。`,
    `商品描述：${brief.productDesc ?? ""}`,
    `商品卖点：${(brief.sellPoints ?? []).map((s) => s.text).join("，")}`,
    `目标平台：${brief.platform ?? brief.platformCode ?? ""}`,
    `当前模块：${mod.module_id} ${mod.module_name}`,
    `N：1`,
    `selected_item_list：${JSON.stringify([slot.item_label])}`,
    `当前提示词（仅作参考，请按同一主体重写，不要照抄）：${slot.positive_prompt}`,
  ].join("\n");

  let lastErr = "重写失败";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(opts.userId, opts.projectId, `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__chat`),
      });
      const parsed = ModulePromptSchema.parse(extractFenceJson(text));
      const item = parsed.items[0];
      if (!item?.positive_prompt.trim()) throw new Error("未返回提示词");
      const modules = project.suite.modules.map((m) =>
        m.module_id === mod.module_id
          ? {
              ...m,
              slots: m.slots.map((s) =>
                s.item_key === slot.item_key
                  ? { ...s, positive_prompt: item.positive_prompt.trim(), promptEdited: false }
                  : s,
              ),
            }
          : m,
      );
      const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
        suite: { ...project.suite, modules },
      });
      if (!updated) throw new Error("保存失败");
      return updated;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

export async function generateAllEnabledPrompts(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}) {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  let latest = project;
  for (const m of project.suite.modules.filter((x) => x.enable && x.generate_count > 0)) {
    latest = await generateModulePrompts({
      userId: opts.userId,
      projectId: opts.projectId,
      moduleId: m.module_id,
      modelKey: opts.modelKey,
    });
  }
  return latest;
}
