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
}: {
  report: Report;
  variant: "private" | "share";
  part: "full" | "map" | "rest";
  booking: BookingView;
  includeQr: boolean;
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
          <p className="sheet-summary">{report.summary}</p>
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
            {report.patterns.length === 0 && <p>目前没有足够集中的题目可以确认主要模式。</p>}
            {report.patterns.map((pattern) => (
              <div key={pattern.id} className="sheet-pattern">
                <h3>{pattern.name}</h3>
                <ol>
                  {pattern.nodes.map((node) => (
                    <li key={node.key}>
                      <b>{node.label}</b>
                      {node.text}
                      <small>{questionRefs(node.questionIds)}</small>
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
            <p>
              首要课题：{report.topic.primaryName}
              {report.topic.primaryDimName ? `（${report.topic.primaryDimName}）` : ""}
            </p>
            {report.topic.secondaryName && <p>次要关注：{report.topic.secondaryName}</p>}
            <p>可以试的一步：{report.topic.action}</p>
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
      {showRest && <p className="sheet-boundary">{report.boundary}</p>}
      {showRest && showQr && (
        <div className="sheet-qr">
          <img src={booking.qrImageUrl} alt="预约二维码" />
          <p>{booking.receptionIdentity}</p>
        </div>
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
