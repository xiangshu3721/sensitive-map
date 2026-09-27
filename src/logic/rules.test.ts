import { describe, expect, it } from "vitest";
import { QUESTIONS, QUIZ_PAGES, SCENARIOS } from "../content/bank";
import { DIM_COPY, SUBS, bandOf } from "../content/library";
import { BOUNDARY_TEXT, QUESTION_BANK_VERSION, RULE_VERSION } from "../content/versions";
import { resolveBooking } from "./booking";
import { applyTopicOverride, buildReport, exportPlainText, RESULT_SECTION_ORDER, type ReportInput } from "./report";
import { pickScenarios } from "./select";
import { scoreAnswers, toPercent } from "./score";
import type { Answer, ChoiceId, DimId, Likert, QuestionId } from "../model";

const banned =
  /抑郁症|缺失率|创伤率|修复率|疗效|治愈|轻度|中度|重度|财富匮乏|人格缺陷|创伤/;

function answersOf(
  base: Likert,
  overrides: Partial<Record<QuestionId, Answer>> = {},
): Record<QuestionId, Answer> {
  const answers = Object.fromEntries(QUESTIONS.map((item) => [item.id, base])) as Record<
    QuestionId,
    Answer
  >;
  return { ...answers, ...overrides };
}

function impactOf(base: Likert, overrides: Partial<Record<DimId, Likert>> = {}) {
  return { F: base, R: base, E: base, M: base, ...overrides };
}

function reportFrom(partial: {
  answers: Record<QuestionId, Answer>;
  impact?: ReturnType<typeof impactOf>;
  choice?: ChoiceId;
  narrative?: string;
  scenarioOption?: "A" | "B" | "C" | "D" | "E";
}): ReturnType<typeof buildReport> {
  const impact = partial.impact ?? impactOf(1);
  const choice = partial.choice ?? "unclear";
  const scored = scoreAnswers(partial.answers);
  const picks = pickScenarios(scored.subs).picks;
  const input: ReportInput = {
    id: "test",
    answers: partial.answers,
    impact,
    scenarioAnswers: picks.map((item) => ({
      questionId: item.question.id,
      optionId: partial.scenarioOption ?? "A",
    })),
    choice,
    narrative: partial.narrative ?? "",
  };
  return buildReport(input);
}

describe("题库", () => {
  it("有32道核心题、16道情境题，每页4题", () => {
    expect(QUESTIONS).toHaveLength(32);
    expect(SUBS).toHaveLength(16);
    expect(SCENARIOS).toHaveLength(16);
    expect(QUIZ_PAGES).toHaveLength(8);
    expect(QUIZ_PAGES.every((page) => page.length === 4)).toBe(true);
    for (const scenario of SCENARIOS) {
      expect(scenario.options.at(-1)?.text).toBe("以上都不像我");
    }
    expect(QUESTIONS.filter((item) => item.allowNa).map((item) => item.id)).toEqual(["M03"]);
  });
});

describe("计分", () => {
  it("与手算一致，并显示整数区间", () => {
    expect(toPercent(20, 8)).toBe(63);
    expect(toPercent(8, 2)).toBe(100);
    expect(toPercent(5, 2)).toBe(63);
    expect(bandOf(24)).toBe("近期较少报告困扰");
    expect(bandOf(25)).toBe("偶有困扰");
    expect(bandOf(49)).toBe("偶有困扰");
    expect(bandOf(50)).toBe("困扰较频繁");
    expect(bandOf(74)).toBe("困扰较频繁");
    expect(bandOf(75)).toBe("持续受到困扰");

    const card = scoreAnswers(answersOf(2, { F01: 4, F02: 4, F03: 3, F04: 3, F05: 2, F06: 2, F07: 1, F08: 1 }));
    const family = card.dimensions.find((item) => item.id === "F")!;
    expect(family.score).toBe(63);
    expect(family.subs.map((item) => item.score)).toEqual([100, 75, 50, 25]);
  });

  it("不适用题按有效题数归一化，不足6题不解释", () => {
    const card = scoreAnswers(
      answersOf(2, {
        M03: "na",
      }),
    );
    const money = card.dimensions.find((item) => item.id === "M")!;
    const pricing = money.subs.find((item) => item.id === "M2")!;
    expect(money.validCount).toBe(7);
    expect(money.score).toBe(50);
    expect(pricing.validCount).toBe(1);
    expect(pricing.score).toBe(50);

    const thin = scoreAnswers({ F01: 4, F02: 4, F03: 4, F04: 4, F05: 4 });
    const family = thin.dimensions.find((item) => item.id === "F")!;
    expect(family.deterministic).toBe(false);
    expect(family.band).toBeNull();
  });
});

describe("动态题与同分", () => {
  it("取得分最高的两个子板块，同分按固定顺序", () => {
    const flat = scoreAnswers(answersOf(2));
    const picks = pickScenarios(flat.subs).picks;
    expect(picks.map((item) => item.subId)).toEqual(["F1", "F2"]);

    const tied = pickScenarios(flat.subs, {});
    expect(tied.anomalies).toHaveLength(2);
    expect(tied.picks.every((item) => item.question.generic)).toBe(true);
  });

  it("情感关系同分时，报告重点跟着高分题走", () => {
    const base = { F: 1 as Likert, E: 1 as Likert, M: 1 as Likert };
    const jia = reportFrom({
      answers: answersOf(1, { R01: 4, R02: 4, R03: 2, R04: 2, R05: 2, R06: 2, R07: 2, R08: 2 }),
      impact: impactOf(1, { ...base, R: 3 }),
      choice: "R",
    });
    const yi = reportFrom({
      answers: answersOf(1, { R01: 1, R02: 1, R03: 4, R04: 4, R05: 3, R06: 3, R07: 2, R08: 2 }),
      impact: impactOf(1, { ...base, R: 3 }),
      choice: "R",
    });
    const bing = reportFrom({
      answers: answersOf(1, { R01: 2, R02: 2, R03: 2, R04: 2, R05: 2, R06: 2, R07: 4, R08: 4 }),
      impact: impactOf(1, { ...base, R: 3 }),
      choice: "R",
    });

    expect(jia.scores.dimensions.find((item) => item.id === "R")?.score).toBe(63);
    expect(yi.scores.dimensions.find((item) => item.id === "R")?.score).toBe(63);
    expect(bing.scores.dimensions.find((item) => item.id === "R")?.score).toBe(63);
    expect(jia.patterns[0]?.name).toBe("等待与确认循环");
    expect(yi.patterns[0]?.name).toBe("边界与表达");
    expect(bing.patterns[0]?.name).toBe("亲密选择");
    expect(new Set([jia.patterns[0]?.name, yi.patterns[0]?.name, bing.patterns[0]?.name]).size).toBe(3);
    expect(jia.scenarioPicks.map((item) => item.subId)).toEqual(["R1", "R2"]);
    expect(yi.scenarioPicks.map((item) => item.subId)).toEqual(["R2", "R3"]);
    expect(bing.scenarioPicks.map((item) => item.subId)).toEqual(["R4", "R1"]);
  });
});

describe("首要课题", () => {
  it("尊重本人选择，影响低且另一领域又高时同时展示", () => {
    const kept = reportFrom({
      answers: answersOf(1, { R03: 4, R04: 4 }),
      impact: impactOf(0, { R: 2 }),
      choice: "R",
    });
    expect(kept.topic.primarySubId).toBe("R2");
    expect(kept.topic.showBoth).toBe(false);
    expect(kept.topic.basis.join("")).toContain("情感关系");

    const both = reportFrom({
      answers: answersOf(0, { F01: 1, F02: 1, F03: 1, F04: 1, F05: 1, F06: 1, F07: 1, F08: 1, E01: 3, E02: 3, E03: 3, E04: 3, E05: 3, E06: 3, E07: 3, E08: 3 }),
      impact: impactOf(0, { F: 1, E: 3 }),
      choice: "F",
    });
    expect(both.topic.showBoth).toBe(true);
    expect(both.topic.primaryDimId).toBe("F");
    expect(both.topic.secondarySubId).toBe("E1");
    expect(both.topic.companionText).toContain("情绪困扰");
    expect(both.topic.companionText).toContain("不覆盖你的选择");

    const unclear = reportFrom({
      answers: answersOf(1),
      impact: impactOf(0, { R: 4, E: 4 }),
      choice: "unclear",
    });
    expect(unclear.topic.primaryDimId).toBe("R");
  });

  it("分差不超过5分时不说明显更高", () => {
    const close = reportFrom({
      answers: answersOf(0, {
        F01: 2, F02: 2, F03: 2, F04: 2, F05: 2, F06: 2, F07: 2, F08: 2,
        R01: 2, R02: 2, R03: 2, R04: 2, R05: 2, R06: 2, R07: 2, R08: 3,
      }),
      choice: "F",
    });
    expect(close.topic.closeNote).toContain("不超过5分");
    expect(close.summary).not.toContain("更多");
    expect(close.summary).not.toContain("明显");
  });

  it("低分不编造课题", () => {
    const low = reportFrom({ answers: answersOf(0), impact: impactOf(0), choice: "unclear" });
    expect(low.summary).toContain("比较少");
    expect(low.dimensions.every((item) => item.band === "近期较少报告困扰")).toBe(true);
    expect(low.patterns).toHaveLength(0);
    expect(low.topic.action).toContain("不必为了有一个课题而硬找问题");
    expect(low.clue.text).toContain("不表示另有隐藏的问题");
  });
});

describe("结果边界", () => {
  it("保存版本，不把自述写进导出，分享版不含题目原文", () => {
    const narrative = "独有自述标记不要出现在图片里";
    const report = reportFrom({
      answers: answersOf(3),
      narrative,
      choice: "E",
      impact: impactOf(3),
    });
    expect(report.questionBankVersion).toBe(QUESTION_BANK_VERSION);
    expect(report.ruleVersion).toBe(RULE_VERSION);
    expect(report.narrative).toBe(narrative);
    expect(RESULT_SECTION_ORDER.slice(0, 3)).toEqual(["title", "radar", "dimensions"]);

    const full = exportPlainText(report, "private");
    const share = exportPlainText(report, "share");
    expect(full).not.toContain(narrative);
    expect(share).not.toContain(narrative);
    expect(full).toContain(QUESTIONS[0].text === "" ? "x" : report.dimensions.find((item) => item.highlights.length)?.highlights[0]?.text ?? "");
    expect(share).not.toContain(QUESTIONS.find((item) => item.id === "E01")!.text);
    expect(report.helpNotice).toContain("不能判断原因");

    const changed = applyTopicOverride(report, "M1");
    expect(changed.primaryTopicId).toBe("M1");
    expect(changed.dimensions[0].daily).toBe(report.dimensions[0].daily);
    expect(changed.topic.overrode).toBe(true);
  });

  it("文案不输出诊断、创伤原因和疗效", () => {
    const reports = [
      reportFrom({ answers: answersOf(0) }),
      reportFrom({ answers: answersOf(4), impact: impactOf(4), choice: "F" }),
      reportFrom({ answers: answersOf(2), choice: "M" }),
    ];
    const staticCopy = JSON.stringify({ DIM_COPY, SUBS, SCENARIOS, BOUNDARY_TEXT });
    const rendered = reports.map((item) => exportPlainText(item, "private") + item.summary + item.clue.text).join("\n");
    expect(staticCopy).not.toMatch(banned);
    expect(rendered).not.toMatch(banned);
  });
});

describe("预约配置", () => {
  it("没有真实二维码和接待身份时不开放", () => {
    expect(resolveBooking(null).available).toBe(false);
    expect(resolveBooking({ bookingOpen: true, qrImageUrl: "https://example.com/a.png", receptionIdentity: "客服微信" }).available).toBe(false);
    expect(resolveBooking({ bookingOpen: true, qrImageUrl: "", receptionIdentity: "如一老师本人微信" }).available).toBe(false);
    const open = resolveBooking({
      bookingOpen: true,
      qrImageUrl: "/qr.png",
      receptionIdentity: "如一老师预约助理微信",
      service: { form: "语音", duration: "50分钟", price: "", hours: "", capacity: "" },
    });
    expect(open.available).toBe(true);
    expect(open.receptionIdentity).toBe("如一老师预约助理微信");
    expect(open.serviceLines.map((item) => item.label)).toEqual(["形式", "时长"]);
    expect(open.bookingMessage).not.toContain("F01");
  });
});
