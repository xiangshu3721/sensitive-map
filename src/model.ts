export type DimId = "F" | "R" | "E" | "M";
export type ChoiceId = DimId | "unclear";

export type SubId =
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "E1"
  | "E2"
  | "E3"
  | "E4"
  | "M1"
  | "M2"
  | "M3"
  | "M4";

export type QuestionId =
  | "F01"
  | "F02"
  | "F03"
  | "F04"
  | "F05"
  | "F06"
  | "F07"
  | "F08"
  | "R01"
  | "R02"
  | "R03"
  | "R04"
  | "R05"
  | "R06"
  | "R07"
  | "R08"
  | "E01"
  | "E02"
  | "E03"
  | "E04"
  | "E05"
  | "E06"
  | "E07"
  | "E08"
  | "M01"
  | "M02"
  | "M03"
  | "M04"
  | "M05"
  | "M06"
  | "M07"
  | "M08";

export type Likert = 0 | 1 | 2 | 3 | 4;
export type Answer = Likert | "na";

export type Step =
  | "home"
  | "consent"
  | "quiz"
  | "impact"
  | "scenario"
  | "needs"
  | "result"
  | "preview"
  | "privacy";

export type Question = {
  id: QuestionId;
  dim: DimId;
  sub: SubId;
  text: string;
  allowNa?: boolean;
};

export type ScenarioOption = {
  id: "A" | "B" | "C" | "D" | "E";
  text: string;
};

export type Scenario = {
  id: string;
  sub: SubId;
  prompt: string;
  options: ScenarioOption[];
  generic?: boolean;
};

export type PatternNode = {
  key: "trigger" | "feeling" | "thought" | "action" | "impact";
  label: string;
  questionIds: QuestionId[];
  statement: string;
  ask: string;
};

export type SubDef = {
  id: SubId;
  dim: DimId;
  name: string;
  order: number;
  patternName: string;
  dailyOften: string;
  dailySometimes: string;
  step: string;
  nodes: PatternNode[];
};

export type Highlight = {
  questionId: QuestionId;
  text: string;
  answer: Answer;
  answerLabel: string;
};

export type SubScore = {
  id: SubId;
  dim: DimId;
  name: string;
  order: number;
  score: number | null;
  validCount: number;
};

export type DimScore = {
  id: DimId;
  name: string;
  score: number | null;
  band: string | null;
  validCount: number;
  deterministic: boolean;
  subs: SubScore[];
};

export type ScoreCard = {
  dimensions: DimScore[];
  subs: SubScore[];
};

export type ChainNodeView = {
  key: PatternNode["key"];
  label: string;
  text: string;
  mode: "stated" | "ask";
  questionIds: QuestionId[];
};

export type PatternView = {
  id: string;
  subId: SubId;
  name: string;
  score: number;
  nodes: ChainNodeView[];
};

export type ClueView = {
  title: string;
  text: string;
};

export type DimensionView = {
  id: DimId;
  name: string;
  score: number | null;
  band: string | null;
  deterministic: boolean;
  subs: { id: SubId; name: string; score: number | null }[];
  highlights: Highlight[];
  daily: string;
  alternative: string;
  step: string;
  human: string;
  summaryLine: string;
  helpNote: string | null;
};

export type TopicView = {
  primarySubId: SubId | null;
  primaryName: string;
  primaryDimId: DimId | null;
  primaryDimName: string;
  secondarySubId: SubId | null;
  secondaryName: string | null;
  secondaryReason: string | null;
  action: string;
  showBoth: boolean;
  companionText: string | null;
  basis: string[];
  closeNote: string | null;
  overrode: boolean;
};

export type ScenarioPick = {
  question: Scenario;
  subId: SubId;
  subName: string;
  score: number;
  anomaly: string | null;
};

export type Report = {
  id: string;
  productName: string;
  questionBankVersion: string;
  ruleVersion: string;
  contentVersion: string;
  tieBreakRule: string;
  createdAt: string;
  summary: string;
  scores: ScoreCard;
  answers: Partial<Record<QuestionId, Answer>>;
  impact: Record<DimId, Likert>;
  scenarioPicks: ScenarioPick[];
  scenarioAnswers: { questionId: string; optionId: string }[];
  choice: ChoiceId;
  narrative: string;
  patterns: PatternView[];
  clue: ClueView;
  dimensions: DimensionView[];
  topic: TopicView;
  helpNotice: string | null;
  boundary: string;
  anomalies: string[];
  patternIds: string[];
  primaryTopicId: SubId | null;
};

export type ConsentRecord = {
  participate: {
    agreed: true;
    at: string;
    version: string;
  } | null;
  saveResult: {
    agreed: boolean;
    at: string;
  } | null;
  contact: {
    agreed: boolean;
    at: string;
  } | null;
};

export type Session = {
  id: string;
  productName: string;
  questionBankVersion: string;
  ruleVersion: string;
  startedAt: string;
  updatedAt: string;
  step: Step;
  nick?: string;
  quizPage: number;
  consent: ConsentRecord;
  answers: Partial<Record<QuestionId, Answer>>;
  impact: Partial<Record<DimId, Likert>>;
  scenarioAnswers: { questionId: string; optionId: string }[];
  choice: ChoiceId | null;
  narrative: string;
  report: Report | null;
  reportError: string | null;
  returnStep: Step | null;
};

export type OpsConfig = {
  bookingOpen: boolean;
  qrImageUrl: string;
  receptionIdentity: string;
  headline: string;
  body: string;
  bookingMessage: string;
  service: {
    form: string;
    duration: string;
    price: string;
    hours: string;
    capacity: string;
  };
};

export type BookingView = {
  available: boolean;
  headline: string;
  body: string;
  bookingMessage: string;
  qrImageUrl: string;
  receptionIdentity: string;
  serviceLines: { label: string; value: string }[];
};
