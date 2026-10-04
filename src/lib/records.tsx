// 历史记录：用 public/result-kit.js（共用小工具，纯前端，只存本机，最多 30 条）。
// 记录里只放分数和结论，不放你写的自述，也不放答题明细。
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ExportSheet } from "../components/ExportSheet";
import { PRODUCT_NAME } from "../content/versions";
import type { BookingView, Report } from "../model";
import { sheetToPng } from "./sheetImage";

type KitItem = { id: string; t: number; k?: string; nick?: string; d?: unknown };
type Kit = {
  configure: (o: { id: string; title: string; exporter?: (rec: KitItem) => unknown }) => void;
  save: (s: unknown, o?: { key?: string; data?: unknown }) => { ok: boolean };
  list: () => KitItem[];
  showHistory: () => void;
  lastSave: () => { ok: boolean } | null;
  ensureNick: (cb?: (() => void) | null, o?: { onCancel?: () => void }) => void;
  nickReset: () => void;
  nick: { get: () => string };
  toast: (m: string) => void;
  showImages: (urls: string[], name?: string) => void;
};

export function kit(): Kit | undefined {
  return (window as unknown as { ResultKit?: Kit }).ResultKit;
}

export function setupKit() {
  kit()?.configure({ id: "sensmap", title: PRODUCT_NAME, exporter: exportFromRecord });
}

const CLOSED_BOOKING = { available: false } as unknown as BookingView;

/** 历史记录里存的是「去掉自述和答题明细」的精简结果，足够重画一张完整的长图。 */
function trimReport(report: Report) {
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

/** 历史详情里导出：用记录里存的结果重画完整长图，带昵称；旧记录（没有存结果）返回 false，走通用的摘要图。 */
function exportFromRecord(rec: KitItem): unknown {
  const k = kit();
  const r = (rec.d as { r?: Partial<Report> } | undefined)?.r;
  if (!k || !r || !Array.isArray(r.dimensions) || !r.topic || !r.createdAt) return false;
  return (async () => {
    k.toast("正在生成图片…");
    const host = document.createElement("div");
    host.className = "export-stage";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      const report = {
        patterns: [],
        anomalies: [],
        helpNotice: null,
        ...r,
      } as Report;
      root.render(<ExportSheet report={report} variant="private" part="full" booking={CLOSED_BOOKING} includeQr={false} nick={rec.nick ?? ""} />);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const node = host.querySelector<HTMLElement>('[data-export-part="full"]');
      if (!node) throw new Error("not ready");
      const url = await sheetToPng(node);
      k.showImages([url], `${rec.nick ? `${rec.nick}-` : ""}${PRODUCT_NAME}-${report.createdAt.slice(0, 10)}.png`);
    } catch {
      k.toast("这台设备没能生成图片，可以直接截屏保存。");
    } finally {
      root.unmount();
      host.remove();
    }
  })();
}

export function historyCount(): number {
  try {
    return kit()?.list().length ?? 0;
  } catch {
    return 0;
  }
}

/** 页面上显示「历史记录（n）」用；在历史弹层里删了记录后，数字会很快跟着变。 */
export function useHistoryCount(): number {
  const [n, setN] = useState(historyCount);
  useEffect(() => {
    const timer = window.setInterval(() => setN(historyCount()), 700);
    return () => window.clearInterval(timer);
  }, []);
  return n;
}

export function summaryOf(report: Report) {
  const tone = (score: number | null) => (score === null ? "mid" : score >= 60 ? "high" : score >= 35 ? "mid" : "ok");
  const notes: string[] = [];
  if (report.topic.primaryName) notes.push(`首要课题：${report.topic.primaryName}（${report.topic.primaryDimName}）`);
  if (report.topic.action) notes.push(`可以试的一步：${report.topic.action}`);
  notes.push("分数越高，代表你在这个领域报告的困扰越多。这是自我探索，不是临床诊断。");
  return {
    headline: "我的心力地图",
    sub: report.summary,
    metrics: report.dimensions.map((item) => ({
      label: item.name,
      value: item.score === null ? "题目不足" : `${item.score} 分`,
      frac: item.score === null ? 0 : item.score / 100,
      tone: tone(item.score),
    })),
    notes,
  };
}

/** 生成结果后保存一条；同一份结果（同编号同时间）只存一次。失败时返回 false，结果页照常能看。 */
export function saveReport(report: Report): boolean | null {
  const k = kit();
  if (!k) return null;
  const key = `${report.id}@${report.createdAt}`;
  try {
    if (k.list().some((item) => item.k === key)) return true;
    return k.save(summaryOf(report), { key, data: { r: trimReport(report) } }).ok;
  } catch {
    return false;
  }
}

setupKit();
