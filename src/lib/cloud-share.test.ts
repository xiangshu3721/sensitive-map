import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../content/bank";
import { CONSENT_VERSION, CONTENT_VERSION, QUESTION_BANK_VERSION, RULE_VERSION } from "../content/versions";
import { buildReport, type ReportInput } from "../logic/report";
import { pickScenarios } from "../logic/select";
import { scoreAnswers } from "../logic/score";
import type { Answer, DimId, Likert, QuestionId, Report } from "../model";
import { ASSESSMENT_CLOUD_CONFIG, LINKS_KEY, parseShareLink, PENDING_KEY } from "./cloud-client";
import { ASSESSMENT_ID, ASSESSMENT_VERSION, buildSensmapResult, CONSENT_ID } from "./cloud-payload";
import { activateSensmapShare, sensmapShareKey, watchSensmapShare, type CloudDeps, type ShareView } from "./cloud-share";

const NARRATIVE = "NARRATIVE_SECRET_9f3c 自述不要上传";

function liveReport(): Report {
  const answers = Object.fromEntries(QUESTIONS.map((item) => [item.id, 2])) as Record<QuestionId, Answer>;
  answers.F01 = 4;
  const impact = { F: 1, R: 2, E: 3, M: 1 } as Record<DimId, Likert>;
  const scored = scoreAnswers(answers);
  const picks = pickScenarios(scored.subs).picks;
  const input: ReportInput = {
    id: "report-live",
    answers,
    impact,
    scenarioAnswers: picks.map((item) => ({ questionId: item.question.id, optionId: "B" })),
    choice: "E",
    narrative: NARRATIVE,
    createdAt: "2026-10-24T01:02:03.000Z",
  };
  return buildReport(input);
}

/** 与本地历史 rk.v1.sensmap 一样，只留能画长图的摘要。 */
function historyShape(report: Report) {
  return {
    productName: report.productName,
    questionBankVersion: report.questionBankVersion,
    ruleVersion: report.ruleVersion,
    createdAt: report.createdAt,
    summary: report.summary,
    dimensions: report.dimensions,
    topic: report.topic,
    patterns: report.patterns,
    clue: report.clue,
    helpNotice: report.helpNotice,
    anomalies: report.anomalies,
    boundary: report.boundary,
  };
}

function memoryStorage() {
  const data = new Map<string, string>();
  const reads: string[] = [];
  return {
    reads,
    data,
    storage: {
      getItem(key: string) {
        reads.push(key);
        return data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        data.set(key, value);
      },
    },
  };
}

function deps(storage: CloudDeps["storage"], fetchImpl: typeof fetch, extra: Partial<CloudDeps> = {}): Partial<CloudDeps> {
  return {
    storage,
    fetch: fetchImpl,
    location: { hostname: "localhost", origin: "http://localhost:5173" },
    schedule: () => {
      const id = setTimeout(() => {}, 0);
      (id as unknown as { unref?: () => void }).unref?.();
      return id;
    },
    clear() {},
    ...extra,
  };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("云端结果", () => {
  it("用当场的分数卡，不重算，也不带自述和页面同意书版本", () => {
    const report = liveReport();
    const original = report.scores.dimensions[0]?.score;
    report.scores.dimensions[0]!.score = 7;
    report.scores.subs[0]!.score = 7;
    const payload = buildSensmapResult({
      report,
      nickname: `  ${"林深".repeat(6)}尾  `,
      reportId: "rpt_abcdefghijk",
      clientSubmissionId: "sub_abcdefghijklmnop",
      completedAt: "2026-10-24T09:02:03+08:00",
    });
    expect(payload).not.toBeNull();
    expect(payload!.assessmentId).toBe(ASSESSMENT_ID);
    expect(payload!.assessmentVersion).toBe(ASSESSMENT_VERSION);
    expect(payload!.nickname).toBe("林深".repeat(6));
    expect(payload!.extensionData.consent.version).toBe(CONSENT_ID);
    expect(payload!.extensionData.consent.agreed).toBe(true);
    expect(payload!.extensionData.versions).toEqual({
      questionBank: QUESTION_BANK_VERSION,
      rule: RULE_VERSION,
      content: CONTENT_VERSION,
    });
    expect(payload!.extensionData.score.dimensions[0]?.score).toBe(7);
    expect(payload!.extensionData.score.subs[0]?.score).toBe(7);
    expect(original).not.toBe(7);
    expect(payload!.reportContent.viewModel.scores.dimensions[0]?.score).toBe(7);
    expect(payload!.reportContent.viewModel.summary).toBe(report.summary);
    expect(payload!.reportContent.viewModel.topic).toEqual(report.topic);
    expect(payload!.reportContent.viewModel.patterns).toEqual(report.patterns);
    expect(payload!.reportContent.viewModel.answers).toEqual(report.answers);
    expect(payload!.reportContent.viewModel.scenarioAnswers).toEqual(report.scenarioAnswers);
    expect(payload!.reportContent.viewModel.dimensions.map((item) => item.id)).toEqual(["F", "R", "E", "M"]);
    expect(payload!.dimensions.some((item) => item.id === "F1")).toBe(true);
    expect(payload!.source.resultKitId).toBe("sensmap");
    expect(Object.hasOwn(payload!.reportContent.viewModel, "narrative")).toBe(false);
    const packed = JSON.stringify(payload);
    expect(packed).not.toContain(NARRATIVE);
    expect(packed).not.toContain(CONSENT_VERSION);
    expect(packed).not.toContain("rk.v1.sensmap");
    report.summary = "改过的总结";
    expect(payload!.reportContent.viewModel.summary).not.toBe("改过的总结");
  });

  it("历史摘要和空昵称、手机号都不能上传", () => {
    const report = liveReport();
    const base = {
      nickname: "林深",
      reportId: "rpt_abcdefghijk",
      clientSubmissionId: "sub_abcdefghijklmnop",
      completedAt: "2026-10-24T09:02:03+08:00",
    };
    expect(buildSensmapResult({ ...base, report: historyShape(report) as Report })).toBeNull();
    expect(buildSensmapResult({ ...base, report, nickname: "  " })).toBeNull();
    expect(buildSensmapResult({ ...base, report, nickname: "13800000000" })).toBeNull();
    expect(buildSensmapResult({ ...base, report, nickname: "电话13800000000" })).toBeNull();
  });
});

describe("分享链接", () => {
  it("从当场的完整结果提交一次，分享只复制 github.io 短链", async () => {
    const report = liveReport();
    const calls: Array<{ url: string; body: { result: ReturnType<typeof buildSensmapResult> } }> = [];
    let finish: (response: Response) => void = () => {};
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    const mem = memoryStorage();
    mem.data.set("rk.v1.sensmap", JSON.stringify({ items: [{ d: { r: historyShape(report) } }] }));
    const copied: string[] = [];
    let view: ShareView = { saving: false, note: "", url: "", failed: false };
    const cloud = deps(mem.storage, fetchImpl, {
      writeClipboard: async (text) => {
        copied.push(text);
      },
    });
    const handle = watchSensmapShare({ nickname: "林深", getReport: () => report }, (next) => {
      view = next;
    }, cloud);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${ASSESSMENT_CLOUD_CONFIG.endpoint}/v1/results`);
    expect(calls[0]?.body.result?.assessmentId).toBe("sensmap");
    expect(calls[0]?.body.result?.assessmentVersion).toBe("sensmap-h5-v1");
    expect(calls[0]?.body.result?.reportContent.viewModel.answers.F01).toBe(4);
    expect(calls[0]?.body.result?.reportContent.viewModel.scenarioAnswers).toEqual(report.scenarioAnswers);
    expect(JSON.stringify(calls[0]?.body)).not.toContain(NARRATIVE);
    expect(mem.reads).not.toContain("rk.v1.sensmap");
    finish(new Response(JSON.stringify({ reportId: calls[0]?.body.result?.reportId }), { status: 200 }));
    await flush();
    expect(view.url.startsWith("https://xiangshu3721.github.io/mindtest-web/r/#")).toBe(true);
    expect(view.url).not.toContain("localhost");
    expect(parseShareLink(view.url)?.reportId).toBe(calls[0]?.body.result?.reportId);
    await activateSensmapShare(handle.key, cloud);
    expect(copied).toEqual([view.url]);
    watchSensmapShare({ nickname: "林深", getReport: () => report }, () => {}, cloud);
    expect(calls).toHaveLength(1);
  });

  it("队列里的旧包和历史摘要都不会被拿去提交", async () => {
    const report = liveReport();
    const key = sensmapShareKey("林深", report);
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response("{}", { status: 500 });
    };
    const mem = memoryStorage();
    mem.data.set("rk.v1.sensmap", JSON.stringify(historyShape(report)));
    mem.storage.setItem(PENDING_KEY, JSON.stringify({
      v: 1,
      items: [{
        reportId: `rpt_${"a".repeat(11)}`,
        clientSubmissionId: "sub_stale",
        linkSecret: "b".repeat(16),
        ownerToken: "c".repeat(18),
        orderKey: key,
        payload: { summary: "STALE_FROM_QUEUE", narrative: NARRATIVE },
        attempts: 0,
        nextAt: 0,
        lastError: "",
      }],
    }));
    let seen = "";
    const fetchLive: typeof fetch = async (input, init) => {
      seen = String(init?.body);
      calls.push(String(input));
      return new Response(JSON.stringify({ reportId: `rpt_${"a".repeat(11)}` }), { status: 200 });
    };
    const cloud = deps(mem.storage, fetchLive);
    watchSensmapShare({ nickname: "林深", getReport: () => report }, () => {}, cloud);
    await flush();
    expect(seen).toContain(report.summary);
    expect(seen).not.toContain("STALE_FROM_QUEUE");
    expect(seen).not.toContain(NARRATIVE);
    expect(mem.reads).not.toContain("rk.v1.sensmap");

    const blocked = memoryStorage();
    blocked.data.set(LINKS_KEY, "{}");
    let note = "";
    watchSensmapShare(
      { nickname: "林深", getReport: () => historyShape(report) as Report },
      (next) => {
        note = next.note;
      },
      deps(blocked.storage, fetchImpl),
    );
    await flush();
    expect(note).toBe("这一次结果不完整，没法分享");
    expect(calls).toHaveLength(1);
  });

  it("没有昵称或昵称是手机号时不提交", async () => {
    const report = liveReport();
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response("{}", { status: 200 });
    };
    let note = "";
    watchSensmapShare({ nickname: "   ", getReport: () => report }, (next) => {
      note = next.note;
    }, deps(memoryStorage().storage, fetchImpl));
    expect(note).toBe("先填一个昵称，才能分享");
    watchSensmapShare({ nickname: "13800000000", getReport: () => report }, (next) => {
      note = next.note;
    }, deps(memoryStorage().storage, fetchImpl));
    expect(note).toBe("昵称不能是手机号");
    expect(calls).toEqual([]);
  });
});
