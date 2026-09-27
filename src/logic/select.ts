import {
  DIM_NAME,
  GENERIC_SCENARIO,
  QUESTIONS,
  SCENARIO_BY_SUB,
  answerLabel,
  impactLabel,
} from "../content/bank";
import { SUB_MAP } from "../content/library";
import { highestSub, rankedSubs, scoresAreClose } from "./score";
import type {
  Answer,
  ChoiceId,
  ClueView,
  DimId,
  Likert,
  PatternView,
  QuestionId,
  Scenario,
  ScenarioPick,
  ScoreCard,
  SubId,
  SubScore,
  TopicView,
} from "../model";

const PATTERN_THRESHOLD = 50;
const CLUE_FLOOR = 25;

export function pickScenarios(
  subs: SubScore[],
  bank: Partial<Record<SubId, Scenario>> = SCENARIO_BY_SUB,
): { picks: ScenarioPick[]; anomalies: string[] } {
  const top = rankedSubs(subs).slice(0, 2);
  const anomalies: string[] = [];
  const picks = top.map((sub) => {
    const question = bank[sub.id];
    if (!question) {
      const anomaly = `子板块「${sub.name}」缺少情境题，已回退到通用题。`;
      anomalies.push(anomaly);
      return {
        question: { ...GENERIC_SCENARIO, sub: sub.id, id: `S-GENERIC-${sub.id}` },
        subId: sub.id,
        subName: sub.name,
        score: sub.score ?? 0,
        anomaly,
      };
    }
    return {
      question,
      subId: sub.id,
      subName: sub.name,
      score: sub.score ?? 0,
      anomaly: null,
    };
  });
  return { picks, anomalies };
}

function numericAnswer(answer: Answer | undefined): number | null {
  return typeof answer === "number" ? answer : null;
}

export function buildPatterns(
  card: ScoreCard,
  answers: Partial<Record<QuestionId, Answer>>,
): PatternView[] {
  return rankedSubs(card.subs)
    .filter((sub) => (sub.score ?? 0) >= PATTERN_THRESHOLD)
    .filter((sub) =>
      QUESTIONS.some(
        (item) => item.sub === sub.id && typeof answers[item.id] === "number" && (answers[item.id] as number) >= 3,
      ),
    )
    .slice(0, 2)
    .map((sub) => {
      const def = SUB_MAP[sub.id];
      return {
        id: `pat-${sub.id}`,
        subId: sub.id,
        name: def.patternName,
        score: sub.score ?? 0,
        nodes: def.nodes.map((item) => {
          const values = item.questionIds
            .map((id) => numericAnswer(answers[id]))
            .filter((value): value is number => value !== null);
          const supported = values.some((value) => value >= 2);
          return {
            key: item.key,
            label: item.label,
            text: supported ? item.statement : item.ask,
            mode: supported ? ("stated" as const) : ("ask" as const),
            questionIds: item.questionIds,
          };
        }),
      };
    });
}

export function buildClue(
  card: ScoreCard,
  answers: Partial<Record<QuestionId, Answer>>,
  impact: Record<DimId, Likert>,
  scenarioAnswers: { questionId: string; optionId: string }[],
  picks: ScenarioPick[],
  patterns: PatternView[],
): ClueView {
  const contradictions = contradictionClues(card, answers, impact, scenarioAnswers, picks, patterns);
  if (contradictions.length > 0) {
    return { title: "待核对", text: contradictions[0] };
  }

  const used = new Set(patterns.map((item) => item.subId));
  const mid = rankedSubs(card.subs).find((sub) => !used.has(sub.id) && (sub.score ?? 0) >= CLUE_FLOOR);
  if (mid) {
    if ((mid.score ?? 0) >= PATTERN_THRESHOLD) {
      return {
        title: "待核对",
        text: `「${mid.name}」的分数不低，但题目没有集中到「经常符合」。这里不把它写成确定模式，值得进一步核对。`,
      };
    }
    return {
      title: "待核对",
      text: `「${mid.name}」是${bandText(mid.score ?? 0)}，还不足以单独当成主要模式。值得进一步核对它是否只出现在特定的人或场景里。`,
    };
  }

  if (patterns.length === 0) {
    const max = rankedSubs(card.subs)[0]?.score ?? 0;
    if (max < 25) {
      return {
        title: "待核对",
        text: "四个领域都没有集中出现的高频困扰。这不表示另有隐藏的问题。如果某一次具体经历没有被题目问到，可以由你自己决定要不要另找时间核对。",
      };
    }
    return {
      title: "待核对",
      text: "目前没有足够集中的题目可以确认一种主要模式。值得进一步核对：这些感受是分散在很多场景里，还是只跟某一个具体的人有关。",
    };
  }

  return {
    title: "待核对",
    text: "如果某一题和你的日常感受不一样，可以只把它当作需要核对的线索，不必合成一个结论。",
  };
}

function bandText(score: number): string {
  if (score <= 24) return "近期较少报告的困扰";
  if (score <= 49) return "偶有的困扰";
  return "比较频繁的困扰";
}

function contradictionClues(
  card: ScoreCard,
  answers: Partial<Record<QuestionId, Answer>>,
  impact: Record<DimId, Likert>,
  scenarioAnswers: { questionId: string; optionId: string }[],
  picks: ScenarioPick[],
  patterns: PatternView[],
): string[] {
  const clues: { gap: number; order: number; text: string }[] = [];

  for (const sub of card.subs) {
    const items = QUESTIONS.filter((item) => item.sub === sub.id)
      .map((item) => ({ id: item.id, value: answers[item.id] }))
      .filter((item): item is { id: QuestionId; value: Likert } => typeof item.value === "number");
    if (items.length < 2) continue;
    const gap = Math.abs(items[0].value - items[1].value);
    if (gap >= 3) {
      clues.push({
        gap,
        order: sub.order,
        text: `「${sub.name}」里两道题差得比较多：一道是「${answerLabel(items[0].value)}」，另一道是「${answerLabel(items[1].value)}」。这里不把它们合成一个结论，值得进一步核对。`,
      });
    }
  }

  for (const pick of picks) {
    const selected = scenarioAnswers.find((item) => item.questionId === pick.question.id);
    const isPattern = patterns.some((item) => item.subId === pick.subId);
    if (selected?.optionId === "E" && isPattern) {
      clues.push({
        gap: 4,
        order: SUB_MAP[pick.subId].order,
        text: `你在「${pick.subName}」的情境题里选择了「以上都不像我」，但这一子板块的题目分数并不低。两处并不一致，这里不强行解释，值得进一步核对。`,
      });
    }
  }

  for (const dim of card.dimensions) {
    if (dim.score === null) continue;
    if (dim.score >= 75 && impact[dim.id] <= 1) {
      clues.push({
        gap: 3,
        order: dimOrder(dim.id),
        text: `「${dim.name}」的题目分数较高，但你说生活影响并不明显。两处并不一致，值得核对。`,
      });
    }
    if (dim.score <= 24 && impact[dim.id] >= 3) {
      clues.push({
        gap: 3,
        order: dimOrder(dim.id),
        text: `「${dim.name}」的题目分数不高，但你感到生活影响较大。问卷没有覆盖到的具体事件，值得单独核对。`,
      });
    }
  }

  return clues.sort((a, b) => b.gap - a.gap || a.order - b.order).map((item) => item.text);
}

function dimOrder(dim: DimId): number {
  return { F: 0, R: 1, E: 2, M: 3 }[dim];
}

export function pickTopic(input: {
  choice: ChoiceId;
  impact: Record<DimId, Likert>;
  card: ScoreCard;
  override?: SubId | null;
}): TopicView {
  const { choice, impact, card } = input;
  const basis: string[] = [];
  let showBoth = false;
  let companionText: string | null = null;
  let forcedSecondary: SubScore | null = null;
  let primaryDim: DimId;
  let primary: SubScore | null;

  if (input.override) {
    const sub = card.subs.find((item) => item.id === input.override) ?? null;
    primary = sub;
    primaryDim = sub?.dim ?? "F";
    basis.push("你已改选首要课题。原先的建议仍保留在依据里，没有被删掉。");
    basis.push(`你现在选择先看「${sub?.name ?? "未命名"}」。`);
  } else if (choice === "unclear") {
    primaryDim = highestImpactDim(impact);
    primary = highestSub(card.subs, primaryDim);
    const tied = (["F", "R", "E", "M"] as DimId[]).filter((dim) => impact[dim] === impact[primaryDim]);
    basis.push("你选择了「暂时说不清」，所以先看对生活影响最大的方向，再看这个方向里最突出的部分。");
    if (tied.length > 1) {
      basis.push(
        `有几个方向的影响程度相同，这里先从「${DIM_NAME[primaryDim]}」看起。`,
      );
    } else {
      basis.push(`「${DIM_NAME[primaryDim]}」对生活的影响最大，程度为「${impactLabel(impact[primaryDim])}」。`);
    }
  } else {
    primaryDim = choice;
    primary = highestSub(card.subs, choice);
    const selectedImpact = impact[choice];
    basis.push(`你希望先从「${DIM_NAME[choice]}」开始。`);
    basis.push(`这个方向对生活的影响是「${impactLabel(selectedImpact)}」。`);

    const companions = (["F", "R", "E", "M"] as DimId[])
      .filter((dim) => dim !== choice)
      .filter((dim) => impact[dim] >= 3)
      .filter((dim) => {
        const found = card.dimensions.find((item) => item.id === dim);
        return Boolean(found?.deterministic && found.score !== null && found.score >= 50);
      })
      .sort((a, b) => {
        const scoreA = card.dimensions.find((item) => item.id === a)?.score ?? 0;
        const scoreB = card.dimensions.find((item) => item.id === b)?.score ?? 0;
        return impact[b] - impact[a] || scoreB - scoreA || dimOrder(a) - dimOrder(b);
      });

    if (selectedImpact >= 2) {
      basis.push("生活影响达到「有一些」或以上，所以先看你选的方向里分数最高的部分。");
    } else if (selectedImpact <= 1 && companions.length > 0) {
      showBoth = true;
      const companion = companions[0];
      const companionSub = highestSub(card.subs, companion);
      companionText = `「${DIM_NAME[companion]}」的生活影响是「${impactLabel(impact[companion])}」，这个方向的分数也达到 ${card.dimensions.find((item) => item.id === companion)?.score}。这里一并展示，不覆盖你的选择。`;
      basis.push(companionText);
      basis.push("你的选择仍然保留，没有被另一领域替换。");
      if (companionSub) {
        basis.push(`同时看到的重点是「${companionSub.name}」。`);
        if ((companionSub.score ?? 0) >= 25) forcedSecondary = companionSub;
      }
    } else {
      basis.push("其他方向没有同时出现较大的生活影响和较高的分数，所以仍按你的选择来。");
    }
  }

  const secondary = forcedSecondary ?? chooseSecondary(card, primary);
  const closeNote = closeScoreNote(card);

  const primaryName = primary?.name ?? "还不能确定";
  const lowPrimary = !primary || (primary.score ?? 0) < 25;
  if (lowPrimary && primary) {
    basis.push(`「${primary.name}」的分数不高。这里只记录它的位置，不把它解释成要处理的问题。`);
  }
  const action = !primary
    ? "先不要给自己加任务。等你能指出一个具体场景，再决定从哪里开始。"
    : lowPrimary
      ? "先不安排改变任务。这里没有看到需要优先处理的高频困扰，不必为了有一个课题而硬找问题。"
      : SUB_MAP[primary.id].step;

  if (primary) {
    basis.push(`重点放在「${primary.name}」，得分 ${primary.score ?? "暂无分数"}。`);
  }

  return {
    primarySubId: primary?.id ?? null,
    primaryName,
    primaryDimId: primary?.dim ?? primaryDim,
    primaryDimName: DIM_NAME[primary?.dim ?? primaryDim],
    secondarySubId: secondary?.id ?? null,
    secondaryName: secondary?.name ?? null,
    secondaryReason: secondary
      ? showBoth
        ? `这是另一个方向里得分最高的部分，分数 ${secondary.score}。`
        : `这是其他部分里得分最高的一项，分数 ${secondary.score}。`
      : null,
    action,
    showBoth,
    companionText,
    basis,
    closeNote,
    overrode: Boolean(input.override),
  };
}

function chooseSecondary(card: ScoreCard, primary: SubScore | null): SubScore | null {
  return (
    rankedSubs(card.subs).find(
      (sub) => sub.id !== primary?.id && (sub.score ?? 0) >= CLUE_FLOOR,
    ) ?? null
  );
}

function highestImpactDim(impact: Record<DimId, Likert>): DimId {
  return (["F", "R", "E", "M"] as DimId[]).reduce((best, dim) =>
    impact[dim] > impact[best] ? dim : best,
  );
}

function closeScoreNote(card: ScoreCard): string | null {
  const ranked = [...card.dimensions]
    .filter((item) => item.score !== null && item.deterministic)
    .sort((a, b) => b.score! - a.score! || dimOrder(a.id) - dimOrder(b.id));
  if (ranked.length < 2 || ranked[0].score === null || ranked[1].score === null) return null;
  if (!scoresAreClose(ranked[0].score, ranked[1].score)) return null;
  return `「${ranked[0].name}」和「${ranked[1].name}」相差不超过5分，这里不把它们说成明显高低。`;
}

export function renderSummary(input: {
  choice: ChoiceId;
  card: ScoreCard;
  topic: TopicView;
}): string {
  const ranked = [...input.card.dimensions]
    .filter((item) => item.score !== null && item.deterministic)
    .sort((a, b) => b.score! - a.score! || dimOrder(a.id) - dimOrder(b.id));
  if (ranked.length > 0 && ranked.every((item) => (item.score ?? 0) <= 24)) {
    return "四个领域你报告的困扰都比较少。这不是遗漏了问题，只是这份测评涉及的内容较少出现在你的回答里。";
  }
  const top = ranked[0];
  const second = ranked[1];
  const close = top && second && top.score !== null && second.score !== null
    ? scoresAreClose(top.score, second.score)
    : false;
  const choiceName = input.choice === "unclear" ? "" : DIM_NAME[input.choice];

  if (!top || top.score === null) {
    return "有效作答还不足以形成四个领域的对照。下面只保留值得核对的部分。";
  }

  if (input.choice === "unclear") {
    if (close) {
      return `这几个领域你报告的困扰程度比较接近。可以先从生活影响更明显的「${input.topic.primaryDimName}」看起。`;
    }
    return `你在「${top.name}」报告的困扰更多。你还没有选定最先改变的领域，可以先看「${input.topic.primaryDimName}」。`;
  }

  if (close) {
    return `几个领域的困扰程度比较接近。你最想先改变的是「${choiceName}」。`;
  }
  if (input.choice === top.id) {
    return `你在「${top.name}」报告的困扰更多，而你也希望先从这里开始。`;
  }
  return `你在「${top.name}」报告的困扰更多；你最想先改变的是「${choiceName}」。`;
}
