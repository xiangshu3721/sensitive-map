import type { DimensionView } from "../model";
import { QUESTIONS } from "../content/bank";

function questionRefs(ids: string[]): string {
  const numbers = ids.map((id) => {
    const index = QUESTIONS.findIndex((item) => item.id === id);
    return index >= 0 ? `第 ${index + 1} 题` : id;
  });
  return `参考 ${numbers.join("、")}`;
}

export function DimensionBlock({
  dimension,
  open,
  onToggle,
  share = false,
  printable = false,
}: {
  dimension: DimensionView;
  open: boolean;
  onToggle?: () => void;
  share?: boolean;
  printable?: boolean;
}) {
  if (share) {
    return (
      <article className="dim share">
        <header>
          <h3>{dimension.name}</h3>
          <p>
            {dimension.score ?? "暂无分数"}
            {dimension.band ? ` · ${dimension.band}` : ""}
          </p>
        </header>
        <ul className="sub-list">
          {dimension.subs.map((sub) => (
            <li key={sub.id}>
              <span>{sub.name}</span>
              <b>{sub.score ?? "暂无"}</b>
            </li>
          ))}
        </ul>
      </article>
    );
  }

  return (
    <article className={open ? "dim open" : "dim"}>
      {printable ? (
        <header className="dim-static">
          <strong>{dimension.name}</strong>
          <span>
            {dimension.score ?? "暂无分数"} {dimension.band ?? ""}
          </span>
          <small className="dim-sum">{dimension.summaryLine}</small>
        </header>
      ) : (
        <button type="button" className="dim-toggle" onClick={onToggle} aria-expanded={open}>
          <span>
            <strong>{dimension.name}</strong>
            <small>{dimension.summaryLine}</small>
          </span>
          <em>{open ? "收起" : "展开"}</em>
        </button>
      )}
      {open && (
        <div className="dim-body">
          <p className="score-line">
            {dimension.deterministic ? (
              <>
                <b>{dimension.score}</b>
                <span>{dimension.band}</span>
              </>
            ) : (
              <span>有效作答不足，不输出确定性解释</span>
            )}
          </p>
          <ul className="sub-bars">
            {dimension.subs.map((sub) => (
              <li key={sub.id}>
                <div>
                  <span>{sub.name}</span>
                  <b>{sub.score ?? "暂无"}</b>
                </div>
                <i>
                  <s style={{ width: `${sub.score ?? 0}%` }} />
                </i>
              </li>
            ))}
          </ul>
          <h4>哪些回答支持这个结果</h4>
          {dimension.highlights.length > 0 ? (
            <ul className="evidence">
              {dimension.score !== null && dimension.score <= 24 && (
                <li className="quiet">只有个别题目较高，不把整维说成持续困扰。</li>
              )}
              {dimension.highlights.map((item) => (
                <li key={item.questionId}>
                  「{item.text}」你的回答是「{item.answerLabel}」。
                  <small>{questionRefs([item.questionId])}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>这部分没有出现特别集中的信号。</p>
          )}
          <h4>日常表现</h4>
          <p>{dimension.daily}</p>
          <h4>另一种可能</h4>
          <p>{dimension.alternative}</p>
          <h4>可以试的一步</h4>
          <p>{dimension.step}</p>
          <h4>什么时候适合找人聊聊</h4>
          <p>{dimension.human}</p>
          {dimension.helpNote && <p className="help-note">{dimension.helpNote}</p>}
        </div>
      )}
    </article>
  );
}
