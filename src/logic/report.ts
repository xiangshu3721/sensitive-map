import { DIM_NAME, QUESTIONS, QUESTION_MAP, answerLabel } from "../content/bank";
import {
  DIM_COPY,
  HELP_NOTICE,
  HIGH_HUMAN,
  INSUFFICIENT_TEXT,
  LOW_HUMAN,
  SUB_MAP,
  bandOf,
} from "../content/library";
import {
  BOUNDARY_TEXT,
  CONTENT_VERSION,
  PRODUCT_NAME,
  QUESTION_BANK_VERSION,
  RADAR_CAPTION,
  RULE_VERSION,
  TIE_BREAK_RULE,
} from "../content/versions";
import type {
  Answer,
  ChoiceId,
  DimId,
  DimensionView,
  Highlight,
  Likert,
  QuestionId,
  Report,
  SubId,
} from "../model";
import { highestSub, scoreAnswers } from "./score";
import { buildClue, buildPatterns, pickScenarios, pickTopic, renderSummary } from "./select";

export const RESULT_SECTION_ORDER = [
  "title",
  "radar",
  "dimensions",
  "patterns",
  "topic",
  "booking",
  "export",
  "privacy",
] as const;

const DIMS: DimId[] = ["F", "R", "E", "M"];

export type ReportInput = {
  id: string;
  answers: Partial<Record<QuestionId, Answer>>;
  impact: Partial<Record<DimId, Likert>>;
  scenarioAnswers: { questionId: string; optionId: string }[];
  choice: ChoiceId | null;
  narrative: string;
  createdAt?: string;
  overrideSubId?: SubId | null;
};

export function buildReport(input: ReportInput): Report {
  assertComplete(input);
  const answers = input.answers;
  const impact = input.impact as Record<DimId, Likert>;
  const choice = input.choice as ChoiceId;
  const card = scoreAnswers(answers);
  const { picks, anomalies } = pickScenarios(card.subs);
  const pickIds = new Set(picks.map((item) => item.question.id));
  const scenarioAnswers = input.scenarioAnswers.filter((item) => pickIds.has(item.questionId));
  if (scenarioAnswers.length < picks.length) {
    throw new Error("情境题需要按当前分数最高的子板块重新作答。");
  }
  const patterns = buildPatterns(card, answers);
  const clue = buildClue(card, answers, impact, scenarioAnswers, picks, patterns);
  const topic = pickTopic({
    choice,
    impact,
    card,
    override: input.overrideSubId,
  });
  const helpNotice = needsHelp(answers, impact) ? HELP_NOTICE : null;
  const dimensions = DIMS.map((dim) => renderDimension(dim, card, answers, impact, helpNotice));
  const summary = renderSummary({ choice, card, topic });

  return {
    id: input.id,
    productName: PRODUCT_NAME,
    questionBankVersion: QUESTION_BANK_VERSION,
    ruleVersion: RULE_VERSION,
    contentVersion: CONTENT_VERSION,
    tieBreakRule: TIE_BREAK_RULE,
    createdAt: input.createdAt ?? new Date().toISOString(),
    summary,
    scores: card,
    answers: { ...answers },
    impact: { ...impact },
    scenarioPicks: picks,
    scenarioAnswers: scenarioAnswers.map((item) => ({ ...item })),
    choice,
    narrative: input.narrative.trim(),
    patterns,
    clue,
    dimensions,
    topic,
    helpNotice,
    boundary: BOUNDARY_TEXT,
    anomalies,
    patternIds: patterns.map((item) => item.id),
    primaryTopicId: topic.primarySubId,
  };
}

export function applyTopicOverride(report: Report, subId: SubId): Report {
  const topic = pickTopic({
    choice: report.choice,
    impact: report.impact,
    card: report.scores,
    override: subId,
  });
  topic.basis.unshift(`系统原先建议的首要课题是「${report.topic.primaryName}」。`);
  return {
    ...report,
    topic,
    primaryTopicId: topic.primarySubId,
  };
}

function assertComplete(input: ReportInput): void {
  for (const question of QUESTIONS) {
    const value = input.answers[question.id];
    if (question.allowNa) {
      if (value !== "na" && typeof value !== "number") {
        throw new Error(`题目 ${question.id} 还没有作答。`);
      }
    } else if (typeof value !== "number") {
      throw new Error(`题目 ${question.id} 还没有作答。`);
    }
  }
  for (const dim of DIMS) {
    if (typeof input.impact[dim] !== "number") {
      throw new Error("生活影响题还没有完成。");
    }
  }
  if (!input.choice) throw new Error("还没有选择最先想改变的领域。");
  if (input.scenarioAnswers.length < 2) throw new Error("情境题还没有完成。");
}

function needsHelp(
  answers: Partial<Record<QuestionId, Answer>>,
  impact: Record<DimId, Likert>,
): boolean {
  const e7 = answers.E07;
  if (typeof e7 === "number" && e7 >= 3) return true;
  return impact.E >= 3;
}

function renderDimension(
  dim: DimId,
  card: ReturnType<typeof scoreAnswers>,
  answers: Partial<Record<QuestionId, Answer>>,
  impact: Record<DimId, Likert>,
  helpNotice: string | null,
): DimensionView {
  const scored = card.dimensions.find((item) => item.id === dim)!;
  const copy = DIM_COPY[dim];
  const top = highestSub(card.subs, dim);
  const subs = scored.subs.map((item) => ({
    id: item.id,
    name: item.name,
    score: item.score,
  }));

  if (!scored.deterministic || scored.score === null) {
    return {
      id: dim,
      name: DIM_NAME[dim],
      score: null,
      band: null,
      deterministic: false,
      subs,
      highlights: [],
      daily: INSUFFICIENT_TEXT,
      alternative: INSUFFICIENT_TEXT,
      step: INSUFFICIENT_TEXT,
      human: INSUFFICIENT_TEXT,
      summaryLine: `${DIM_NAME[dim]} · 有效题不足，不输出确定性解释`,
      helpNote: dim === "E" ? helpNotice : null,
    };
  }

  const low = scored.score <= 24;
  const highlights = collectHighlights(dim, answers);
  const daily = low
    ? copy.lowDaily
    : scored.score >= 50
      ? (top ? SUB_MAP[top.id].dailyOften : copy.lowDaily)
      : (top ? SUB_MAP[top.id].dailySometimes : copy.lowDaily);
  const step = low || !top ? copy.lowStep : SUB_MAP[top.id].step;
  const human = scored.score >= 50 || impact[dim] >= 3 ? HIGH_HUMAN : LOW_HUMAN;
  const topName = top && (top.score ?? 0) >= 25 ? top.name : "";
  const summaryLine = topName
    ? `${DIM_NAME[dim]} · ${scored.score} · ${bandOf(scored.score)} · 较突出的是${topName}`
    : `${DIM_NAME[dim]} · ${scored.score} · ${bandOf(scored.score)}`;

  return {
    id: dim,
    name: DIM_NAME[dim],
    score: scored.score,
    band: bandOf(scored.score),
    deterministic: true,
    subs,
    highlights: low ? highlights.slice(0, 1) : highlights,
    daily,
    alternative: copy.alternative,
    step,
    human,
    summaryLine,
    helpNote: dim === "E" ? helpNotice : null,
  };
}

function collectHighlights(
  dim: DimId,
  answers: Partial<Record<QuestionId, Answer>>,
): Highlight[] {
  return QUESTIONS.filter((item) => item.dim === dim)
    .map((item) => ({ item, value: answers[item.id] }))
    .filter((entry): entry is { item: (typeof QUESTIONS)[number]; value: Likert } =>
      typeof entry.value === "number" && entry.value >= 3,
    )
    .sort((a, b) => b.value - a.value || a.item.id.localeCompare(b.item.id))
    .slice(0, 3)
    .map((entry) => ({
      questionId: entry.item.id,
      text: entry.item.text,
      answer: entry.value,
      answerLabel: answerLabel(entry.value),
    }));
}

export function defaultExpandedDim(report: Report): DimId {
  const ranked = [...report.dimensions]
    .filter((item) => item.score !== null)
    .sort((a, b) => b.score! - a.score! || DIMS.indexOf(a.id) - DIMS.indexOf(b.id));
  return ranked[0]?.id ?? "F";
}

export function exportPlainText(report: Report, variant: "private" | "share"): string {
  const lines: string[] = [
    report.productName,
    report.summary,
    RADAR_CAPTION,
    ...report.dimensions.map((dim) => {
      const subs = dim.subs
        .map((sub) => `${sub.name}${sub.score ?? "暂无分数"}`)
        .join(" ");
      return `${dim.name} ${dim.score ?? "证据不足"} ${dim.band ?? ""} ${subs}`;
    }),
  ];
  if (variant === "private") {
    for (const dim of report.dimensions) {
      lines.push(dim.daily, dim.alternative, dim.step, dim.human);
      for (const highlight of dim.highlights) lines.push(highlight.text);
      if (dim.helpNote) lines.push(dim.helpNote);
    }
    for (const pattern of report.patterns) {
      lines.push(pattern.name);
      for (const node of pattern.nodes) lines.push(node.text, node.questionIds.join(" "));
    }
    lines.push(report.clue.text, report.topic.primaryName, report.topic.action);
    lines.push(...report.topic.basis);
  } else {
    lines.push(...report.patterns.map((item) => item.name));
    lines.push(report.topic.primaryName);
  }
  lines.push(report.boundary, report.questionBankVersion, report.ruleVersion);
  return lines.join("\n");
}

export function questionStem(id: QuestionId): string {
  return QUESTION_MAP[id].text;
}
