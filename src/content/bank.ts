import type {
  DimId,
  Question,
  QuestionId,
  Scenario,
  ScenarioOption,
  SubId,
} from "../model";

export const DIMS: { id: DimId; name: string; order: number }[] = [
  { id: "F", name: "原生家庭", order: 0 },
  { id: "R", name: "情感关系", order: 1 },
  { id: "E", name: "情绪困扰", order: 2 },
  { id: "M", name: "财富关系", order: 3 },
];

export const DIM_NAME: Record<DimId, string> = {
  F: "原生家庭",
  R: "情感关系",
  E: "情绪困扰",
  M: "财富关系",
};

export const QUESTIONS: Question[] = [
  { id: "F01", dim: "F", sub: "F1", text: "即使已经尽力，我仍容易觉得自己做得不够好。" },
  { id: "F02", dim: "F", sub: "F1", text: "重要的人对我不满意时，我很快会怀疑自己是否值得被爱。" },
  { id: "F03", dim: "F", sub: "F2", text: "我想获得帮助或照顾时，常常说不出口。" },
  { id: "F04", dim: "F", sub: "F2", text: "我担心提出自己的需要，会给别人添麻烦或遭到拒绝。" },
  { id: "F05", dim: "F", sub: "F3", text: "与亲近的人发生矛盾时，我容易沉默、讨好或突然爆发。" },
  { id: "F06", dim: "F", sub: "F3", text: "发生冲突后，我会很久都不敢再提出自己的想法。" },
  { id: "F07", dim: "F", sub: "F4", text: "别人的认可会强烈影响我对自己的评价。" },
  { id: "F08", dim: "F", sub: "F4", text: "即使完成了一件重要的事，我仍觉得自己“不够好”。" },
  { id: "R01", dim: "R", sub: "R1", text: "对方回复变慢或语气变化时，我会反复猜测关系是否出了问题。" },
  { id: "R02", dim: "R", sub: "R1", text: "即使对方表达过在意，我仍经常想再次确认。" },
  { id: "R03", dim: "R", sub: "R2", text: "为了避免冲突，我会把真实的不满或需要憋回去。" },
  { id: "R04", dim: "R", sub: "R2", text: "对方越过我的界限时，我很难清楚地说“不”。" },
  { id: "R05", dim: "R", sub: "R3", text: "发生争执后，我很难平静地说清事情、感受和需要。" },
  { id: "R06", dim: "R", sub: "R3", text: "即使矛盾已经结束，我仍会反复回想，难以重新靠近对方。" },
  { id: "R07", dim: "R", sub: "R4", text: "忽冷忽热的互动容易牵动我，让我很难把注意力收回自己身上。" },
  { id: "R08", dim: "R", sub: "R4", text: "我有时会因为一段关系让我感觉强烈，而忽略长期相处是否合适。" },
  { id: "E01", dim: "E", sub: "E1", text: "我知道自己不舒服，却说不清具体是什么情绪。" },
  { id: "E02", dim: "E", sub: "E1", text: "我常先处理别人的感受，过后才发现自己已经很难受。" },
  { id: "E03", dim: "E", sub: "E2", text: "不愉快的事情过去后，我仍会反复回想。" },
  { id: "E04", dim: "E", sub: "E2", text: "对方一句话或一个表情，会让我想很久。" },
  { id: "E05", dim: "E", sub: "E3", text: "遇到压力时，我会明显感到身体紧绷，却很难缓下来。" },
  { id: "E06", dim: "E", sub: "E3", text: "即使有休息时间，我也常觉得自己没有真正放松。" },
  { id: "E07", dim: "E", sub: "E4", text: "情绪消耗影响了我的睡眠、专注或做事状态。" },
  { id: "E08", dim: "E", sub: "E4", text: "我能把事情做完，却经常感觉自己是在硬撑。" },
  { id: "M01", dim: "M", sub: "M1", text: "即使眼前没有紧急财务问题，我仍常为未来的钱感到不安。" },
  { id: "M02", dim: "M", sub: "M1", text: "收入有波动时，我很难稳住自己，容易反复想最坏的结果。" },
  { id: "M03", dim: "M", sub: "M2", text: "谈报酬、报价或提出加薪时，我很难坦然表达自己的价值。", allowNa: true },
  { id: "M04", dim: "M", sub: "M2", text: "即使投入了很多，我仍担心自己“不配收这么多”。" },
  { id: "M05", dim: "M", sub: "M3", text: "为自己的合理需要花钱时，我容易感到愧疚。" },
  { id: "M06", dim: "M", sub: "M3", text: "买了让自己开心的东西后，我常忍不住责备自己。" },
  { id: "M07", dim: "M", sub: "M4", text: "面对亲近之人的金钱请求，我很难按自己的实际情况拒绝。" },
  { id: "M08", dim: "M", sub: "M4", text: "钱和关系放在一起时，我容易委屈自己来避免冲突。" },
];

export const QUESTION_MAP = Object.fromEntries(
  QUESTIONS.map((item) => [item.id, item]),
) as Record<QuestionId, Question>;

const NONE = "以上都不像我";

function options(
  a: string,
  b: string,
  c: string,
  d: string,
): ScenarioOption[] {
  return [
    { id: "A", text: a },
    { id: "B", text: b },
    { id: "C", text: c },
    { id: "D", text: d },
    { id: "E", text: NONE },
  ];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "S-F1",
    sub: "F1",
    prompt: "最近一次你觉得自己已经尽力了，对方仍不满意。你最接近哪种反应？",
    options: options(
      "马上觉得是自己不够好",
      "怀疑自己是不是不值得被爱",
      "有点难受，但还能把这件事和自我价值分开",
      "先问问对方具体不满意什么",
    ),
  },
  {
    id: "S-F2",
    sub: "F2",
    prompt: "你很累，希望有人帮你分担一件具体的事。你最接近哪种反应？",
    options: options(
      "话到嘴边又咽回去",
      "担心说出来会给人添麻烦",
      "用开玩笑带过，不直接说需要",
      "清楚地说出自己需要什么帮助",
    ),
  },
  {
    id: "S-F3",
    sub: "F3",
    prompt: "和亲近的人意见不一致，空气变得紧张。你最接近哪种反应？",
    options: options(
      "先沉默，尽量顺着对方",
      "一时压住，后来突然爆发",
      "很久都不敢再提自己的想法",
      "还能把不同意见说出来",
    ),
  },
  {
    id: "S-F4",
    sub: "F4",
    prompt: "你刚完成一件重要的事，别人还没有表态。你最接近哪种反应？",
    options: options(
      "没有认可，就很难肯定自己",
      "即使做成了，仍觉得不够好",
      "会反复想别人会怎么评价",
      "能自己承认这件事已经完成",
    ),
  },
  {
    id: "S-R1",
    sub: "R1",
    prompt: "对方半天没有回复消息。你最接近哪种反应？",
    options: options(
      "担心对方不再在意我",
      "回想自己是不是说错了话",
      "感到生气，想先冷落对方",
      "先继续做自己的事",
    ),
  },
  {
    id: "S-R2",
    sub: "R2",
    prompt: "对方再次提出一件你并不愿意做的事。你最接近哪种反应？",
    options: options(
      "把不满憋回去，先答应",
      "想拒绝，但很难说出“不”",
      "答应之后再独自难受",
      "直接说明自己的界限",
    ),
  },
  {
    id: "S-R3",
    sub: "R3",
    prompt: "一次争执刚过去，对方表示可以聊聊。你最接近哪种反应？",
    options: options(
      "很难平静地说清事情、感受和需要",
      "事情过了，仍反复回想，不敢靠近",
      "想和好，但不知道从哪一句开始",
      "可以约一个时间把事情说完",
    ),
  },
  {
    id: "S-R4",
    sub: "R4",
    prompt: "一段关系忽冷忽热，对方偶尔又很热情。你最接近哪种反应？",
    options: options(
      "被牵动，很难把注意力收回自己",
      "因为感觉强烈，暂时顾不上它是否适合长期相处",
      "不断查看对方的动态",
      "能先停下来看这段关系是否合适",
    ),
  },
  {
    id: "S-E1",
    sub: "E1",
    prompt: "一件事让你不舒服，有人问你怎么了。你最接近哪种反应？",
    options: options(
      "知道不舒服，却说不清是什么情绪",
      "先去安抚别人，过后才发现自己很难受",
      "用“还好”带过",
      "能说出至少一种具体感受",
    ),
  },
  {
    id: "S-E2",
    sub: "E2",
    prompt: "一件不愉快的事已经结束。你最接近哪种反应？",
    options: options(
      "仍会反复回想细节",
      "对方的一句话或一个表情会在心里停留很久",
      "想做别的事，注意力还是被拉回去",
      "能把注意力放回当下要做的事",
    ),
  },
  {
    id: "S-E3",
    sub: "E3",
    prompt: "压力已经过去，你有一段可以休息的时间。你最接近哪种反应？",
    options: options(
      "身体仍明显紧绷，很难缓下来",
      "人是闲下来了，却觉得没有真正放松",
      "用刷手机撑过这段时间",
      "能感到身体慢慢松开",
    ),
  },
  {
    id: "S-E4",
    sub: "E4",
    prompt: "这周有几件必须完成的事。你最接近哪种反应？",
    options: options(
      "睡眠、专注或做事状态已经受到影响",
      "事情能做完，但感觉自己在硬撑",
      "做着做着就想先躲开",
      "还能按自己的节奏完成",
    ),
  },
  {
    id: "S-M1",
    sub: "M1",
    prompt: "这个月没有紧急账单，但收入并不稳定。你最接近哪种反应？",
    options: options(
      "仍常常为未来的钱感到不安",
      "一想到波动，就反复设想最坏的结果",
      "很难把注意力放回眼前的安排",
      "会不安，但还能看清眼前要处理的事",
    ),
  },
  {
    id: "S-M2",
    sub: "M2",
    prompt: "需要谈报酬、报价，或说出自己的价值。你最接近哪种反应？",
    options: options(
      "很难坦然说出自己的价值",
      "即使投入很多，仍担心不配收这么多",
      "先报一个更低的数字让自己安心",
      "能按投入和结果说明自己的报价",
    ),
  },
  {
    id: "S-M3",
    sub: "M3",
    prompt: "你为自己的合理需要买了一件东西。你最接近哪种反应？",
    options: options(
      "付钱时就感到愧疚",
      "买完后忍不住责备自己",
      "想对别人隐瞒这笔花费",
      "能把它看成一次合理的花费",
    ),
  },
  {
    id: "S-M4",
    sub: "M4",
    prompt: "亲近的人开口向你借钱，或让你分担一笔开支。你最接近哪种反应？",
    options: options(
      "很难按自己的实际情况拒绝",
      "为了避免冲突，委屈自己答应",
      "答应后长时间不舒服，却不说",
      "能根据自己的情况决定是否答应",
    ),
  },
];

export const GENERIC_SCENARIO: Scenario = {
  id: "S-GENERIC",
  sub: "F1",
  generic: true,
  prompt: "这件事最接近你的哪一种反应？",
  options: options(
    "我会很快怪自己",
    "我会先压下自己的需要",
    "我会反复想，很难放下",
    "我还能回到自己的安排",
  ),
};

export const SCENARIO_BY_SUB = Object.fromEntries(
  SCENARIOS.map((item) => [item.sub, item]),
) as Record<SubId, Scenario>;

export const LIKERT_OPTIONS: { value: 0 | 1 | 2 | 3 | 4; short: string; full: string }[] = [
  { value: 0, short: "完全不符", full: "完全不符合" },
  { value: 1, short: "偶尔", full: "偶尔符合" },
  { value: 2, short: "有时", full: "有时符合" },
  { value: 3, short: "经常", full: "经常符合" },
  { value: 4, short: "几乎总是", full: "几乎总是如此" },
];

export const IMPACT_OPTIONS: { value: 0 | 1 | 2 | 3 | 4; label: string }[] = [
  { value: 0, label: "没有明显影响" },
  { value: 1, label: "轻微" },
  { value: 2, label: "有一些" },
  { value: 3, label: "较大" },
  { value: 4, label: "很大" },
];

export const IMPACT_PROMPTS: Record<DimId, string> = {
  F: "原生家庭的相关困扰，对你的生活造成了多大影响？",
  R: "情感关系的相关困扰，对你的生活造成了多大影响？",
  E: "情绪困扰，对你的生活造成了多大影响？",
  M: "财富关系的相关困扰，对你的生活造成了多大影响？",
};

export const QUIZ_PAGES: QuestionId[][] = Array.from({ length: 8 }, (_, page) =>
  QUESTIONS.slice(page * 4, page * 4 + 4).map((item) => item.id),
);

export function answerLabel(answer: 0 | 1 | 2 | 3 | 4 | "na"): string {
  if (answer === "na") return "暂不适用";
  return LIKERT_OPTIONS[answer].full;
}

export function impactLabel(value: 0 | 1 | 2 | 3 | 4): string {
  return IMPACT_OPTIONS[value].label;
}
