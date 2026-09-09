/** 试衣底图 · 时尚简约完整穿搭（上装 + 下装均可见，非内衣/背心） */
export const VTon_MODEL_OUTFIT_SPEC = [
  "穿着时尚简约的日常休闲装，完整可见上装与下装：",
  "上装为纯色圆领短袖 T 恤或轻薄针织衫，修身合体，非背心、非内衣、非吊带；",
  "下装为深蓝色或黑色直筒牛仔裤或休闲长裤，长度及踝、轮廓清晰；脚穿简约白色运动鞋或纯色休闲鞋，鞋面完整可见；",
  "配色协调中性（如白 T 配深蓝牛仔，或米色针织配黑裤），干净利落的电商试衣素模风格；",
  "无外套、无叠穿、无配饰、无手持物。",
].join("");

/** 模特试衣 · 单人全身底图 · 固定构图（白底 · 一次生成一张） */
export const VTon_MODEL_FULL_BODY_COMPOSITION_SPEC = [
  "高质量电商虚拟试衣底图，竖向 9:16 长构图，纯白色纯净背景，中性摄影棚平光。",
  "单人站立正面完整全身照：头顶、躯干、双腿、双脚与鞋子必须全部在画面内，留出足尖下方少量留白。",
  "双臂自然下垂或微张，角色必须空手；自然妆容与发型；平视镜头。",
  "禁止半身照、禁止裁切脚踝或脚部、禁止看不到鞋子。",
  "不得出现文字、水印、标签、多人物、复杂背景、道具或环境场景。",
].join("");

/** AI 文生全身模特 · 默认 Prompt */
export const VTon_DEFAULT_MODEL_GENERATE_PROMPT = [
  "电商虚拟试衣用素模，自然妆容与发型。",
  VTon_MODEL_OUTFIT_SPEC,
  `构图规范：${VTon_MODEL_FULL_BODY_COMPOSITION_SPEC}`,
].join("\n");

/** 头像/半身 → 全身 · 身份与妆照光线保留（勿与文生全身共用棚拍平光） */
export const VTon_FULL_BODY_EXPAND_IDENTITY_SPEC = [
  "以参考图为唯一人物依据，输出同一人、同一造型的全身试衣底图。",
  "面部与头部必须像素级继承参考图：五官比例与位置、脸型轮廓、眉形、眼型、鼻型、唇形、下颌线、耳朵位置均不得改变；禁止换脸、禁止 AI 美颜、禁止重新绘制面部。",
  "妆照应完整保留参考图：底妆质感、腮红位置与浓淡、眼影色系与晕染边界、眼线粗细、睫毛、唇色与唇妆质地、高光与修容层次，均与参考图一致，不得改妆或素颜化。",
  "发型完整保留：发色、发量、刘海、分缝、卷发/直发、碎发与发丝走向与参考图一致，不得换发型或改发色。",
  "肤色与皮肤细节保留：自然肤质、毛孔与纹理、痣/雀斑等特征须保留；禁止过度磨皮、塑料感、蜡像感。",
  "光线与曝光须继承参考图：主光方向、色温、明暗对比、面部高光与阴影分布、眼神光与轮廓光与参考图保持一致；仅向下延伸补全躯干与腿部时，光影须与参考图上半身自然衔接，禁止整体重打光或 flatten 成统一棚拍平光。",
  "仅补全参考图中未出现的身体部分（躯干、双臂、双腿、鞋），已可见的头部与上半身不得改动身份与妆造。",
].join("");

/** 头像/半身 → 全身 · 构图（白底试衣，但不覆盖参考图人物光效） */
export const VTon_FULL_BODY_EXPAND_COMPOSITION_SPEC = [
  "高质量电商虚拟试衣底图，竖向 9:16 长构图，纯白色纯净背景。",
  "单人站立正面完整全身照：头顶、躯干、双腿、双脚与鞋子必须全部在画面内，留出足尖下方少量留白。",
  "双臂自然下垂或微张，角色必须空手；平视镜头。",
  "禁止半身照、禁止裁切脚踝或脚部、禁止看不到鞋子。",
  "不得出现文字、水印、标签、多人物、复杂背景、道具或环境场景。",
].join("");

/** 头像/半身 → 全身 · 主体模板 */
export const VTon_FULL_BODY_EXPAND_PROMPT_ZH = [
  VTon_FULL_BODY_EXPAND_IDENTITY_SPEC,
  VTon_MODEL_OUTFIT_SPEC,
  `构图规范：${VTon_FULL_BODY_EXPAND_COMPOSITION_SPEC}`,
].join("\n");

export const VTon_FULL_BODY_EXPAND_NEGATIVE_ZH = [
  "换脸，变脸，不同人物，身份改变，AI 美颜，过度磨皮，蜡像脸，塑料皮肤，丢失细节，模糊面部",
  "妆容改变，改妆，素颜化，唇色改变，眼妆改变，眉形改变，肤色偏差，色温改变，光线不一致，重新打光，统一平光，flatten 光影",
  "发型改变，发色改变，发量改变，刘海改变",
  "人脸变形，五官错位，肢体畸形，手部崩坏，复杂背景，水印，文字，多人物，四视图，多视角拼接",
  "背心，吊带，内衣，文胸，运动内衣，比基尼，大面积裸露，露脐",
  "复杂叠穿，宽袍大袖，长裙拖地，厚重外套",
].join("，");

export function buildVtonFullBodyExpandPrompt(userPrompt?: string): string {
  const extra = userPrompt?.trim();
  if (!extra) return VTon_FULL_BODY_EXPAND_PROMPT_ZH;
  return `${VTon_FULL_BODY_EXPAND_PROMPT_ZH}\n${extra}`;
}

export function buildVtonModelGeneratePrompt(userPrompt?: string): string {
  const text = userPrompt?.trim();
  return text || VTon_DEFAULT_MODEL_GENERATE_PROMPT;
}
