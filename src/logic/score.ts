import { DIM_NAME, QUESTIONS } from "../content/bank";
import { SUBS, bandOf } from "../content/library";
import type { Answer, DimId, DimScore, QuestionId, ScoreCard, SubScore } from "../model";

const MIN_VALID_FOR_INTERPRETATION = 6;

export function isScored(answer: Answer | undefined): answer is 0 | 1 | 2 | 3 | 4 {
  return typeof answer === "number";
}

export function toPercent(sum: number, validCount: number): number | null {
  if (validCount <= 0) return null;
  return Math.round((sum / (validCount * 4)) * 100);
}

export function scoreAnswers(answers: Partial<Record<QuestionId, Answer>>): ScoreCard {
  const subs: SubScore[] = SUBS.map((sub) => {
    const items = QUESTIONS.filter((item) => item.sub === sub.id);
    const valid = items.filter((item) => isScored(answers[item.id]));
    const sum = valid.reduce((total, item) => total + (answers[item.id] as number), 0);
    return {
      id: sub.id,
      dim: sub.dim,
      name: sub.name,
      order: sub.order,
      score: toPercent(sum, valid.length),
      validCount: valid.length,
    };
  });

  const dimensions: DimScore[] = (["F", "R", "E", "M"] as DimId[]).map((dim) => {
    const items = QUESTIONS.filter((item) => item.dim === dim);
    const valid = items.filter((item) => isScored(answers[item.id]));
    const sum = valid.reduce((total, item) => total + (answers[item.id] as number), 0);
    const score = toPercent(sum, valid.length);
    const deterministic = valid.length >= MIN_VALID_FOR_INTERPRETATION && score !== null;
    return {
      id: dim,
      name: DIM_NAME[dim],
      score,
      band: deterministic && score !== null ? bandOf(score) : null,
      validCount: valid.length,
      deterministic,
      subs: subs.filter((item) => item.dim === dim),
    };
  });

  return { dimensions, subs };
}

export function rankedSubs(subs: SubScore[]): SubScore[] {
  return [...subs]
    .filter((item) => item.score !== null)
    .sort((a, b) => b.score! - a.score! || a.order - b.order);
}

export function highestSub(subs: SubScore[], dim?: DimId): SubScore | null {
  const pool = dim ? subs.filter((item) => item.dim === dim) : subs;
  return rankedSubs(pool)[0] ?? null;
}

export function scoresAreClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 5;
}
