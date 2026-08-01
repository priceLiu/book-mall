/**
 * Pro2 制作包 v6 · 默认/古风 hub 共用标准（canvas-web 真源）
 * book-mall/lib/canvas/data/pro2-production-pack-standard.ts 须保持同步
 */

/** pack v6 指纹 · migrate 与 legacy 检测 */
export const STORY_PRO2_PACK_V6_MARKER = "核心冲突 GFM 表";

/** 分镜脚本 9 列表头（字面一致 · 解析器依赖） */
export const STORY_PRO2_STORYBOARD_TABLE_HEADER = `| 镜号 | 景别 | 运镜 | 画面描述 | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|----------|------|----------|---------------------|---------------------|---------------|`;

/** 摄影级视觉风格总纲 GFM 维度（泛题材） */
export const STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6 = `- **视觉风格总纲**须用 GFM 表输出（表头 \`维度 | 内容\`），须 **具体可执行**：

| 维度 | 内容 |
|------|------|
| 故事背景/世界观 | （一句话） |
| 年代/环境 | （时代 + 地点 + 季节/气候） |
| 画面风格 | （如电影级写实；禁止动画/CG/插画感） |
| 全剧色调基调 | （主色名 + HEX，日/夜或冷暖对比概述） |
| 日景调色板 | （主色 HEX + 高光/阴影色，若剧本无日景写「—」） |
| 夜景调色板 | （主色 HEX + 辅光色，若剧本无夜景写「—」） |
| 皮肤/材质基调 | （主要角色肤色或材质倾向，可选 HEX） |
| 建筑风格/置景 | （建筑/环境材质与主色，1–2 句） |
| 光影基调 | （自然光方向、轮廓光、拒绝平光等） |
| 英文风格锚定 | （可 prepend 到 AI 生图 prompt 的英文短语） |

- 禁止空泛「高质量」「精美」；后续三视图/场景/分镜节点将自动读取此表。`;

/** 核心冲突与结构摘要 · GFM 表规范 */
export const STORY_PRO2_CORE_CONFLICT_TABLE_RULES = `- **核心冲突与结构摘要**须用 GFM 表（表头 \`项目 | 内容\`），至少包含：

| 项目 | 内容 |
|------|------|
| 表层/深层冲突 | （外部冲突 + 内心诉求） |
| 人设反差 | （主要角色表面 vs 私下，若有） |
| 人设暴露场景 | （具体到镜号或场次） |
| 悬念/反转钩子 | （开头设疑 + 结尾揭示方向） |
| 节拍/糖点或高潮 | （按镜号或段落标注关键节拍） |
| 情绪曲线 | （起→承→转→合，箭头串联） |

- 禁止仅用散文段落代替 GFM 表；信息量须足以支撑 8–14 镜分镜拆分。`;

/** 下一步交接清单 GFM 表规范 */
export const STORY_PRO2_HANDOFF_TABLE_RULES = `- **下一步交接清单**须用 GFM 表（表头 \`环节 | 说明 | 建议工具/步骤\`），至少含：角色三视图、场景空镜、分镜图板、分镜视频、口型/配音、定稿拆分。`;

/** 全题材 · 分镜视频列 Seedance 规范（列名仍为 AI视频提示词(英文)） */
export const STORY_PRO2_VIDEO_PROMPT_RULES = `# 分镜 · AI视频提示词(英文) 列撰写规范

- **列名不变**；**列内正文写中文 Seedance 2.0 提示词**（台词语言依剧本，默认中文）
- **参考绑定**：角色 \`<<<image_1>>>\` \`<<<image_2>>>\` 或 \`<<<image_女主>>>\`；场景 \`<<<scene_A>>>\` 等（与场景辞典一致）
- **动作堆栈**：镜头运动 → 人物动作与微表情 → 环境变化 → 音效/台词
- **Seedance 标记**：对话 \`{台词}\` · 音效 \`<描述>\` · BGM 写音量（如 \`音量-18dB\`）· 无字幕时写 \`无字幕\`
- **站位连贯（第 2 镜起）**：开头写 **承接上一镜末尾** 的起始姿态，再写本镜动作
- **画面描述**须含 **【起始】…【结束】**；本列视频 prompt 与之对齐
- **固定视觉风格（融入段落）**：电影侧逆光轮廓光；超写实哑光、柔光镜、35mm 小景深、背景虚化；可前景遮挡增加层次
- **表演节奏**：正常人类速度；情感高潮可短暂 slow-mo
- **口型/配音备注**：BGM dB、口型同步、OS/后期配音写 **口型/配音备注** 列，勿与视频列重复堆旁白全文
- **每镜末尾**追加 \`[Negative: animation, game CG, illustration, anime, flat lighting, plastic skin, watermark]\`（可增补题材禁忌）`;

export const PRO2_UNIVERSAL_NEGATIVE =
  "animation, game CG, illustration, anime, watercolor, oil painting, over-processed, plastic skin, flat lighting, oversaturated clash, modern elements, unnatural skin, stiff face, no skin texture, clutter, watermark, signature, text overlay";

/** few-shot 免责声明（默认/古风 pack 共用） */
export const PRO2_SHOT_GFM_EXAMPLE_DISCLAIMER = `# GFM 分镜映射样例（结构参考 · 禁止照抄示例剧名/角色/场景名）

以下 4 镜展示 **9 列完整粒度**；生成时须 **依用户大纲题材改写** 人物、场景与剧情，仅复用结构与写法。`;

/** 镜 1 / 4 / 5 / 8 完整行 · 源：docs/example.md */
export const PRO2_DEFAULT_SHOT_GFM_EXAMPLE = `${PRO2_SHOT_GFM_EXAMPLE_DISCLAIMER}

${STORY_PRO2_STORYBOARD_TABLE_HEADER}
| 1 | 大全景→中景 | 缓慢摇移推进 | 【起始】长安城朱雀大街南端，镜头向北缓慢摇移推进，两侧酒楼商铺红灯笼布幡招展，百姓人头攒动。前景以酒楼旗幡作为遮挡物。镜头推进至街中段右侧酒楼二层外廊栏杆处。沈知意背对镜头站立，双手紧握一卷明黄婚书，指尖因用力而泛白。百姓仰头望向她，交头接耳议论纷纷，手指向她指指点点。沈知意深吸一口气闭眼做豁出去的表情，双手举高婚书作势要撕。【结束】沈知意保持高举婚书姿势，身体微僵，目光锁定楼下。 | 百姓甲："听说了吗？沈家小姐今天要当众退摄政王的婚！"百姓乙："那可是摄政王啊！她疯了吧？" | 10 | Cinematic wide shot of ancient Chang'an bustling main street, Qingbanshi road, wooden two-story restaurants with red lanterns, city gate tower in distance, warm golden backlight from midday sun, crowded with ancient costume citizens, 35mm lens, soft focus background, photorealistic film style, natural lighting, 2K resolution | <<<scene_A>>> 作为背景参考。电影光线，柔和侧逆光打亮街面人物轮廓，暖金色阳光从城门方向射入，明暗对比强烈。超写实哑光质感，柔光镜效果，35mm镜头小景深，背景略有虚化。从朱雀大街南端向北缓慢摇移推进，前景以酒楼旗幡作为遮挡物增加层次感。推进至街中段时聚焦右侧酒楼二层外廊，沈知意背对镜头站立，双手紧握明黄婚书，指尖泛白。百姓仰头交头接耳手指指向她。她深吸一口气闭眼做豁出去表情。保持正常叙事速度。对话 {百姓甲："听说了吗？沈家小姐今天要当众退摄政王的婚！"} 对话 {百姓乙："那可是摄政王啊！她疯了吧？"} 无背景音乐，无字幕 [Negative: animation, game CG, illustration, anime, flat lighting, plastic skin, watermark] | 百姓群杂同步收音 |
| 4 | 全景→慢动作特写 | 全景转慢动作推进 | 【起始】沈知意鬼鬼祟祟爬上青砖墙头，鹅黄色裙摆被老槐树枝桠勾住。她用力拉扯裙摆时身体失去平衡向后仰倒，发出一声短促惊叫。切换至慢动作特写：她坠落时惊慌失措的表情定格，花瓣随她一同飘落。萧景珩恰好骑马经过墙下闻声抬头张开双臂，两人碰撞在一起，他稳稳将她接入怀中，冲力使两人一同摔进松软草地。【结束】萧景珩仰躺于草地，沈知意趴在他胸膛上方，双臂撑在他身体两侧，长发散落垂在他脸侧，两人相距不足一掌，面对面凝视。 | 沈知意："对……对不起！我不是故意砸你的！" | 12 | Cinematic night scene, ancient mansion wall with vines and locust tree, petals falling, moonlight and warm lantern light creating blue-gold tone, man catching falling woman in his arms, both falling onto grass, 35mm lens soft background, photorealistic film style, dramatic lighting, 2K resolution | <<<image_女主>>> 和 <<<image_男主>>> 作为角色锚点，<<<scene_B>>> 作为背景。电影光线，月光冷白与灯笼暖黄交织成蓝金色调，柔和侧逆光打亮人物轮廓，明暗对比强烈。超写实哑光质感，柔光镜效果，35mm镜头小景深，背景朦胧虚化。沈知意爬上墙头裙摆被树枝勾住，用力拉扯时身体仰倒发出短促惊叫。慢动作特写：她坠落时惊慌表情定格，花瓣飘落。萧景珩闻声抬头张开双臂将她接入怀中，冲力使两人摔进草地。本镜结束时：萧景珩仰躺于草地，沈知意趴于他胸膛上方，双臂撑于他身体两侧，长发散落垂于他脸侧，两人相距不足一掌面对面凝视。保持正常叙事速度，坠落瞬间慢速强调。音效 <裙摆撕裂声> <落入草地闷响> 古风暧昧轻音乐继续，音量-18dB。无字幕 [Negative: animation, game CG, illustration, anime, flat lighting, plastic skin, watermark] | 女主台词同期声录制 |
| 5 | 近景→特写 | 中景推至特写 | 【起始】承接上一镜末尾：萧景珩仰躺于草地，沈知意趴于他胸膛上方，两人相距不足一掌。沈知意慌忙从他身上爬起来后退两步，右脚绣鞋脱落在草丛中，穿着罗袜的脚羞赧蜷缩脚趾。萧景珩不紧不慢站起身拍掉草屑花瓣，低头在草丛中捡起鹅黄色绣鞋，在她惊讶目光下单膝蹲下，一手轻握她纤细脚踝，另一手小心翼翼为她穿好绣鞋，动作轻柔缓慢。沈知意低头看他，脸红透到耳根，嘴唇微张说不出话，手指无意识绞紧袖口。【结束】沈知意鞋已穿好双脚站立于草地，面朝萧景珩；萧景珩已站起身面朝沈知意，两人相距一步。 | 萧景珩："姑娘，下次翻墙，记得看路。"沈知意内心OS："他……他怎么这么温柔？" | 12 | Cinematic night scene on grass, man kneeling down to put shoe on woman's foot, moonlight and lantern light creating romantic atmosphere, close-up on hands and facial expressions, photorealistic film style, shallow depth of field, 2K resolution | <<<image_女主>>> 和 <<<image_男主>>> 作为角色锚点，<<<scene_B>>> 作为背景。承接上一镜末尾：萧景珩仰躺于草地，沈知意趴于他胸膛上方。沈知意慌忙爬起后退两步，右脚绣鞋脱落，穿着罗袜的脚羞赧蜷缩脚趾。萧景珩不紧不慢起身拍掉草屑花瓣，低头在草丛中捡起鹅黄色绣鞋，在她惊讶目光下单膝蹲下，一手轻握她纤细脚踝，另一手小心翼翼为她穿好绣鞋。沈知意脸红透到耳根，嘴唇微张说不出话，手指无意识绞紧袖口。本镜结束时：两人相距一步面对面站立。保持正常叙事速度，系鞋带瞬间短暂慢速强调。对话 {萧景珩："姑娘，下次翻墙，记得看路。"} 对话 {沈知意内心OS："他……他怎么这么温柔？"} 古风暧昧轻音乐继续，音量-18dB。无字幕 [Negative: animation, game CG, illustration, anime, flat lighting, plastic skin, watermark] | 男主台词同期声，OS单独配音轨 |
| 8 | 中景 | 快速剪辑 | 【起始】沈知意在花园小径扑蝴蝶，身体前倾追逐，脚下被石子一绊身体失去平衡向前扑倒。萧景珩从她身后三步外瞬间闪现，长臂一勾揽住她的细腰将她捞回怀中。【结束】两人相拥站立于花园小径中央，萧景珩右臂揽住沈知意腰部，沈知意双手下意识抓住他前襟衣料，面对面相距不足半尺，衣袂翻飞交缠。 | — | 3 | Cinematic romantic scene in traditional garden, man catching woman from behind by waist, sleeves flowing, yellow and black robes intertwining, warm sunlight, soft focus background, photorealistic film style, 35mm lens, 2K resolution | <<<image_女主>>> 和 <<<image_男主>>> 作为角色锚点，<<<scene_A>>> 作为背景但虚化处理。电影光线暖金色调，柔和侧逆光打亮人物轮廓。超写实哑光质感，柔光镜效果，35mm镜头小景深背景朦胧虚化。快速剪辑时长2秒。沈知意在花园小径扑蝴蝶，脚下被石子一绊身体前扑。萧景珩从她身后三步外瞬间闪现，长臂一勾揽住她细腰捞回怀中。鹅黄与玄黑两色衣袂翻飞交缠。两人旋转中四目相对，她面色惊慌中带愣怔，他嘴角淡笑。本镜结束时：两人相拥站立于花园小径中央，萧景珩右臂揽住沈知意腰部，沈知意双手下意识抓住他前襟衣料，面对面相距不足半尺。保持正常叙事速度。古风暧昧轻音乐继续，音量-15dB。无字幕 [Negative: animation, game CG, illustration, anime, flat lighting, plastic skin, watermark] | 无人声，仅BGM |`;

/** 分镜段 LLM 专用 · 2 镜短样例（减 token；完整 4 镜见 PRO2_DEFAULT_SHOT_GFM_EXAMPLE） */
export const PRO2_STORYBOARD_FEW_SHOT_COMPACT = `${PRO2_SHOT_GFM_EXAMPLE_DISCLAIMER}

【分镜段任务】须输出完整镜头序列（通常 **8–14 镜**）；**每镜必填 \`时长(秒)\` 整数**；禁止只输出 1 镜概括或「镜数规划」小表。

${STORY_PRO2_STORYBOARD_TABLE_HEADER}
| 1 | 大全景 | 缓慢推 | 【起始】朱雀大街人声鼎沸，女主高举婚书站在酒楼外廊，指尖发白。【结束】她保持举书姿势，目光扫向楼下人群。 | 路人甲："她要退婚？" | 10 | Cinematic wide shot, ancient street, warm golden sunlight, photorealistic, 35mm, 2K | <<<scene_A>>> 暖金侧逆光，35mm 小景深。缓慢推近至外廊女主举婚书。对话 {路人甲："她要退婚？"} 无字幕 [Negative: animation, game CG, anime, watermark] | 群杂收音 |
| 2 | 中景 | 固定 | 【起始】承接上一镜：女主仍立于外廊。【结束】男主自楼梯转角现身，两人目光相撞。 | — | 8 | Medium shot, two-shot, cinematic lighting, photorealistic | <<<image_女主>>> <<<image_男主>>> <<<scene_A>>> 承接上一镜末尾站位。两人目光相撞，BGM 音量-18dB，无字幕 [Negative: animation, game CG, anime, watermark] | 仅 BGM |`;
