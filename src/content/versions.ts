export const PRODUCT_NAME = "高敏感心力地图";

export const QUESTION_BANK_VERSION = "QB-1.1.0";
export const RULE_VERSION = "RR-1.1.0";
export const CONTENT_VERSION = "CT-1.1.0";
export const CONSENT_VERSION = "CONSENT-1.1.0";

/** 同分时的稳定顺序。分数高者优先；分数相同取更靠前的维度与子板块。 */
export const TIE_BREAK_RULE =
  "固定顺序：原生家庭（被接纳感→需求表达→冲突反应→自我价值感）→情感关系（关系确认→边界表达→冲突修复→亲密选择）→情绪困扰（情绪辨认→反复思虑→身体紧绷→日常消耗）→财富关系（金钱安全感→自我定价→消费愧疚→金钱边界）。分数高者优先；分数相同取顺序更靠前的一项。";

export const BOUNDARY_TEXT =
  "这是自我探索与需求梳理，不是临床诊断。分数只表示你在题目中报告的困扰多少，不判断疾病，不推断原因，也不承诺改变效果。";

export const RADAR_CAPTION =
  "分数越高，代表你在这个领域报告的困扰越多。";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const STORAGE_KEY = "sensitive-map-session-v1";
