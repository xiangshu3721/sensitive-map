// 历史记录：用 public/result-kit.js（共用小工具，纯前端，只存本机，最多 30 条）。
// 记录里只放分数和结论，不放你写的自述，也不放答题明细。
import { useEffect, useState } from "react";
import { PRODUCT_NAME } from "../content/versions";
import type { Report } from "../model";

type KitItem = { id: string; t: number; k?: string };
type Kit = {
  configure: (o: { id: string; title: string }) => void;
  save: (s: unknown, o?: { key?: string }) => { ok: boolean };
  list: () => KitItem[];
  showHistory: () => void;
  lastSave: () => { ok: boolean } | null;
};

export function kit(): Kit | undefined {
  return (window as unknown as { ResultKit?: Kit }).ResultKit;
}

export function setupKit() {
  kit()?.configure({ id: "sensmap", title: PRODUCT_NAME });
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
    return k.save(summaryOf(report), { key }).ok;
  } catch {
    return false;
  }
}

setupKit();
