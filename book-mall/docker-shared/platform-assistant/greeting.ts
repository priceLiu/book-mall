/** AI 小智 · 个性化 + 每日轮换开场白（纯前端，不调用 LLM）。 */

export type GreetingUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const CLOSING =
  "有什么可以帮到您？关于平台的事宜，我尽可能来为您解答。（价格与计费请查看报价体系）";

/** 从 NextAuth / tools-session / introspect 响应解析展示名。 */
export function parseDisplayName(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const pick = (name?: unknown, email?: unknown, phone?: unknown): string | null => {
    if (typeof name === "string" && name.trim()) return name.trim();
    if (typeof email === "string" && email.includes("@")) {
      const local = email.split("@")[0]?.trim();
      if (local) return local;
    }
    if (typeof phone === "string") {
      const digits = phone.replace(/\D/g, "");
      if (digits.length >= 4) return `用户${digits.slice(-4)}`;
    }
    return null;
  };

  if (o.user && typeof o.user === "object") {
    const u = o.user as Record<string, unknown>;
    const n = pick(u.name, u.email, u.phone);
    if (n) return n;
  }

  if (o.introspect && typeof o.introspect === "object") {
    const intro = o.introspect as Record<string, unknown>;
    const n = pick(intro.name, intro.email, intro.phone);
    if (n) return n;
  }

  return pick(o.name, o.email, o.phone);
}

function daySeed(date: Date): number {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 固定公历节日问候（MM-DD）。 */
function holidayGreeting(date: Date): string | null {
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  const map: Record<string, string> = {
    "1-1": "元旦快乐，新的一年愿创作顺利！",
    "2-14": "情人节快乐，今天也别忘了给自己一点灵感～",
    "3-8": "妇女节快乐！",
    "5-1": "劳动节快乐，辛苦啦，适当休息一下也很重要。",
    "5-4": "青年节快乐！",
    "6-1": "儿童节快乐，保持一点童心，创意会更自由。",
    "9-10": "教师节快乐！",
    "10-1": "国庆节快乐，祝你假期创作愉快！",
    "12-25": "圣诞快乐！",
  };
  return map[md] ?? null;
}

function seasonalWeather(date: Date): string {
  const m = date.getMonth() + 1;
  const pool: string[] =
    m >= 6 && m <= 8
      ? [
          "最近天气偏热，记得多喝水、适当午休。",
          "夏日炎炎，室内创作记得通风，别中暑啦。",
          "今天适合待在空调房里慢慢打磨作品～",
        ]
      : m >= 12 || m <= 2
        ? [
            "天气偏冷，注意保暖，手别冻僵了才好打字改稿。",
            "冬日干燥，记得多喝温水，嗓子舒服灵感也更顺。",
            "天冷宜慢工出细活，今天适合沉下心来整理项目。",
          ]
        : m >= 3 && m <= 5
          ? [
              "春暖花开，适合开一个新项目试试手。",
              "春风和煦，今天心情也可以像天气一样轻快一点。",
              "气温回升，出门走走再回来创作，说不定有新点子。",
            ]
          : [
              "秋高气爽，很适合把分镜和素材理一理。",
              "天气转凉，热茶一杯，继续你的创作吧。",
              "今天空气不错，适合把待办清单勾掉几项。",
            ];
  return pool[daySeed(date) % pool.length];
}

function foodSuggestion(date: Date): string {
  const pool = [
    "今日小提示：来碗热汤面，暖胃也暖心。",
    "今天适合吃点清淡的，比如蔬菜沙拉或粥，头脑更清醒。",
    "忙里偷闲，可以来杯奶茶或咖啡，给自己一点奖励。",
    "午餐不妨试试番茄炒蛋配米饭，简单快速不耽误创作。",
    "晚餐宜七分饱，太撑容易犯困，影响晚上改稿效率。",
    "今天适合吃点水果，补充维生素，眼睛也舒服些。",
    "周末可以提前备点坚果或小零食，生成等待时不无聊。",
  ];
  return pool[(daySeed(date) + 3) % pool.length];
}

function dailyJoke(date: Date): string {
  const pool = [
    "小笑话：AI 说「我没有感情」，用户说「那你为什么总在我点生成时让我等待？」AI 沉默三秒：「……这叫 suspense。」",
    "小笑话：设计师朋友问 AI 要灵感，AI 回：「你先把参考图传齐。」朋友：「你比甲方还严谨。」",
    "小笑话：程序员改 bug 到深夜，AI 小智说早点休息；程序员说：「你先帮我把平台功能文档背熟。」",
    "小笑话：问：最稳定的生成参数是什么？答：用户已经睡着的那个。",
    "小笑话：创作最忌什么？忌「就差最后一张图」——然后差了一整晚。",
  ];
  return pool[(daySeed(date) + 7) % pool.length];
}

function weekdayTip(date: Date): string {
  const dow = date.getDay();
  const pool = [
    "周一加油，新的一周从熟悉平台功能开始也不错。",
    "周中啦，卡住的问题可以问我，我帮你理一理入口。",
    "快到周末了，把本周素材归档一下，下周更轻松。",
    "周末愉快，适合慢慢体验画布或工具站的新功能。",
    "周日适合复盘项目，顺便规划下周要用的应用。",
  ];
  if (dow === 0 || dow === 6) return pool[3 + (daySeed(date) % 2)];
  if (dow === 1) return pool[0];
  if (dow === 5) return pool[2];
  return pool[1];
}

/** 按日 deterministic 轮换：节日 > 天气/美食/笑话/周几提示。 */
export function buildDailyOpener(date = new Date()): string {
  const holiday = holidayGreeting(date);
  if (holiday) return holiday;

  const variants = [
    seasonalWeather(date),
    foodSuggestion(date),
    dailyJoke(date),
    weekdayTip(date),
  ];
  return variants[daySeed(date) % variants.length];
}

/** 组装完整欢迎语。 */
export function buildAssistantGreeting(
  displayName: string | null | undefined,
  date = new Date(),
): string {
  const opener = buildDailyOpener(date);
  const salutation = displayName?.trim()
    ? `${displayName.trim()}，您好！`
    : "您好！";
  return `${salutation}${opener}\n\n我是 AI 小智。${CLOSING}`;
}
