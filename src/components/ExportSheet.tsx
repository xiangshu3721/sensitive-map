import { RADAR_CAPTION } from "../content/versions";
import { QUESTIONS } from "../content/bank";
import type { BookingView, Report } from "../model";
import { DimensionBlock } from "./DimensionBlock";
import { RadarChart } from "./Radar";

export function ExportSheet({
  report,
  variant,
  part,
  booking,
  includeQr,
  nick = "",
}: {
  report: Report;
  variant: "private" | "share";
  part: "full" | "map" | "rest";
  booking: BookingView;
  includeQr: boolean;
  nick?: string;
}) {
  const showMap = part !== "rest";
  const showRest = part !== "map";
  const showQr = variant === "private" && includeQr && booking.available;

  return (
    <article className="sheet" data-export-variant={variant} data-export-part={part}>
      {showMap && (
        <>
          <p className="sheet-kicker">{report.productName}</p>
          <h1>我的心力地图</h1>
          <p className="sheet-nick" data-sheet-nick>
            {nick.trim() || "匿名"} 的测评结果 · {report.createdAt.slice(0, 10)}
          </p>
          <p className="sheet-summary">{report.summary}</p>
          {report.helpNotice && <p>{report.helpNotice}</p>}
          <div data-section="radar">
            <RadarChart dimensions={report.dimensions} large />
            <p className="sheet-caption">{RADAR_CAPTION}</p>
          </div>
          <section data-section="dimensions">
            <h2>逐项看懂我的心力地图</h2>
            {report.topic.closeNote && <p>{report.topic.closeNote}</p>}
            {report.dimensions.map((dimension) => (
              <DimensionBlock
                key={dimension.id}
                dimension={dimension}
                open
                printable
                share={variant === "share"}
              />
            ))}
          </section>
        </>
      )}
      {showRest && variant === "private" && (
        <>
          <section>
            <h2>个人模式画像</h2>
            <p>这里最多显示两条较明显的模式，再加一条需要你自己核对的线索。</p>
            {report.patterns.length === 0 && <p>目前没有足够集中的题目可以确认主要模式。</p>}
            {report.patterns.map((pattern) => (
              <div key={pattern.id} className="sheet-pattern">
                <h3>{pattern.name}</h3>
                <ol>
                  {pattern.nodes.map((node) => (
                    <li key={node.key}>
                      <b>{node.label}</b>
                      {node.text}
                      <small>{node.mode === "ask" ? "还需要你自己核对" : questionRefs(node.questionIds)}</small>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <p>
              {report.clue.title}：{report.clue.text}
            </p>
          </section>
          <section>
            <h2>首要课题与下一步</h2>
            {report.topic.showBoth && report.topic.companionText && <p>{report.topic.companionText}</p>}
            <p>
              首要课题：{report.topic.primaryName}
              {report.topic.primaryDimName ? `（${report.topic.primaryDimName}）` : ""}
            </p>
            {report.topic.secondaryName && (
              <p>
                次要关注：{report.topic.secondaryName}
                {report.topic.secondaryReason ? `。${report.topic.secondaryReason}` : ""}
              </p>
            )}
            <p>可以试的一步：{report.topic.action}</p>
            <h3>为什么先看这里</h3>
            <ul>
              {report.topic.basis.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </>
      )}
      {showRest && variant === "share" && (
        <section>
          <h2>概括</h2>
          <p>
            {report.patterns.length > 0
              ? `较集中的模式：${report.patterns.map((item) => item.name).join("、")}`
              : "没有集中到足以确认的主要模式。"}
          </p>
          <p>先看的位置：{report.topic.primaryName}</p>
          <p>分享版不含具体自述和题目细节。</p>
        </section>
      )}
      {showRest && variant === "private" && report.anomalies.length > 0 && (
        <p className="sheet-boundary">记录的异常：{report.anomalies.join("；")}</p>
      )}
      {showRest && <p className="sheet-boundary">{report.boundary}</p>}
      {showRest && showQr && (
        <section>
          <h2>预约如一老师</h2>
          <p>{booking.headline}</p>
          <p>{booking.body}</p>
          <div className="sheet-qr">
            <img src={booking.qrImageUrl} alt="预约二维码" />
            <p>{booking.receptionIdentity}</p>
            <p><strong>添加时请备注：心力地图</strong></p>
          </div>
          {booking.serviceLines.length > 0 && (
            <ul>
              {booking.serviceLines.map((item) => (
                <li key={item.label}>
                  {item.label}：{item.value}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {showRest && (
        <footer className="sheet-foot">
          <span>题库 {report.questionBankVersion}</span>
          <span>规则 {report.ruleVersion}</span>
          <span>{report.createdAt.slice(0, 10)}</span>
        </footer>
      )}
    </article>
  );
}

function questionRefs(ids: string[]): string {
  const numbers = ids.map((id) => {
    const index = QUESTIONS.findIndex((item) => item.id === id);
    return index >= 0 ? `第 ${index + 1} 题` : id;
  });
  return `参考 ${numbers.join("、")}`;
}
