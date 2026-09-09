/** 试衣底图 · 时尚简约完整穿搭（上装 + 下装均可见，非内衣/背心） */
export const VTon_MODEL_OUTFIT_SPEC = [
  "穿着时尚简约的日常休闲装，完整可见上装与下装：",
  "上装为纯色圆领短袖 T 恤或轻薄针织衫，合身剪裁、不过度贴身，衣摆常规长度至腰线或髋骨、不遮大腿，非背心、非内衣、非吊带；",
  "下装为深蓝色或黑色直筒牛仔裤或休闲长裤，长度及踝、轮廓清晰；脚穿简约白色运动鞋或纯色休闲鞋，鞋面完整可见；",
  "配色协调中性（如白 T 配深蓝牛仔，或米色针织配黑裤），干净利落的电商试衣素模风格；",
  "无外套、无叠穿、无配饰、无手持物。",
].join("");

/** 电商试衣底图 · 轻微自然站姿（非僵硬 T-pose，非红毯大动作） */
export const VTon_MODEL_SUBTLE_POSE_SPEC = [
  "电商试衣底图轻微自然站姿：正面站立，双肩放松下沉，胸口自然打开，视线平视镜头；",
  "双脚自然分开约肩宽，平行站立，重心均衡，禁止交叉腿、大迈步或单脚点地；",
  "双臂垂于身侧但略有弧度：手肘微弯，小臂与身体留出细小空隙，手腕与手指自然放松下垂；",
  "双手必须空手，不插兜、不叉腰、不抱胸、不抬手遮挡躯干与腰胯；",
  "整体像电商 catalog 的 relaxed standing pose，动作幅度极小、稳定，便于后续虚拟试衣。",
].join("");

/** 头像/半身扩全身 · 补全肢体时延续微姿势 */
export const VTon_FULL_BODY_EXPAND_POSE_SPEC =
  "补全躯干、双臂与双腿时，延续上述轻微自然站姿；若参考图头肩已有极轻微朝向，下身与手臂与之协调，但仍须保持正面试衣底图、四肢不遮挡服装区域。";

/** 微姿势负向（试衣底图禁大动作） */
export const VTon_MODEL_SUBTLE_POSE_NEGATIVE_ZH =
  "僵硬 T-pose，机器人站姿，双臂笔直贴死身体，叉腰，抱胸，双手插兜，大幅抬手，手挡胸口，手挡腰胯，交叉腿，大迈步，走路定格，单脚点地，大侧身，扭转身体，坐姿，蹲姿，倚靠，夸张摆拍，红毯大动作";

/** 成人电商试衣 · 健康匀称体型（避免男装扩全身过瘦） */
export const VTon_MODEL_BUILD_SPEC = [
  "健康匀称的成年人电商试衣体型：肩宽自然、胸背与上臂有正常成年人的体量感，腰臀过渡自然；",
  "禁止过度消瘦、纸片人、弱不禁风、骨感竹竿身材或时装周极端瘦模；",
  "若参考图为男性，补全身躯时须保持真实成年男性肩宽、胸背厚度与手臂围度，禁止窄肩细臂、女装化消瘦体型。",
].join("");

/** 成人时装模特 · 上下身比例（腿长于上身，电商目录身材） */
export const VTon_MODEL_UPPER_LOWER_BODY_SPEC = [
  "按电商试衣模特标准上下身比例：从腰线/髋部到大底的双腿，视觉长度须明显长于头颈+肩胸+腰腹之和；",
  "腿长约占全身可视高度 50%～55%，禁止五五分或上身偏长的身材；",
  "腰线位置自然，禁止压低腰线或用过长衣摆遮到大腿中部从而压缩腿长；",
  "腿线清晰、长度足够，但保留正常肌肉与围度，禁止病态细腿或棍状竹竿腿。",
].join("");

/** 成人时装模特 · 标准头身比（避免头像扩全身时头大身小） */
export const VTon_MODEL_BODY_PROPORTION_SPEC = [
  "成人时装模特真实人体比例：全身约 7.5～8 头身，头部高度约占全身 1/7～1/8；",
  "肩宽约为头宽的 2～2.5 倍，颈、躯干、四肢长度协调，禁止 Q 版、卡通或儿童比例；",
  VTon_MODEL_BUILD_SPEC,
  VTon_MODEL_UPPER_LOWER_BODY_SPEC,
  "中远景 fashion catalog 全身构图，35mm 镜头自然透视，禁止广角近景导致的大头畸变；",
  "人物占画面高度约 85%，远景全身人像，头顶与足尖均留少量留白。",
].join("");

/** 预排版参考图（9:16 白底顶部小锚点）· 扩全身专用 */
export const VTon_FULL_BODY_EXPAND_CANVAS_REF_SPEC = [
  "参考图已预排至 9:16 白底画布顶部的小尺寸身份锚点，仅用于锁定五官与妆发；",
  "须在该锚点下方生成剩余躯干、双臂、双腿与鞋，输出标准 7.5～8 头身完整全身；",
  "锚点以下须优先为双腿与鞋分配足够纵向空间：腿部长度须明显长于已见头颈肩胸，按健康匀称下身比例补全（腿长但不骨感）；",
  "禁止放大锚点人物、禁止沿用锚点的特写比例或纵向拉伸比例。",
].join("");

export const VTon_FULL_BODY_EXPAND_ELONGATED_REF_SPEC =
  "参考图为纵向比例偏长的头像或窄图：须按标准成人时装模特头身比重新生成全身，勿继承参考图的纵向拉伸、长脸或窄肩比例。";

/** 模特试衣 · 单人全身底图 · 固定构图（白底 · 一次生成一张） */
export const VTon_MODEL_FULL_BODY_COMPOSITION_SPEC = [
  "高质量电商虚拟试衣底图，竖向 9:16 长构图，纯白色纯净背景，中性摄影棚平光。",
  VTon_MODEL_BODY_PROPORTION_SPEC,
  "单人站立正面完整全身照：头顶、躯干、双腿、双脚与鞋子必须全部在画面内，留出足尖下方少量留白。",
  VTon_MODEL_SUBTLE_POSE_SPEC,
  "自然妆容与发型。",
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
  "继承参考图人物身份与妆造：五官特征、脸型、眉形、眼型、鼻型、唇形、妆发、肤色与肤质细节须一致；禁止换脸、禁止 AI 美颜。",
  "若参考图为头像或半身特写，须按成人 7.5～8 头身标准整体缩放人物后再输出全身，禁止把特写中的大头原尺寸贴到全身画布上。",
  "妆照应完整保留参考图：底妆、腮红、眼影、眼线、睫毛、唇色与修容层次与参考图一致，不得改妆或素颜化。",
  "发型完整保留：发色、发量、刘海、分缝与发丝走向与参考图一致，不得换发型或改发色。",
  "光线与曝光须继承参考图：主光方向、色温、明暗对比、面部高光与阴影与参考图保持一致；向下补全躯干与腿部时，光影须自然衔接，禁止整体重打光或 flatten 成统一棚拍平光。",
  "补全参考图中未出现的身体部分（躯干、双臂、双腿、鞋）；身份与妆造不变，但允许为正常全身构图调整整体尺度、头身比与上下身比例；",
  "补全下身时按电商试衣标准拉长双腿并保持自然围度，勿让上装衣摆过长、躯干占比过大或补成过度消瘦体型。",
  VTon_FULL_BODY_EXPAND_POSE_SPEC,
].join("");

/** 头像/半身 → 全身 · 构图（白底试衣，但不覆盖参考图人物光效） */
export const VTon_FULL_BODY_EXPAND_COMPOSITION_SPEC = [
  "高质量电商虚拟试衣底图，竖向 9:16 长构图，纯白色纯净背景。",
  VTon_MODEL_BODY_PROPORTION_SPEC,
  "单人站立正面完整全身照：头顶、躯干、双腿、双脚与鞋子必须全部在画面内，留出足尖下方少量留白。",
  VTon_MODEL_SUBTLE_POSE_SPEC,
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
  "头大，头过大，头身比例失调，五头身，六头身，Q版，卡通比例，儿童比例，身体过小，窄肩，肩比头窄",
  "上身过长，下身过短，腿短，短腿，五五分身材，五五身，腰线过低，躯干过长，上半身占比过大，衣摆过长，上衣遮大腿，压缩腿长",
  "过于消瘦，过度苗条，纸片人，骨感，病态瘦，弱不禁风，棍状腿，竹竿腿，细臂，窄肩男性，女装化体型",
  "纵向拉伸，长脸，窄长脸，拉伸比例，修长头部，广角畸变，近景大头，鱼眼",
  "妆容改变，改妆，素颜化，唇色改变，眼妆改变，眉形改变，肤色偏差，色温改变，光线不一致，重新打光，统一平光，flatten 光影",
  "发型改变，发色改变，发量改变，刘海改变",
  "人脸变形，五官错位，肢体畸形，手部崩坏，复杂背景，水印，文字，多人物，四视图，多视角拼接",
  "背心，吊带，内衣，文胸，运动内衣，比基尼，大面积裸露，露脐",
  "复杂叠穿，宽袍大袖，长裙拖地，厚重外套",
  VTon_MODEL_SUBTLE_POSE_NEGATIVE_ZH,
].join("，");

export type VtonFullBodyExpandPromptOpts = {
  /** 已做 9:16 顶部锚点预排版 */
  usesCanvasLayout?: boolean;
  /** 纵向偏长参考图 */
  elongatedRef?: boolean;
};

export function buildVtonFullBodyExpandPrompt(
  userPrompt?: string,
  opts?: VtonFullBodyExpandPromptOpts,
): string {
  const parts = [VTon_FULL_BODY_EXPAND_PROMPT_ZH];
  if (opts?.usesCanvasLayout) {
    parts.push(VTon_FULL_BODY_EXPAND_CANVAS_REF_SPEC);
  }
  if (opts?.elongatedRef) {
    parts.push(VTon_FULL_BODY_EXPAND_ELONGATED_REF_SPEC);
  }
  const extra = userPrompt?.trim();
  if (extra) parts.push(extra);
  return parts.join("\n");
}

export function buildVtonModelGeneratePrompt(userPrompt?: string): string {
  const text = userPrompt?.trim();
  return text || VTon_DEFAULT_MODEL_GENERATE_PROMPT;
}
