import { CONSENT_VERSION } from "../content/versions";
import { scoreAnswers } from "../logic/score";
import { pickScenarios } from "../logic/select";
import { buildReport } from "../logic/report";
import type { ChoiceId, Likert, QuestionId, Step } from "../model";
import { createSession } from "../session/store";
import { QUESTIONS } from "../content/bank";

type Spec = {
  base: Likert;
  overrides: Partial<Record<QuestionId, Likert>>;
  impact: Likert;
  impactOverrides?: Partial<Record<"F" | "R" | "E" | "M", Likert>>;
  choice: ChoiceId;
};

const CASES: Record<string, Spec> = {
  jia: {
    base: 1,
    overrides: { R01: 4, R02: 4, R03: 2, R04: 2, R05: 2, R06: 2, R07: 2, R08: 2 },
    impact: 1,
    impactOverrides: { R: 3 },
    choice: "R",
  },
  yi: {
    base: 1,
    overrides: { R01: 1, R02: 1, R03: 4, R04: 4, R05: 3, R06: 3, R07: 2, R08: 2 },
    impact: 1,
    impactOverrides: { R: 3 },
    choice: "R",
  },
  bing: {
    base: 1,
    overrides: { R01: 2, R02: 2, R03: 2, R04: 2, R05: 2, R06: 2, R07: 4, R08: 4 },
    impact: 1,
    impactOverrides: { R: 3 },
    choice: "R",
  },
  low: {
    base: 0,
    overrides: {},
    impact: 0,
    choice: "unclear",
  },
};

export function seedCase(name: string) {
  const spec = CASES[name];
  if (!spec) return null;
  const answers = Object.fromEntries(QUESTIONS.map((item) => [item.id, spec.base])) as Record<
    QuestionId,
    Likert
  >;
  Object.assign(answers, spec.overrides);
  const impact = {
    F: spec.impact,
    R: spec.impact,
    E: spec.impact,
    M: spec.impact,
    ...spec.impactOverrides,
  };
  const session = createSession();
  const now = new Date().toISOString();
  const picks = pickScenarios(scoreAnswers(answers).subs).picks;
  const scenarioAnswers = picks.map((item) => ({ questionId: item.question.id, optionId: "A" }));
  const report = buildReport({
    id: session.id,
    answers,
    impact,
    scenarioAnswers,
    choice: spec.choice,
    narrative: "",
    createdAt: now,
  });
  return {
    ...session,
    step: "result" as Step,
    consent: {
      participate: { agreed: true as const, at: now, version: CONSENT_VERSION },
      saveResult: null,
      contact: null,
    },
    answers,
    impact,
    scenarioAnswers,
    choice: spec.choice,
    report,
    updatedAt: now,
  };
}

export const DEV_CASES = [
  { id: "jia", label: "样例：等待与确认" },
  { id: "yi", label: "样例：边界与表达" },
  { id: "bing", label: "样例：亲密选择" },
  { id: "low", label: "样例：低分" },
];
