import {
  CONTENT_VERSION,
  PRODUCT_NAME,
  QUESTION_BANK_VERSION,
  RULE_VERSION,
  STORAGE_KEY,
} from "../content/versions";
import type { DimensionView, Report, SubScore } from "../model";

/** 云端协议。assessmentId=sensmap，assessmentVersion=sensmap-h5-v1。
 * 云端同意书编号是 consent-assessment-sensmap-1，写在 extensionData.consent.version。
 * 页面上的 CONSENT-1.1.0 只留在本机参与记录里，不放进上传体。
 *
 * 正文来自结果页当时的完整 Report，不在这里重算分数。
 * 自述（report.narrative）不上传。维度说明里的 narrative 是结果页短句，不是自述。
 */
export const ASSESSMENT_ID = "sensmap";
export const ASSESSMENT_NAME = PRODUCT_NAME;
export const ASSESSMENT_VERSION = "sensmap-h5-v1";
export const CONSENT_ID = "consent-assessment-sensmap-1";
export const SCHEMA_VERSION = "1.0.0";
export const READER_GAP = "阅读页若尚未重绘高敏感心力地图，维度、子板块、总结、课题、模式、作答和分数卡在 reportContent.viewModel 与 extensionData。自述不在这份结果里。";

type PublicReport = Omit<Report, "narrative">;

export type SensmapCloudResult = {
  reportId: string;
  assessmentId: typeof ASSESSMENT_ID;
  assessmentName: string;
  assessmentVersion: typeof ASSESSMENT_VERSION;
  nickname: string;
  completedAt: string;
  dimensions: ReturnType<typeof protocolDimensions>;
  result: {
    headline: string;
    code: string | null;
    label: string;
    summary: string;
    flags: string[];
  };
  interpretation: Array<{ id: string; title: string; text: string }>;
  recommendations: Array<{ id: string; title: null; text: string }>;
  reportContent: {
    format: "view-model+sections";
    viewModel: PublicReport;
    sections: Array<{ t: string; l?: number; x: string }>;
    textFallback: string;
  };
  extensionData: {
    versions: { questionBank: string; rule: string; content: string };
    answers: Report["answers"];
    scenarioAnswers: Report["scenarioAnswers"];
    score: Report["scores"];
    quality: { rushed: false };
    consent: {
      agreed: true;
      version: typeof CONSENT_ID;
      at: string;
      scopes: ["store", "share_link", "mentor_read"];
    };
    compat: { level: "partial"; gaps: string[] };
  };
  source: {
    site: string;
    path: string;
    repo: string;
    origin: string;
    pageUrl: string;
    clientSubmissionId: string;
    resultKitId: "sensmap";
    localKey: string;
  };
  schemaVersion: typeof SCHEMA_VERSION;
};

function chars(value: string) {
  return Array.from(value);
}

/** 云端昵称沿用结果页已确认的称呼，去掉首尾空白后最多 12 个字。 */
export function sensmapNickname(value: unknown) {
  const text = String(value ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  return chars(text).slice(0, 12).join("");
}

export function phoneNickname(value: unknown) {
  const text = String(value ?? "");
  if (/(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/.test(text)) return true;
  return /1[3-9]\d{9}/.test(text.replace(/\D/g, ""));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function versionOf(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** 历史记录只留了能画长图的摘要，没有作答和分数卡，不能拿来上传。 */
function publicReport(report: Report | null | undefined): PublicReport | null {
  if (!report || typeof report !== "object") return null;
  if (typeof report.summary !== "string" || !report.summary) return null;
  if (!Array.isArray(report.dimensions) || report.dimensions.length === 0) return null;
  if (!report.topic || typeof report.topic !== "object" || !report.topic.primaryName) return null;
  if (!Array.isArray(report.patterns)) return null;
  if (!report.answers || typeof report.answers !== "object" || Array.isArray(report.answers)) return null;
  if (Object.keys(report.answers).length === 0) return null;
  if (!Array.isArray(report.scenarioAnswers)) return null;
  if (!report.scores || !Array.isArray(report.scores.dimensions) || !Array.isArray(report.scores.subs)) return null;
  if (report.scores.subs.length === 0 || report.scores.dimensions.length === 0) return null;
  const copy = clone(report) as Report;
  delete (copy as Partial<Report>).narrative;
  return copy;
}

function subLine(subs: SubScore[] | DimensionView["subs"]) {
  return subs.map((sub) => `${sub.name} ${sub.score ?? "暂无分数"}`).join("，");
}

function protocolDimensions(report: PublicReport) {
  const dimensions = report.dimensions.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
    kind: "score" as const,
    score: dimension.score,
    max: 100,
    level: dimension.band,
    levelLabel: dimension.band,
    narrative: dimension.summaryLine,
    labels: [] as string[],
    extra: {
      deterministic: dimension.deterministic,
      subs: dimension.subs.map((sub) => ({ id: sub.id, name: sub.name, score: sub.score })),
    },
  }));
  const subs = report.dimensions.flatMap((dimension) =>
    dimension.subs.map((sub) => ({
      id: sub.id,
      name: sub.name,
      kind: "score" as const,
      score: sub.score,
      max: 100,
      level: null,
      levelLabel: null,
      narrative: sub.name,
      labels: [] as string[],
      extra: { dim: dimension.id },
    })),
  );
  return [...dimensions, ...subs];
}

function interpretation(report: PublicReport) {
  const blocks: Array<{ id: string; title: string; text: string }> = [
    { id: "verdict", title: "我的心力地图", text: report.summary },
    { id: "screen", title: "不是诊断", text: report.boundary },
  ];
  for (const dimension of report.dimensions) {
    blocks.push({
      id: dimension.id,
      title: dimension.name,
      text: `${dimension.summaryLine}。${subLine(dimension.subs)}`,
    });
  }
  for (const pattern of report.patterns) {
    blocks.push({
      id: pattern.id,
      title: pattern.name,
      text: pattern.nodes.map((node) => node.text).join(""),
    });
  }
  blocks.push({
    id: "topic",
    title: report.topic.primaryName,
    text: `可以试的一步：${report.topic.action}`,
  });
  if (report.clue?.text) blocks.push({ id: "clue", title: report.clue.title, text: report.clue.text });
  return blocks;
}

function sections(report: PublicReport) {
  const lines: Array<{ t: string; l?: number; x: string }> = [
    { t: "h", l: 2, x: "我的心力地图" },
    { t: "p", x: report.summary },
    { t: "p", x: report.boundary },
  ];
  for (const dimension of report.dimensions) {
    lines.push({ t: "p", x: `${dimension.name} ${dimension.score ?? "暂无分数"}。${subLine(dimension.subs)}` });
  }
  if (report.topic.primaryName) lines.push({ t: "p", x: `首要课题：${report.topic.primaryName}。可以试的一步：${report.topic.action}` });
  for (const pattern of report.patterns) lines.push({ t: "p", x: pattern.name });
  return lines;
}

export function buildSensmapResult(input?: {
  report?: Report | null;
  nickname?: unknown;
  reportId?: string;
  clientSubmissionId?: string;
  completedAt?: string;
} | null): SensmapCloudResult | null {
  const nickname = sensmapNickname(input?.nickname);
  if (!nickname || phoneNickname(input?.nickname) || phoneNickname(nickname)) return null;
  if (!input?.reportId || !input.clientSubmissionId || !input.completedAt) return null;
  const report = publicReport(input.report);
  if (!report) return null;

  const reportSections = sections(report);
  const score = clone(report.scores);
  return {
    reportId: input.reportId,
    assessmentId: ASSESSMENT_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: ASSESSMENT_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions: protocolDimensions(report),
    result: {
      headline: "我的心力地图",
      code: report.topic.primarySubId,
      label: report.topic.primaryName,
      summary: report.summary,
      flags: Array.isArray(report.anomalies) ? report.anomalies.slice() : [],
    },
    interpretation: interpretation(report),
    recommendations: [
      { id: "screen", title: null, text: report.boundary },
      { id: "reader", title: null, text: READER_GAP },
    ],
    reportContent: {
      format: "view-model+sections",
      viewModel: report,
      sections: reportSections,
      textFallback: reportSections.map((section) => section.x).join(""),
    },
    extensionData: {
      versions: {
        questionBank: versionOf(report.questionBankVersion, QUESTION_BANK_VERSION),
        rule: versionOf(report.ruleVersion, RULE_VERSION),
        content: versionOf(report.contentVersion, CONTENT_VERSION),
      },
      answers: clone(report.answers),
      scenarioAnswers: clone(report.scenarioAnswers),
      score,
      quality: { rushed: false },
      consent: {
        agreed: true,
        version: CONSENT_ID,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: { level: "partial", gaps: [READER_GAP] },
    },
    source: {
      site: ASSESSMENT_NAME,
      path: "index.html",
      repo: "sensitive-map",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/sensitive-map/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "sensmap",
      localKey: STORAGE_KEY,
    },
    schemaVersion: SCHEMA_VERSION,
  };
}
