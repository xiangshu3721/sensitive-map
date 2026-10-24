/** 公开地址。密钥不写在这里。与霍兰德、巨婴同一条 assessmentReportDev。
 * 用户打开的分享地址：https://xiangshu3721.github.io/mindtest-web/r/#{id}.{secret}
 */
export const ASSESSMENT_CLOUD_CONFIG = {
  endpoint: "https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev",
  reportPageBase: "https://xiangshu3721.github.io/mindtest-web/r/",
};

export const PENDING_KEY = "rk.cloud.pending.v1";
export const OWNER_KEY = "rk.cloud.owner.v1";
export const LINKS_KEY = "rk.cloud.links.v1";

const REPORT_RE = /^rpt_[A-Za-z0-9_-]{11,64}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{16,128}$/;

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type StoredLink = {
  reportId?: string;
  reportUrl?: string;
  status?: string;
  byteSize?: number;
};

export function randomToken(bytes = 32, cryptoObj: Crypto = globalThis.crypto) {
  const list = new Uint8Array(bytes);
  cryptoObj.getRandomValues(list);
  let chars = "";
  for (const value of list) chars += String.fromCharCode(value);
  return btoa(chars).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function createSubmissionIds(cryptoObj?: Crypto) {
  return {
    reportId: `rpt_${randomToken(8, cryptoObj)}`,
    clientSubmissionId: `sub_${randomToken(18, cryptoObj)}`,
    linkSecret: randomToken(12, cryptoObj),
    ownerToken: randomToken(18, cryptoObj),
  };
}

/** 同一次生成的结果只提交一次。键里不放答案，也不读本地历史。 */
export function sensmapOrderKey(nickname: string, reportId: string, createdAt: string) {
  return `sensmap:${nickname}:${reportId}@${createdAt}`;
}

export function parseShareHash(hash: string) {
  const text = String(hash || "").replace(/^#/, "").trim();
  const dot = text.indexOf(".");
  if (dot < 0) return null;
  let reportId = text.slice(0, dot);
  const linkSecret = text.slice(dot + 1);
  if (!reportId.startsWith("rpt_")) reportId = `rpt_${reportId}`;
  if (!REPORT_RE.test(reportId) || !SECRET_RE.test(linkSecret)) return null;
  return { reportId, linkSecret };
}

export function parseShareLink(input: string) {
  const text = String(input || "").trim();
  const hashIndex = text.indexOf("#");
  if (hashIndex >= 0) return parseShareHash(text.slice(hashIndex));
  return parseShareHash(text);
}

export function buildShareUrl(base: string, reportId: string, linkSecret: string) {
  const root = String(base || "").replace(/\/?$/, "/");
  const id = String(reportId || "").replace(/^rpt_/, "");
  return `${root}#${id}.${linkSecret}`;
}

export function backoffMs(attempt: number) {
  if (attempt <= 1) return 5000;
  if (attempt === 2) return 30000;
  return 120000;
}

export function resolveEndpoint(locationLike?: { hostname?: string; origin?: string }, config: { endpoint?: string } = {}) {
  const configured = typeof config.endpoint === "string" ? config.endpoint.trim() : "";
  if (configured) return configured.replace(/\/$/, "");
  const host = locationLike && locationLike.hostname;
  if (host === "localhost" || host === "127.0.0.1") return String(locationLike?.origin || "").replace(/\/$/, "");
  return "";
}

export function resolveReportBase(locationLike?: { hostname?: string; origin?: string }, config: { reportPageBase?: string } = {}) {
  if (config.reportPageBase) return String(config.reportPageBase).replace(/\/?$/, "/");
  const host = (locationLike && locationLike.hostname) || "";
  if (host.endsWith("github.io")) return `${locationLike?.origin}/mindtest-web/r/`;
  if (locationLike && locationLike.origin) return `${locationLike.origin}/r/`;
  return "https://xiangshu3721.github.io/mindtest-web/r/";
}

export function gateSubmit({ agreed, endpoint, nickname }: { agreed: boolean; endpoint: string; nickname: string }) {
  if (!agreed) return { ok: false as const, reason: "consent" };
  if (!nickname) return { ok: false as const, reason: "nickname" };
  if (!endpoint) return { ok: false as const, reason: "endpoint" };
  return { ok: true as const, reason: "" };
}

function readJson(storage: KeyValueStorage, key: string, fallback: { v: number; items: unknown }) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { v?: number; items?: unknown };
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function createCloudStore(storage: KeyValueStorage) {
  return {
    pending() {
      const data = readJson(storage, PENDING_KEY, { v: 1, items: [] });
      return Array.isArray(data.items) ? data.items : [];
    },
    savePending(items: unknown[]) {
      storage.setItem(PENDING_KEY, JSON.stringify({ v: 1, items }));
    },
    upsertPending(item: { reportId: string }) {
      const items = this.pending().filter((entry) => !entry || typeof entry !== "object" || (entry as { reportId?: string }).reportId !== item.reportId);
      items.push(item);
      this.savePending(items);
    },
    removePending(reportId: string) {
      this.savePending(this.pending().filter((entry) => !entry || typeof entry !== "object" || (entry as { reportId?: string }).reportId !== reportId));
    },
    owners() {
      const data = readJson(storage, OWNER_KEY, { v: 1, items: {} });
      return data.items && typeof data.items === "object" ? data.items as Record<string, string> : {};
    },
    saveOwner(reportId: string, ownerToken: string) {
      const items = this.owners();
      items[reportId] = ownerToken;
      storage.setItem(OWNER_KEY, JSON.stringify({ v: 1, items: items }));
    },
    links() {
      const data = readJson(storage, LINKS_KEY, { v: 1, items: {} });
      return data.items && typeof data.items === "object" ? data.items as Record<string, StoredLink> : {};
    },
    saveLink(key: string, link: StoredLink) {
      const items = this.links();
      items[key] = link;
      storage.setItem(LINKS_KEY, JSON.stringify({ v: 1, items }));
    },
  };
}

export function isoShanghai(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}+08:00`;
}

export function submitBody(item: { payload: unknown; linkSecret: string; ownerToken: string }) {
  return { result: item.payload, linkSecret: item.linkSecret, ownerToken: item.ownerToken };
}
