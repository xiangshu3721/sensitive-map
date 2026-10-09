import { useEffect, useState, type ReactNode } from "react";
import { QUESTIONS } from "../content/bank";
import { SUBS } from "../content/library";
import { PRODUCT_NAME, RADAR_CAPTION } from "../content/versions";
import { DimensionBlock } from "../components/DimensionBlock";
import { RadarChart } from "../components/Radar";
import { applyTopicOverride, buildReport, defaultExpandedDim, RESULT_SECTION_ORDER } from "../logic/report";
import type { DimId, SubId } from "../model";
import { kit, saveReport, useHistoryCount } from "../lib/records";
import { useSession } from "../session/context";

export function ResultPage() {
  const { session, patch, retest } = useSession();
  const report = session.report;
  const [open, setOpen] = useState<DimId[]>(report ? [defaultExpandedDim(report)] : []);
  const [switching, setSwitching] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const count = useHistoryCount();

  useEffect(() => {
    if (!report) return;
    setSaved(saveReport(report));
  }, [report?.id, report?.createdAt]);

  useEffect(() => {
    if (report) setOpen([defaultExpandedDim(report)]);
  }, [report?.createdAt]);

  if (!report) {
    return (
      <section className="screen">
        <p className="kicker">{PRODUCT_NAME}</p>
        <h1>结果还没有生成</h1>
        <p>{session.reportError ?? "答案都还在。可以再试一次。"}</p>
        <button type="button" className="btn" onClick={() => retry(session, patch)}>
          重新生成
        </button>
      </section>
    );
  }

  const sections: Record<(typeof RESULT_SECTION_ORDER)[number], ReactNode> = {
    title: (
      <header data-section="title" key="title">
        <p className="kicker">{PRODUCT_NAME}</p>
        <h1>我的心力地图</h1>
        <p className="lead">{report.summary}</p>
        {report.helpNotice && <p className="help-note">{report.helpNotice}</p>}
      </header>
    ),
    radar: (
      <section data-section="radar" key="radar">
        <RadarChart dimensions={report.dimensions} />
        <p className="caption">{RADAR_CAPTION}</p>
      </section>
    ),
    dimensions: (
      <section data-section="dimensions" key="dimensions">
        <h2>逐项看懂我的心力地图</h2>
        {report.topic.closeNote && <p>{report.topic.closeNote}</p>}
        {report.dimensions.map((dimension) => (
          <DimensionBlock
            key={dimension.id}
            dimension={dimension}
            open={open.includes(dimension.id)}
            onToggle={() =>
              setOpen((current) =>
                current.includes(dimension.id)
                  ? current.filter((id) => id !== dimension.id)
                  : [...current, dimension.id],
              )
            }
          />
        ))}
      </section>
    ),
    patterns: (
      <section data-section="patterns" key="patterns">
        <h2>个人模式画像</h2>
        <p className="meta">这里最多显示两条较明显的模式，再加一条需要你自己核对的线索。</p>
        {report.patterns.length === 0 && <p>目前没有足够集中的题目可以确认主要模式。</p>}
        {report.patterns.map((pattern) => (
          <article key={pattern.id} className="pattern">
            <h3>{pattern.name}</h3>
            <ol className="chain">
              {pattern.nodes.map((node) => (
                <li key={node.key} className={node.mode}>
                  <b>{node.label}</b>
                  <span>{node.text}</span>
                  <small>{node.mode === "ask" ? "还需要你自己核对" : questionRefs(node.questionIds)}</small>
                </li>
              ))}
            </ol>
          </article>
        ))}
        <aside className="clue">
          <b>{report.clue.title}</b>
          <p>{report.clue.text}</p>
        </aside>
      </section>
    ),
    topic: (
      <section data-section="topic" key="topic">
        <h2>首要课题与下一步</h2>
        {report.topic.showBoth && report.topic.companionText && <p>{report.topic.companionText}</p>}
        <div className="topic-card">
          <p className="meta">首要课题</p>
          <h3>
            {report.topic.primaryName}
            <small>{report.topic.primaryDimName}</small>
          </h3>
          {report.topic.secondaryName && (
            <p>
              次要关注：{report.topic.secondaryName}
              {report.topic.secondaryReason ? `。${report.topic.secondaryReason}` : ""}
            </p>
          )}
          <p>可以试的一步：{report.topic.action}</p>
        </div>
        <h3>为什么先看这里</h3>
        <ul className="basis">
          {report.topic.basis.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button type="button" className="btn ghost" onClick={() => setSwitching((value) => !value)}>
          我想先看别的方向
        </button>
        {switching && (
          <div className="switcher">
            {SUBS.map((sub) => {
              const score = report.scores.subs.find((item) => item.id === sub.id)?.score;
              return (
                <button
                  key={sub.id}
                  type="button"
                  className={report.topic.primarySubId === sub.id ? "choice on" : "choice"}
                  onClick={() => {
                    patch((item) =>
                      item.report
                        ? { ...item, report: applyTopicOverride(item.report, sub.id as SubId) }
                        : item,
                    );
                    setSwitching(false);
                  }}
                >
                  {sub.name}
                  <small>{score ?? "暂无分数"}</small>
                </button>
              );
            })}
          </div>
        )}
        {report.narrative && (
          <div className="narrative-view">
            <h3>你写下的情境</h3>
            <p>{report.narrative}</p>
            <small>这段话只显示在本机结果页，不会写进图片，也不会自动发送。</small>
          </div>
        )}
      </section>
    ),
    export: (
      <section data-section="export" key="export">
        <div className="stack">
          <button
            type="button"
            className="btn"
            onClick={() => patch((item) => ({ ...item, step: "preview" }))}
          >
            导出图片
          </button>
          <button type="button" className="btn ghost" onClick={() => kit()?.showHistory()}>
            历史记录{count ? `（${count}）` : ""}
          </button>
          <button type="button" className="btn ghost" onClick={retest}>
            重新测试
          </button>
          {saved === true && <p className="meta" role="status">这次结果已保存在这台设备（不上传），可在「历史记录」里再看。</p>}
          {saved === false && (
            <p className="meta" role="status">这次结果没能存进浏览器（可能是无痕模式或空间已满），仍可导出图片保存。</p>
          )}
        </div>
      </section>
    ),
    privacy: (
      <section data-section="privacy" key="privacy">
        <button
          type="button"
          className="text-btn"
          onClick={() => patch((item) => ({ ...item, returnStep: "result", step: "privacy" }))}
        >
          查看说明与隐私
        </button>
        <p className="meta">
          题库 {report.questionBankVersion} · 规则 {report.ruleVersion} · {report.createdAt.slice(0, 10)}
        </p>
        {report.anomalies.length > 0 && <p className="meta">记录的异常：{report.anomalies.join("；")}</p>}
      </section>
    ),
  };

  return (
    <section className="screen result">
      <header className="topbar">
        <p>{PRODUCT_NAME}</p>
        <button type="button" className="text-btn" onClick={retest}>
          重新测试
        </button>
      </header>
      {RESULT_SECTION_ORDER.map((id) => sections[id])}
    </section>
  );
}

function retry(
  session: ReturnType<typeof useSession>["session"],
  patch: ReturnType<typeof useSession>["patch"],
) {
  try {
    const report = buildReport({
      id: session.id,
      answers: session.answers,
      impact: session.impact,
      scenarioAnswers: session.scenarioAnswers,
      choice: session.choice,
      narrative: session.narrative,
    });
    patch((item) => ({ ...item, report, reportError: null }));
  } catch (error) {
    patch((item) => ({
      ...item,
      reportError: error instanceof Error ? error.message : "结果没有生成成功。",
    }));
  }
}

function questionRefs(ids: string[]): string {
  const numbers = ids.map((id) => {
    const index = QUESTIONS.findIndex((item) => item.id === id);
    return index >= 0 ? `第 ${index + 1} 题` : id;
  });
  return `参考 ${numbers.join("、")}`;
}
