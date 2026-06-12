/**
 * 三视图 · 写入生图 prompt 与 LLM 角色外观约束（真源）
 * book-mall/lib/canvas/three-view-prompt-rules.ts 须与本文件语义保持同步
 */

/** 生图 · 构图 / 背景 / 限制（中文，嵌入三视图引擎默认 prompt） */
export const THREE_VIEW_IMAGE_RULES_ZH = `【视角数量 · 硬性要求】
- 整张图 **仅三个** 视角：正面、侧面、背面各 **恰好一个**，从左到右等距排列
- **禁止**重复同一视角（例如两个正面、两个侧面）；**禁止**第四个视角或多余人物副本

【构图硬性要求】
- 每个视角均为全身立绘（头顶至脚底完整入画，禁止半身或截断）
- 正面视角：人物正面朝向镜头，自然站立，双臂自然下垂或微张，视线正视前方
- 侧面、背面同为全身，站姿与正面一致
- 画面横向构图，三视图等距排列

【版式 · 禁止项】
- **禁止**每个视角外加矩形边框、分格线、箭头、标注线或 UI 装饰
- **禁止**任何文字：标题、角色名、视角标签（如 FRONT VIEW / 正面 / 侧面 / 背面）、底部说明、水印
- 角色直接呈现在纯白底上，三视图之间仅用间距区分，无框线

【无遮挡 · 硬性要求】
- 三视角中头、脸、躯干、四肢须 **完整可见**，禁止任何物体或肢体遮挡身体轮廓
- **禁止**手触脸、手扶眼镜/口罩/头发等挡脸动作；双手不得抬至面部及以上
- **禁止**手持、腋下夹持、怀抱任何物件（含书本、文件夹、道具、武器、包袋等）
- 仅允许 **穿戴在身上** 的服饰与饰品（如眼镜可戴在脸上，但不可用手去扶/调整）

【背景】纯白底（#FFFFFF），禁止场景、渐变、地面线、投影道具

【限制项】可佩戴与服装搭配的饰品、首饰、眼镜等；**禁止**背包、手提包、单肩包、斜挎包及任何背/提在身上的包袋`;

/** LLM 写角色「外观 / 外貌」列时的约束（中文，嵌入 character-engine prompt） */
export const THREE_VIEW_APPEARANCE_LLM_RULE_ZH =
  "不含场景与大型道具，不写画风；可描述服装与 **穿戴** 饰品，但**禁止**背包/手提包等包袋、**禁止**手持或夹持物件（含书本、文件夹、道具）、**禁止**扶眼镜/触脸等挡脸动作描述（下游三视图为白底全身无遮挡 turnaround，仅正面/侧面/背面各一，无分格边框与文字标签）";

export const THREE_VIEW_ENGINE_PROMPT_INTRO_ZH =
  "生成角色标准三视图 turnaround sheet：同一张图内从左到右并排展示 **恰好三个** 视角——正面、侧面、背面各一个，清晰人设原画稿，三视角角色比例与服饰完全一致；禁止重复视角、禁止分格边框与文字标注";

export const THREE_VIEW_ENGINE_PROMPT_STYLE_ZH = `风格：二次元、写实、卡通、赛博、古风（择一或融合）
体型、服饰、发型、配色、立绘规格须与角色设定一致`;

/** 三视图引擎节点 / 角色列行 · 默认生图 prompt 前缀 */
export const THREE_VIEW_ENGINE_PROMPT_DEFAULT = [
  THREE_VIEW_ENGINE_PROMPT_INTRO_ZH,
  THREE_VIEW_IMAGE_RULES_ZH,
  THREE_VIEW_ENGINE_PROMPT_STYLE_ZH,
].join("\n\n");

/** 定稿拆分 · 角色列每行 prompt */
export function formatCharacterRowThreeViewPrompt(c: {
  name: string;
  role: string;
  appearance: string;
}): string {
  return `${THREE_VIEW_ENGINE_PROMPT_DEFAULT}\n\n角色：${c.name}\n定位：${c.role}\n外观：${c.appearance}`;
}

/** 大纲批量创建三视图节点 */
export function formatBatchThreeViewPrompt(c: {
  name: string;
  role: string;
  appearance: string;
}): string {
  return `${THREE_VIEW_ENGINE_PROMPT_DEFAULT}\n\n【角色】${c.name}（${c.role}）\n【外观】${c.appearance}`;
}
