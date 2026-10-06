/**
 * 平台镜头描述库（由 docs/镜头描述提示词.md 生成，勿手改）
 * 重新生成：node canvas-web/scripts/generate-camera-shot-catalog.mjs
 */
export type CameraShotPreset = {
  id: string;
  index: number;
  name: string;
  meaningZh: string;
  sceneExampleZh: string;
  cameraPromptEn: string;
};

export const CAMERA_SHOT_PRESETS: CameraShotPreset[] = [
  {
    "id": "cam:01-缓慢推轨前进",
    "index": 1,
    "name": "缓慢推轨前进",
    "meaningZh": "轨道匀速向前，平稳靠近主体，慢慢压缩空间，拉近观众与人物距离，适合温柔、伤感、心动的人物特写。",
    "sceneExampleZh": "茶席上静坐的女子，柔和窗边自然光",
    "cameraPromptEn": "slow dolly forward, smooth, slowly approaching character, soft atmosphere, cinematic, shallow depth of field, 8k, film grain"
  },
  {
    "id": "cam:02-缓慢推轨后退",
    "index": 2,
    "name": "缓慢推轨后退",
    "meaningZh": "轨道匀速向后，人物慢慢变小，环境不断纳入画面。人与环境对比变强，烘托孤独、失落、苍茫。",
    "sceneExampleZh": "孤身站在山谷的人，苍茫远山",
    "cameraPromptEn": "slow dolly backward, frame widening, vast empty environment, lonely mood, cinematic, wide shot, film grain"
  },
  {
    "id": "cam:03-快速推轨冲击",
    "index": 3,
    "name": "快速推轨冲击",
    "meaningZh": "镜头猛地向前冲刺，快速扑向人物，空间急速压缩，冲击力强，适合悬疑、惊悚、对峙高光时刻。",
    "sceneExampleZh": "对峙的两个人，昏暗房间",
    "cameraPromptEn": "fast dolly rush forward, sudden impact, tense atmosphere, dramatic, cinematic, high contrast"
  },
  {
    "id": "cam:04-眩晕变焦-希区柯克变焦",
    "index": 4,
    "name": "眩晕变焦（希区柯克变焦）",
    "meaningZh": "镜头向前推同时镜头拉远（或反过来），主体大小不变，背景拉伸扭曲，经典希区柯克变焦，表现恐慌、震惊、世界观崩塌。",
    "sceneExampleZh": "人物站在长廊中央，人不动背景拉伸",
    "cameraPromptEn": "Hitchcock dolly zoom, character stays same size, background warping, dizzy, panic, cinematic, strong perspective"
  },
  {
    "id": "cam:05-微距变焦",
    "index": 5,
    "name": "微距变焦",
    "meaningZh": "近距离拍摄微小物体，镜头对焦在纹理、水珠、皮肤纹路，从微观视角叙事，文艺、科幻、静物特写。",
    "sceneExampleZh": "老茶盏表面的细碎纹理，水珠挂在杯沿",
    "cameraPromptEn": "macro shot, zoom into tiny details, texture closeup, artistic micro world, shallow depth of field, soft lighting"
  },
  {
    "id": "cam:06-宇宙超远变焦一镜到底",
    "index": 6,
    "name": "宇宙超远变焦一镜到底",
    "meaningZh": "超长连续镜头，从浩瀚宇宙缓缓变焦，一路穿过云层，下降落到城市街道，无缝衔接，史诗开场。",
    "sceneExampleZh": "从浩瀚太空云层，一路下降落到古镇街道",
    "cameraPromptEn": "one shot, extreme long zoom from outer space down to ancient town street, seamless, epic, cinematic"
  },
  {
    "id": "cam:07-过肩镜头-OTS",
    "index": 7,
    "name": "过肩镜头 OTS",
    "meaningZh": "镜头在人物肩膀后方，前景保留肩膀后脑勺，焦点落在对面人物，对话戏首选，观众仿佛站在角色身后旁观。",
    "sceneExampleZh": "两人茶桌前对话，前景保留一侧肩膀",
    "cameraPromptEn": "over the shoulder shot OTS, foreground shoulder, dialogue scene, immersive, shallow depth of field"
  },
  {
    "id": "cam:08-鱼眼猫眼视角",
    "index": 8,
    "name": "鱼眼猫眼视角",
    "meaningZh": "鱼眼广角，画面边缘向外膨胀畸变，视野超大，类似监控摄像头，营造不安、窥探、密室悬疑氛围。",
    "sceneExampleZh": "木门猫眼向外看，昏暗走廊",
    "cameraPromptEn": "fisheye lens, wide distortion, surveillance camera view, eerie, tense, low light, cinematic"
  },
  {
    "id": "cam:09-遮挡横移监视",
    "index": 9,
    "name": "遮挡横移监视",
    "meaningZh": "镜头横向移动，一开始被墙体、柱子遮挡，随着镜头平移，人物从遮挡物后方慢慢显露，充满窥探悬疑感。",
    "sceneExampleZh": "镜头藏在木柱后方，缓缓横移，人物从柱子后面慢慢显现",
    "cameraPromptEn": "tracking shot behind pillar, reveal character from obstruction, suspense, slow horizontal move, soft shadow"
  },
  {
    "id": "cam:10-穿透飞跃镜头",
    "index": 10,
    "name": "穿透飞跃镜头",
    "meaningZh": "镜头向前飞行，穿过玻璃、门缝、树叶缝隙，完成场景跳转，空间流动感，治愈奇幻。",
    "sceneExampleZh": "镜头穿过木窗缝隙，从室内飞向庭院",
    "cameraPromptEn": "flying camera through window gap, seamless space transition, dreamy, transparent, cinematic, soft haze"
  },
  {
    "id": "cam:11-虚焦转清晰",
    "index": 11,
    "name": "虚焦转清晰",
    "meaningZh": "画面一开始完全失焦模糊，然后焦点慢慢对上主体，模拟回忆苏醒、睁眼看见目标，氛围感极强。",
    "sceneExampleZh": "朦胧光斑，画面慢慢对焦到喝茶人的侧脸",
    "cameraPromptEn": "pull focus from blurry to sharp, soft bokeh, memory scene, slow focus pull, warm ambient light"
  },
  {
    "id": "cam:12-焦点切换",
    "index": 12,
    "name": "焦点切换",
    "meaningZh": "画面内存在前后两个主体，焦点从 A 人物平滑切换到 B 人物，无需剪辑，直接引导观众视线。",
    "sceneExampleZh": "茶桌上前后两个茶杯，焦点平滑从前景切换到后景",
    "cameraPromptEn": "rack focus, shift focus between two subjects, depth of field, narrative, cinematic"
  },
  {
    "id": "cam:13-镜头上摇",
    "index": 13,
    "name": "镜头上摇",
    "meaningZh": "机位不动，镜头从人物脚部缓缓向上摇至面部，仰视感，用于人物登场、强者出场，提升气场。",
    "sceneExampleZh": "人物静静站立，镜头从脚部缓缓摇至面部",
    "cameraPromptEn": "tilt up, start at feet slowly rise to face, hero entrance, powerful aura, cinematic portrait"
  },
  {
    "id": "cam:14-镜头下摇",
    "index": 14,
    "name": "镜头下摇",
    "meaningZh": "机位不动，镜头从头部向下摇到全身，适合人物亮相、穿搭、全身器物展示，从容优雅。",
    "sceneExampleZh": "人物安静站立，镜头从头部向下摇到全身",
    "cameraPromptEn": "tilt down, start from head slowly down to full body, portrait, fashion shot, soft natural light"
  },
  {
    "id": "cam:15-横向左移",
    "index": 15,
    "name": "横向左移",
    "meaningZh": "镜头水平向左平稳移动，前景景物快速划过，拉开画面层次，适合城市街景、建筑群。",
    "sceneExampleZh": "城市老街建筑群，镜头水平向左平稳移动",
    "cameraPromptEn": "horizontal tracking left, foreground parallax, cityscape, cinematic layers, warm afternoon light"
  },
  {
    "id": "cam:16-横向右移",
    "index": 16,
    "name": "横向右移",
    "meaningZh": "镜头水平向右平稳移动，缓缓展开场景，舒展柔和，适合自然风光、长走廊。",
    "sceneExampleZh": "山间溪流，镜头水平向右平稳移动缓缓展开景色",
    "cameraPromptEn": "horizontal tracking right, smoothly unfold scene, open space, fluid motion, nature cinematic"
  },
  {
    "id": "cam:17-180-度半环绕",
    "index": 17,
    "name": "180 度半环绕",
    "meaningZh": "镜头围绕人物做半圈弧形运动，慢慢转到人物侧面 / 背面，文艺伤感，适合安静独白、情绪人像。",
    "sceneExampleZh": "独自坐在石阶上的人",
    "cameraPromptEn": "180 degree half orbit around character, melancholic, emotional portrait, slow motion, soft golden hour"
  },
  {
    "id": "cam:18-快速-360-度环绕",
    "index": 18,
    "name": "快速 360 度环绕",
    "meaningZh": "镜头高速围绕人物完整旋转一圈，带镜头眩光，适合打斗、爆发、高光名场面，冲击力强。",
    "sceneExampleZh": "人物高光爆发瞬间，旋转带镜头炫光",
    "cameraPromptEn": "fast 360 orbit around character, motion flare, action scene, dynamic, cinematic lens flare"
  },
  {
    "id": "cam:19-缓慢弧形环绕",
    "index": 19,
    "name": "缓慢弧形环绕",
    "meaningZh": "低速弧形环绕，平滑柔和，不剧烈，适合安静沉思、唯美风景、人物情绪独白。",
    "sceneExampleZh": "静坐沉思的人，温柔缓慢弧形转动视角",
    "cameraPromptEn": "slow gentle arc orbit, peaceful, contemplative, soft light, emotional portrait"
  },
  {
    "id": "cam:20-垂直下降",
    "index": 20,
    "name": "垂直下降",
    "meaningZh": "镜头垂直向下缓缓降落，压迫感慢慢增强，烘托沉重、低落、压抑氛围。",
    "sceneExampleZh": "压抑安静的古旧房间，镜头垂直缓缓降落",
    "cameraPromptEn": "vertical descend, camera move down, heavy depressing mood, calm tension, low key lighting"
  },
  {
    "id": "cam:21-垂直上升",
    "index": 21,
    "name": "垂直上升",
    "meaningZh": "镜头垂直向上缓缓拉起，视野不断打开，情绪释放，表达解脱、豁然开朗、释然。",
    "sceneExampleZh": "站在山顶的人，镜头垂直向上拉起，视野不断打开",
    "cameraPromptEn": "vertical rise, camera lifting upward, expanding view, uplifting emotion, epic landscape"
  },
  {
    "id": "cam:22-摇臂上升",
    "index": 22,
    "name": "摇臂上升",
    "meaningZh": "大型摇臂从低位缓缓抬升，一边升高一边拉开视野，人物从小场景逐渐融入宏大环境，浪漫史诗感。",
    "sceneExampleZh": "山谷间的人物，摇臂从低位慢慢抬升，视野越变越广阔",
    "cameraPromptEn": "crane shot rising, view expands gradually, epic romantic scene, smooth crane motion, golden hour"
  },
  {
    "id": "cam:23-摇臂下降",
    "index": 23,
    "name": "摇臂下降",
    "meaningZh": "摇臂从高空广阔画面缓缓降下，最终落回地面人物身上，从宏大环境收束到个体故事。",
    "sceneExampleZh": "高空广阔山野，摇臂缓缓降落，最终聚焦地面人物",
    "cameraPromptEn": "crane shot descending, from wide sky view down to character, storytelling, cinematic"
  },
  {
    "id": "cam:24-平滑光学推进",
    "index": 24,
    "name": "平滑光学推进",
    "meaningZh": "纯光学变焦推进，机位无移动，画面顺滑，安静特写，捕捉微表情，细腻情绪。",
    "sceneExampleZh": "人物面部安静特写，捕捉细微表情",
    "cameraPromptEn": "smooth optical zoom in, closeup face, subtle emotion, no camera movement, soft diffused light"
  },
  {
    "id": "cam:25-平滑光学拉远",
    "index": 25,
    "name": "平滑光学拉远",
    "meaningZh": "纯光学变焦拉远，机位不动，画面缓缓拓宽，人物逐渐融入空旷环境，营造孤寂感。",
    "sceneExampleZh": "空荡原野上的孤身人物，机位不动画面缓缓拓宽",
    "cameraPromptEn": "smooth optical zoom out, frame expanding, lonely character in vast space, cinematic wide shot"
  },
  {
    "id": "cam:26-极速冲撞变焦",
    "index": 26,
    "name": "极速冲撞变焦",
    "meaningZh": "极快光学变焦猛地推向人物面部，爆发力强，适合顿悟、惊吓、反转瞬间，抓眼球。",
    "sceneExampleZh": "人物震惊顿悟瞬间，镜头猛地推向面部",
    "cameraPromptEn": "extreme fast zoom into face, sudden shock moment, dramatic snap, high contrast, cinematic"
  },
  {
    "id": "cam:27-无人机高空飞跃",
    "index": 27,
    "name": "无人机高空飞跃",
    "meaningZh": "无人机在高空向前飞行，掠过山川湖泊，视野开阔舒展，适合治愈风光短片。",
    "sceneExampleZh": "连绵湖泊山林，无人机高空向前飞行掠过风景",
    "cameraPromptEn": "drone fly forward high altitude, landscape, healing wide view, cinematic aerial shot"
  },
  {
    "id": "cam:28-史诗无人机升起",
    "index": 28,
    "name": "史诗无人机升起",
    "meaningZh": "无人机初始被山体遮挡，缓缓上升，壮丽风景慢慢浮现，史诗级开篇。",
    "sceneExampleZh": "山体遮挡，无人机缓缓升起，壮丽山景慢慢显露",
    "cameraPromptEn": "epic drone rising up, reveal mountain scenery from behind ridge, stunning opening, epic atmosphere"
  },
  {
    "id": "cam:29-大场景无人机环绕",
    "index": 29,
    "name": "大场景无人机环绕",
    "meaningZh": "无人机远距离环绕主体，宏大环境包围人物，强烈大小对比，表达人在天地间的孤寂与震撼。",
    "sceneExampleZh": "旷野中站立的人物，无人机远距离环绕，宏大环境包裹人物",
    "cameraPromptEn": "drone orbit in wide landscape, character tiny against massive nature, awe lonely, cinematic aerial"
  },
  {
    "id": "cam:30-上帝俯拍-90-度俯拍",
    "index": 30,
    "name": "上帝俯拍 90 度俯拍",
    "meaningZh": "镜头垂直正上方 90 度向下拍摄，平面构图，对称、仪式感、宿命感，适合静物、器物俯视构图。",
    "sceneExampleZh": "茶席器物整齐摆放，正上方垂直 90 度拍摄",
    "cameraPromptEn": "90 degree top-down bird's eye view, symmetrical composition, mysterious ritual, flat lay, soft top light"
  },
  {
    "id": "cam:31-FPV-穿越机俯冲",
    "index": 31,
    "name": "FPV 穿越机俯冲",
    "meaningZh": "第一视角穿越机，高速俯冲穿梭，动态极强，极限追逐，炸裂动作场面。",
    "sceneExampleZh": "山林峡谷，FPV 高速向前俯冲穿梭",
    "cameraPromptEn": "FPV drone dive, high speed, immersive racing, intense dynamic motion, motion blur"
  },
  {
    "id": "cam:32-手持纪实风",
    "index": 32,
    "name": "手持纪实风",
    "meaningZh": "轻微自然抖动，不是剧烈摇晃，模拟人手持拍摄，纪实、生活、原生真实故事感。",
    "sceneExampleZh": "普通人在老巷泡茶，轻微自然抖动，手持纪录片质感",
    "cameraPromptEn": "handheld shot, subtle natural shake, documentary style, raw realistic, natural daylight"
  },
  {
    "id": "cam:33-甩镜快速转场",
    "index": 33,
    "name": "甩镜快速转场",
    "meaningZh": "镜头快速横向甩动，画面短暂模糊，利用甩动完成场景切换，短视频快节奏转场。",
    "sceneExampleZh": "镜头快速横向甩动，画面短暂模糊完成场景切换",
    "cameraPromptEn": "whip pan transition, fast camera whip, motion blur, cool cut, high energy"
  },
  {
    "id": "cam:34-荷兰倾斜角",
    "index": 34,
    "name": "荷兰倾斜角",
    "meaningZh": "镜头水平倾斜，地平线不再平直，人物世界扭曲，烘托不安、疯狂、对峙、精神失衡。",
    "sceneExampleZh": "不安对峙场景，画面地平线歪斜",
    "cameraPromptEn": "Dutch angle, tilted horizon, uneasy feeling, mental instability, dramatic low light"
  },
  {
    "id": "cam:35-后退跟拍",
    "index": 35,
    "name": "后退跟拍",
    "meaningZh": "镜头向后移动，持续跟随向前走来的人物，镜头始终对着人脸，凸显主角强大气场。",
    "sceneExampleZh": "人物向前稳步走来，镜头向后移动持续跟随人脸",
    "cameraPromptEn": "tracking backward, follow character walking forward, confident protagonist, cinematic"
  },
  {
    "id": "cam:36-前进跟拍",
    "index": 36,
    "name": "前进跟拍",
    "meaningZh": "镜头跟在人物身后向前移动，一直拍背影，观众跟着人物往前走，营造未知、孤独、神秘感。",
    "sceneExampleZh": "镜头跟在人物背后向前移动，一直拍摄背影",
    "cameraPromptEn": "tracking forward, follow character's back view, mysterious narrative, soft shadow"
  },
  {
    "id": "cam:37-平行侧移跟拍",
    "index": 37,
    "name": "平行侧移跟拍",
    "meaningZh": "镜头和人物保持同一水平线并排移动，侧面拍摄行走，街拍氛围感，流畅自然。",
    "sceneExampleZh": "人物沿着老街行走，镜头并排侧面同步移动",
    "cameraPromptEn": "side tracking shot, move parallel with walking character, street style, natural light"
  },
  {
    "id": "cam:38-第一人称行走-POV",
    "index": 38,
    "name": "第一人称行走 POV",
    "meaningZh": "POV 第一视角，画面就是主角眼睛看到的画面，随脚步轻微晃动，沉浸式探险体验。",
    "sceneExampleZh": "第一视角走在古巷，画面随脚步轻微晃动",
    "cameraPromptEn": "POV first person walking shot, immersive, slight walk shake, personal perspective, natural ambient"
  }
] as CameraShotPreset[];

export const CAMERA_SHOT_NEGATIVE_PROMPT =
  "blurry, deformed, bad anatomy, ugly, disfigured, extra limbs, watermark, text, logo, oversaturated";

export function findCameraShotPreset(id: string): CameraShotPreset | undefined {
  return CAMERA_SHOT_PRESETS.find((p) => p.id === id);
}

export function buildCameraShotRunPrompt(
  preset: CameraShotPreset,
  scenePart: string,
): string {
  const scene = scenePart.trim();
  const cam = preset.cameraPromptEn.trim();
  if (scene && cam) return `${scene}, ${cam}`;
  return scene || cam;
}
