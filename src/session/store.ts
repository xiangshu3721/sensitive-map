import {
  PRODUCT_NAME,
  QUESTION_BANK_VERSION,
  RULE_VERSION,
  SESSION_TTL_MS,
  STORAGE_KEY,
} from "../content/versions";
import type { Session } from "../model";

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `map-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createSession(): Session {
  const now = new Date().toISOString();
  return {
    id: uid(),
    productName: PRODUCT_NAME,
    questionBankVersion: QUESTION_BANK_VERSION,
    ruleVersion: RULE_VERSION,
    startedAt: now,
    updatedAt: now,
    step: "home",
    quizPage: 0,
    consent: { participate: null, saveResult: null, contact: null },
    answers: {},
    impact: {},
    scenarioAnswers: [],
    choice: null,
    narrative: "",
    report: null,
    reportError: null,
    returnStep: null,
  };
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session?.id || !session.updatedAt || !session.consent) return null;
    if (Date.now() - Date.parse(session.updatedAt) > SESSION_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 存储失败时仍保留内存中的答案，方便当场重试。
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasProgress(session: Session): boolean {
  return (
    session.step !== "home" ||
    Object.keys(session.answers).length > 0 ||
    session.report !== null
  );
}
