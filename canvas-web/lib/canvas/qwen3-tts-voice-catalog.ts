/**
 * 百炼 Qwen3-TTS-Flash 系统音色（与 book-mall qwen3-tts-voice-catalog 同步）
 */
export type Qwen3TtsVoiceDef = {
  id: string;
  label: string;
};

export const QWEN3_TTS_FLASH_VOICES: Qwen3TtsVoiceDef[] = [
  { id: "Cherry", label: "Cherry · 芊悦 · 明亮女声" },
  { id: "Serena", label: "Serena · 苏瑶 · 温柔女声" },
  { id: "Ethan", label: "Ethan · 晨煦 · 阳光男声" },
  { id: "Chelsie", label: "Chelsie · 千雪 · 虚拟女友" },
  { id: "Momo", label: "Momo · 茉兔 · 撒娇女声" },
  { id: "Vivian", label: "Vivian · 十三 · 小暴躁" },
  { id: "Moon", label: "Moon · 月白 · 帅气男声" },
  { id: "Maia", label: "Maia · 四月 · 知性女声" },
  { id: "Kai", label: "Kai · 凯 · 磁性男声" },
  { id: "Nofish", label: "Nofish · 不吃鱼 · 设计师男声" },
  { id: "Bella", label: "Bella · 萌宝 · 萝莉" },
  { id: "Jennifer", label: "Jennifer · 詹妮弗 · 美语女声" },
  { id: "Ryan", label: "Ryan · 甜茶 · 戏感男声" },
  { id: "Katerina", label: "Katerina · 卡捷琳娜 · 御姐" },
  { id: "Aiden", label: "Aiden · 艾登 · 美语男声" },
  { id: "Eldric Sage", label: "Eldric Sage · 沧明子 · 老者" },
  { id: "Mia", label: "Mia · 乖小妹" },
  { id: "Mochi", label: "Mochi · 沙小弥 · 童声男" },
  { id: "Bellona", label: "Bellona · 燕铮莺 · 武侠女声" },
  { id: "Vincent", label: "Vincent · 田叔 · 烟嗓男声" },
  { id: "Bunny", label: "Bunny · 萌小姬 · 萝莉" },
  { id: "Neil", label: "Neil · 阿闻 · 新闻主持" },
  { id: "Elias", label: "Elias · 墨讲师 · 讲解女声" },
  { id: "Arthur", label: "Arthur · 徐大爷 · 讲故事" },
  { id: "Nini", label: "Nini · 邻家妹妹" },
  { id: "Seren", label: "Seren · 小婉 · 助眠女声" },
  { id: "Pip", label: "Pip · 顽屁小孩" },
  { id: "Stella", label: "Stella · 少女阿月" },
  { id: "Bodega", label: "Bodega · 博德加 · 西班牙男" },
  { id: "Sonrisa", label: "Sonrisa · 索尼莎 · 拉美女" },
  { id: "Alek", label: "Alek · 阿列克 · 俄语男" },
  { id: "Dolce", label: "Dolce · 多尔切 · 意大利男" },
  { id: "Sohee", label: "Sohee · 素熙 · 韩语女" },
  { id: "Ono Anna", label: "Ono Anna · 小野杏" },
  { id: "Lenn", label: "Lenn · 莱恩 · 德语男" },
  { id: "Emilien", label: "Emilien · 埃米尔安 · 法语男" },
  { id: "Andre", label: "Andre · 安德雷 · 沉稳男" },
  { id: "Radio Gol", label: "Radio Gol · 足球解说" },
  { id: "Jada", label: "Jada · 上海-阿珍" },
  { id: "Dylan", label: "Dylan · 北京-晓东" },
  { id: "Li", label: "Li · 南京-老李" },
  { id: "Marcus", label: "Marcus · 陕西-秦川" },
  { id: "Roy", label: "Roy · 闽南-阿杰" },
  { id: "Peter", label: "Peter · 天津-李彼得" },
  { id: "Sunny", label: "Sunny · 四川-晴儿" },
  { id: "Eric", label: "Eric · 四川-程川" },
  { id: "Rocky", label: "Rocky · 粤语-阿强" },
  { id: "Kiki", label: "Kiki · 粤语-阿清" },
];

export function isQwen3TtsModelKey(modelKey: string): boolean {
  return modelKey.trim().toLowerCase() === "qwen3-tts";
}

export const QWEN_TTS_LANGUAGE_OPTIONS = [
  { value: "Chinese", label: "中文" },
  { value: "English", label: "English" },
] as const;

export const QWEN_TTS_LANGUAGE_SCHEMA = {
  key: "language_type",
  label: "语种",
  type: "select" as const,
  options: [...QWEN_TTS_LANGUAGE_OPTIONS],
  defaultValue: "Chinese",
};

export function qwen3TtsVoiceLabel(voiceId: string): string {
  const id = voiceId.trim();
  if (!id) return "音色";
  return QWEN3_TTS_FLASH_VOICES.find((v) => v.id === id)?.label ?? id;
}
