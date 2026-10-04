import type { ReactNode } from "react";
import { DIMS, IMPACT_OPTIONS, IMPACT_PROMPTS, LIKERT_OPTIONS, QUESTION_MAP, QUESTIONS, QUIZ_PAGES } from "../content/bank";
import { PRODUCT_NAME, QUESTION_BANK_VERSION, RULE_VERSION } from "../content/versions";
import { buildReport } from "../logic/report";
import { scoreAnswers } from "../logic/score";
import { pickScenarios } from "../logic/select";
import type { Answer, ChoiceId, QuestionId, Session, Step } from "../model";
import { useSession } from "../session/context";
import { hasProgress } from "../session/store";
import { kit, useHistoryCount } from "../lib/records";

function Shell({
  kicker,
  title,
  children,
  dock,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
  dock?: ReactNode;
}) {
  const { restart } = useSession();
  return (
    <section className="screen">
      <header className="topbar">
        <p>{PRODUCT_NAME}</p>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            if (window.confirm("清除这台设备上的作答进度？")) restart();
          }}
        >
          从头开始
        </button>
      </header>
      {kicker && <p className="kicker">{kicker}</p>}
      <h1>{title}</h1>
      {children}
      {dock && <div className="dock">{dock}</div>}
    </section>
  );
}

function resumeTarget(session: Session): Step {
  if (session.returnStep && session.returnStep !== "home" && session.returnStep !== "privacy") {
    return session.returnStep;
  }
  if (session.report) return "result";
  if (!session.consent.participate) return "quiz";
  const answered = QUESTIONS.every((item) => {
    const value = session.answers[item.id];
    return value === "na" || typeof value === "number";
  });
  if (!answered) return "quiz";
  if (DIMS.some((item) => typeof session.impact[item.id] !== "number")) return "impact";
  const picks = pickScenarios(scoreAnswers(session.answers).subs).picks;
  if (picks.some((pick) => !session.scenarioAnswers.some((item) => item.questionId === pick.question.id))) {
    return "scenario";
  }
  if (!session.choice) return "needs";
  return "result";
}

export function HomePage() {
  const { session, patch, retest } = useSession();
  const count = useHistoryCount();
  const resume = hasProgress(session);
  const finished = Boolean(session.report);
  const saved = new Date(session.updatedAt);
  const savedLabel = Number.isNaN(saved.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(saved);

  return (
    <section className="screen home">
      <div className="home-hero">
        <div className="home-map" aria-hidden="true">
          <span className="map-ring map-ring-one" />
          <span className="map-ring map-ring-two" />
          <span className="map-ring map-ring-three" />
          <span className="map-halo" />
          <span className="map-center">此刻的你</span>
          <span className="map-node map-node-family">关系</span>
          <span className="map-node map-node-emotion">情绪</span>
          <span className="map-node map-node-money">选择</span>
          <span className="map-node map-node-origin">成长</span>
        </div>
        <div className="home-copy">
          <p className="home-kicker">高敏感心力地图</p>
          <h1>你对世界的感受，值得被看见</h1>
          <p className="lead">有些疲惫，只有你自己最清楚。花 8 到 10 分钟，开始一次诚实的自我观察。</p>
          <p className="home-note">不是给你贴标签，而是一起看见：什么在消耗你，什么能支持你。</p>
        </div>
      </div>

      <div className="home-action">
        {finished ? (
          <div className="home-status">
            <p>你已经完成过一份自我观察{savedLabel ? `，保存于 ${savedLabel}` : ""}。</p>
            <button type="button" className="btn" onClick={retest}>
              重新测试
            </button>
            <button type="button" className="btn ghost" onClick={() => patch((item) => ({ ...item, step: "result" }))}>
              查看上次结果
            </button>
          </div>
        ) : resume ? (
          <div className="home-status">
            <p>你有一份还没完成的自我观察{savedLabel ? `，保存于 ${savedLabel}` : ""}。</p>
            <button type="button" className="btn" onClick={() => patch((item) => ({ ...item, step: resumeTarget(item) }))}>
              继续测评
            </button>
            <button type="button" className="btn ghost" onClick={retest}>
              重新开始
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="btn home-primary" onClick={() => patch((item) => ({ ...item, step: "quiz" }))}>
              开始测评
            </button>
            <p className="home-action-note">约 8 到 10 分钟完成<br />答案只保存在这台设备上</p>
          </>
        )}
        {count > 0 && (
          <button type="button" className="btn ghost" onClick={() => kit()?.showHistory()}>
            历史记录（{count}）
          </button>
        )}
      </div>
    </section>
  );
}

export function QuizPage() {
  const { session, patch } = useSession();
  const page = session.quizPage;
  const ids = QUIZ_PAGES[page] ?? QUIZ_PAGES[0];
  const ready = ids.every((id) => {
    const value = session.answers[id];
    return value === "na" || typeof value === "number";
  });
  const dim = QUESTION_MAP[ids[0]].dim;
  const dimName = DIMS.find((item) => item.id === dim)?.name ?? "";
  const answered = QUESTIONS.filter((item) => {
    const value = session.answers[item.id];
    return value === "na" || typeof value === "number";
  }).length;

  function setAnswer(id: QuestionId, value: Answer) {
    patch((item) => ({
      ...item,
      report: null,
      answers: { ...item.answers, [id]: value },
    }));
  }

  return (
    <Shell
      kicker={`${dimName} · 第 ${page + 1} 组，共 8 组`}
      title="这些描述有多像你？"
      dock={
        <div className="dock-row">
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              patch((item) => (page === 0 ? { ...item, step: "home" } : { ...item, quizPage: page - 1 }))
            }
          >
            {page === 0 ? "返回首页" : "上一组"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!ready}
            onClick={() =>
              patch((item) => (page >= 7 ? { ...item, step: "impact" } : { ...item, quizPage: page + 1 }))
            }
          >
            {page >= 7 ? "继续看生活影响" : "下一组"}
          </button>
        </div>
      }
    >
      <div className="progress" aria-hidden="true">
        <i style={{ width: `${(answered / 32) * 100}%` }} />
      </div>
      <p className="meta">已完成 {answered} / 32 题。每题都要选择，才可以继续。</p>
      <p className="legend">请按第一感觉选择，不用反复琢磨。</p>
      {ids.map((id, index) => {
        const question = QUESTION_MAP[id];
        const value = session.answers[id];
        return (
          <fieldset key={id} className="question">
            <legend>
              <span>{page * 4 + index + 1}</span>
              {question.text}
            </legend>
            <div className="scale">
              {LIKERT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={value === option.value}
                  className={value === option.value ? "scale-btn on" : "scale-btn"}
                  onClick={() => setAnswer(id, option.value)}
                >
                  <b>{option.value}</b>
                  {option.short}
                </button>
              ))}
            </div>
            {question.allowNa && (
              <button
                type="button"
                className={value === "na" ? "na on" : "na"}
                onClick={() => setAnswer(id, "na")}
              >
                这题暂时不适合我。我没有报价、加薪或谈报酬的经历。
              </button>
            )}
          </fieldset>
        );
      })}
    </Shell>
  );
}

export function ImpactPage() {
  const { session, patch } = useSession();
  const ready = DIMS.every((item) => typeof session.impact[item.id] === "number");

  return (
    <Shell
      kicker="生活影响"
      title="这些事情影响生活有多大？"
      dock={
        <div className="dock-row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => patch((item) => ({ ...item, step: "quiz", quizPage: 7 }))}
          >
            回到上一组
          </button>
          <button
            type="button"
            className="btn"
            disabled={!ready}
            onClick={() => patch((item) => ({ ...item, step: "scenario" }))}
          >
            继续看具体情境
          </button>
        </div>
      }
    >
      <p>这 4 题单独计分，不放进雷达图。请按你的真实感受选择。</p>
      <p className="meta">每个方向都选一项，才能继续。</p>
      {DIMS.map((dim) => (
        <fieldset key={dim.id} className="question">
          <legend>{IMPACT_PROMPTS[dim.id]}</legend>
          <div className="choices">
            {IMPACT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={session.impact[dim.id] === option.value ? "choice on" : "choice"}
                onClick={() =>
                  patch((item) => ({
                    ...item,
                    report: null,
                    impact: { ...item.impact, [dim.id]: option.value },
                  }))
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </Shell>
  );
}

export function ScenarioPage() {
  const { session, patch } = useSession();
  const picks = pickScenarios(scoreAnswers(session.answers).subs);

  const ready = picks.picks.every((item) =>
    session.scenarioAnswers.some((answer) => answer.questionId === item.question.id),
  );

  function choose(questionId: string, optionId: string) {
    patch((item) => ({
      ...item,
      report: null,
      scenarioAnswers: [
        ...item.scenarioAnswers.filter(
          (answer) =>
            answer.questionId !== questionId &&
            picks.picks.some((pick) => pick.question.id === answer.questionId),
        ),
        { questionId, optionId },
      ],
    }));
  }

  return (
    <Shell
      kicker="动态情境"
      title="看看你会怎么反应"
      dock={
        <div className="dock-row">
          <button type="button" className="btn ghost" onClick={() => patch((item) => ({ ...item, step: "impact" }))}>
            回到生活影响
          </button>
          <button
            type="button"
            className="btn"
            disabled={!ready}
            onClick={() => patch((item) => ({ ...item, step: "needs" }))}
          >
            继续选择重点
          </button>
        </div>
      }
    >
      <p>我们选了两道和前面回答最相关的情境题。没有标准答案，选最像你的一项。</p>
      <p className="meta">两题都选完后，就可以继续。</p>
      {picks.anomalies.length > 0 && (
        <p className="quiet-box">有一道题暂时没有匹配上，先换成通用题，不影响继续。</p>
      )}
      {picks.picks.map((pick, index) => {
        const selected = session.scenarioAnswers.find((item) => item.questionId === pick.question.id)?.optionId;
        return (
          <fieldset key={pick.question.id} className="question">
            <legend>
              <span>{index + 1}</span>
              {pick.question.prompt}
              <small>这题主要和「{pick.subName}」有关</small>
            </legend>
            <div className="choices">
              {pick.question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={selected === option.id ? "choice on" : "choice"}
                  onClick={() => choose(pick.question.id, option.id)}
                >
                  <b>{option.id}</b>
                  {option.text}
                </button>
              ))}
            </div>
          </fieldset>
        );
      })}
    </Shell>
  );
}

export function NeedsPage() {
  const { session, patch } = useSession();
  const count = Array.from(session.narrative).length;

  return (
    <Shell
      kicker="你自己的选择"
      title="你最想先从哪里开始？"
      dock={
        <div className="dock-row">
          <button type="button" className="btn ghost" onClick={() => patch((item) => ({ ...item, step: "scenario" }))}>
            回到情境题
          </button>
          <button type="button" className="btn" disabled={!session.choice} onClick={() => submitNeeds(session, patch)}>
            生成我的地图
          </button>
        </div>
      }
    >
      <p>选一个你现在最想弄明白或改变的方向，没有对错。</p>
      <div className="choices">
        {[
          ...DIMS.map((item) => ({ id: item.id as ChoiceId, label: item.name })),
          { id: "unclear" as const, label: "暂时说不清" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            className={session.choice === option.id ? "choice on" : "choice"}
            onClick={() => patch((item) => ({ ...item, choice: option.id, report: null }))}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!session.choice && <p className="meta selection-hint">先选一个方向，下面的按钮就会亮起来。</p>}
      <label className="narrative">
        <span>如果愿意，写下最近哪件事最让你觉得累。</span>
        <textarea
          value={session.narrative}
          maxLength={300}
          placeholder="可以写事情本身，不要写别人的姓名、联系方式或隐私信息。"
          onChange={(event) =>
            patch((item) => ({
              ...item,
              narrative: Array.from(event.target.value).slice(0, 300).join(""),
            }))
          }
        />
        <small>已输入 {count} / 300。只保存在这台设备上，不会放进结果图片，也不会自动发送。</small>
      </label>
    </Shell>
  );
}

function submitNeeds(session: Session, patch: ReturnType<typeof useSession>["patch"]) {
  const picks = pickScenarios(scoreAnswers(session.answers).subs).picks;
  const missing = picks.some(
    (pick) => !session.scenarioAnswers.some((item) => item.questionId === pick.question.id),
  );
  if (missing) {
    patch((item) => ({ ...item, step: "scenario" }));
    return;
  }
  try {
    const report = buildReport({
      id: session.id,
      answers: session.answers,
      impact: session.impact,
      scenarioAnswers: session.scenarioAnswers,
      choice: session.choice,
      narrative: session.narrative,
    });
    patch((item) => ({ ...item, report, reportError: null, step: "result" }));
  } catch (error) {
    patch((item) => ({
      ...item,
      reportError: error instanceof Error ? error.message : "结果没有生成成功。",
      step: "result",
    }));
  }
}

export function PrivacyPage() {
  const { session, patch, restart } = useSession();
  const back = session.returnStep && session.returnStep !== "privacy" ? session.returnStep : "result";

  return (
    <Shell kicker="说明与隐私" title="结果是怎么来的">
      <p>
        这是一个帮助你自我了解的工具，不是临床诊断。分数只反映你在题目中报告的困扰，不用来判断疾病，也不能替你解释原因。
      </p>
      <p>「原生家庭」这一项只看你在题目中描述的感受和相处方式，不用来推断你的家庭经历。</p>
      <p>
        你的答案、影响评分、情境选择和自述，都保存在这台设备上。查看结果和保存图片都不需要加微信，原始答案也不会自动发送。
      </p>
      <p>是否保存图片、是否添加如一老师微信，由你自己决定。添加微信时不会自动附上答题内容。</p>
      <ul className="meta-list">
        <li>题库版本 {session.report?.questionBankVersion ?? QUESTION_BANK_VERSION}</li>
        <li>规则版本 {session.report?.ruleVersion ?? RULE_VERSION}</li>
        <li>测评编号 {session.id}</li>
      </ul>
      {session.report && (
        <p className="quiet-box">
          这份结果生成时使用题库 {session.report.questionBankVersion}、规则 {session.report.ruleVersion}
          。之后如果文案更新，已生成的结果不会被静默改写。
        </p>
      )}
      <div className="stack">
        <button type="button" className="btn" onClick={() => patch((item) => ({ ...item, step: back }))}>
          返回上一个页面
        </button>
        {session.report && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              try {
                const report = buildReport({
                  id: session.id,
                  answers: session.answers,
                  impact: session.impact,
                  scenarioAnswers: session.scenarioAnswers,
                  choice: session.choice,
                  narrative: session.narrative,
                });
                patch((item) => ({ ...item, report, reportError: null, step: "result" }));
              } catch (error) {
                patch((item) => ({
                  ...item,
                  reportError: error instanceof Error ? error.message : "重新生成没有成功。",
                  step: "result",
                }));
              }
            }}
          >
            用当前规则重新生成
          </button>
        )}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (window.confirm("清除这台设备上的作答进度？")) restart();
          }}
        >
          清除这台设备上的内容
        </button>
      </div>
    </Shell>
  );
}
