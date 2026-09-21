/** 详情页套图 · 助手会话区任务状态（对齐故事版 StoryboardTaskStatus） */

export type DetailPageSuiteBusyStatus = {
  title: string;
  detail: string;
  /** 生图 / LLM 长任务扫光 */
  sweep?: boolean;
};

export function suiteBusyStatusForChoice(message: string): DetailPageSuiteBusyStatus {
  const trimmed = message.trim();
  if (trimmed === "AI识图抽卖点") {
    return {
      title: "识图抽卖点中",
      detail: "视觉模型正在从产品图抽取卖点，完成后写入卖点清单…",
      sweep: true,
    };
  }
  if (trimmed === "AI润色卖点") {
    return {
      title: "润色卖点中",
      detail: "LLM 正在优化卖点文案，完成后可继续手填或确认…",
      sweep: true,
    };
  }
  if (trimmed === "生成全部提示词") {
    return {
      title: "生成提示词中",
      detail: "LLM 正在按模块逐批撰写出图提示词，进度见下方状态…",
      sweep: true,
    };
  }
  if (trimmed === "生成全部图片") {
    return {
      title: "详情页出图中",
      detail: "Gateway 图像任务批量进行中，完成后写入中栏各模块槽位…",
      sweep: true,
    };
  }
  if (trimmed.startsWith("手填卖点")) {
    return {
      title: "录入卖点",
      detail: "正在写入手填卖点并同步会话…",
    };
  }
  if (trimmed.startsWith("选择模板·")) {
    return {
      title: "载入套图模板",
      detail: "正在复制模板模块与子维度池到当前项目…",
    };
  }
  return {
    title: "处理中",
    detail: "正在同步会话与项目配置…",
  };
}

export function suiteBusyStatusForUpload(count: number): DetailPageSuiteBusyStatus {
  return {
    title: "上传产品图中",
    detail:
      count > 1
        ? `正在上传 ${count} 张产品图至 OSS 并写入参考图…`
        : "正在上传产品图至 OSS 并写入参考图…",
    sweep: true,
  };
}

export function suiteBusyStatusForModulePrompts(moduleName?: string): DetailPageSuiteBusyStatus {
  return {
    title: "生成本模块提示词",
    detail: moduleName
      ? `LLM 正在为「${moduleName}」撰写出图提示词…`
      : "LLM 正在为本模块子维度撰写出图提示词…",
    sweep: true,
  };
}

export function suiteBusyStatusForAllPrompts(): DetailPageSuiteBusyStatus {
  return suiteBusyStatusForChoice("生成全部提示词");
}

export function suiteBusyStatusForSlotRewrite(moduleName?: string): DetailPageSuiteBusyStatus {
  return {
    title: "重写提示词中",
    detail: moduleName
      ? `LLM 正在重写「${moduleName}」单条出图提示词…`
      : "LLM 正在重写单条出图提示词…",
    sweep: true,
  };
}

export function suiteBusyStatusForModuleImages(opts?: {
  moduleName?: string;
  slotCount?: number;
}): DetailPageSuiteBusyStatus {
  const { moduleName, slotCount = 1 } = opts ?? {};
  if (slotCount <= 1) {
    return {
      title: "单张出图中",
      detail: moduleName
        ? `Gateway 图像任务进行中（${moduleName}），完成后写入中栏…`
        : "Gateway 图像任务进行中，完成后写入中栏槽位…",
      sweep: true,
    };
  }
  return {
    title: moduleName ? `${moduleName} 出图中` : "模块出图中",
    detail: `Gateway 图像任务进行中（约 ${slotCount} 张），完成后写入中栏…`,
    sweep: true,
  };
}

export function suiteBusyStatusForAllImages(slotCount?: number): DetailPageSuiteBusyStatus {
  if (slotCount && slotCount > 1) {
    return {
      title: "详情页出图中",
      detail: `Gateway 图像任务批量进行中（约 ${slotCount} 张），完成后写入中栏各模块槽位…`,
      sweep: true,
    };
  }
  return suiteBusyStatusForChoice("生成全部图片");
}
