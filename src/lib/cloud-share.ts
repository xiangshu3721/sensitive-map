import type { Report } from "../model";
import {
  ASSESSMENT_CLOUD_CONFIG,
  backoffMs,
  buildShareUrl,
  createCloudStore,
  createSubmissionIds,
  gateSubmit,
  isoShanghai,
  resolveEndpoint,
  resolveReportBase,
  sensmapOrderKey,
  submitBody,
  type KeyValueStorage,
} from "./cloud-client";
import { buildSensmapResult, phoneNickname, sensmapNickname } from "./cloud-payload";

export type ShareView = { saving: boolean; note: string; url: string; failed: boolean };

type PendingItem = {
  reportId: string;
  clientSubmissionId: string;
  linkSecret: string;
  ownerToken: string;
  orderKey: string;
  payload: NonNullable<ReturnType<typeof buildSensmapResult>>;
  attempts: number;
  nextAt: number;
  lastError: string;
};

export type CloudDeps = {
  storage: KeyValueStorage;
  fetch: typeof fetch;
  location: { hostname?: string; origin?: string };
  schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear: (id: ReturnType<typeof setTimeout>) => void;
  writeClipboard?: (text: string) => Promise<void>;
};

type Room = {
  key: string;
  nickname: string;
  getReport: () => Report | null | undefined;
  deps: CloudDeps;
  listeners: Set<(view: ShareView) => void>;
  view: ShareView;
  generation: object | null;
  timer: ReturnType<typeof setTimeout> | 0;
  copyTimer: ReturnType<typeof setTimeout> | 0;
  running: boolean;
};

const rooms = new Map<string, Room>();
const storageIds = new WeakMap<object, number>();
let storageSeq = 0;

function storageId(storage: object) {
  let id = storageIds.get(storage);
  if (!id) {
    storageSeq += 1;
    id = storageSeq;
    storageIds.set(storage, id);
  }
  return id;
}

function defaultDeps(): CloudDeps {
  return {
    storage: globalThis.localStorage,
    fetch: globalThis.fetch.bind(globalThis),
    location: globalThis.location,
    schedule(fn, ms) {
      const id = setTimeout(fn, ms);
      (id as unknown as { unref?: () => void }).unref?.();
      return id;
    },
    clear(id) {
      clearTimeout(id);
    },
  };
}

function resolveDeps(extra?: Partial<CloudDeps>): CloudDeps {
  const base = defaultDeps();
  return { ...base, ...extra };
}

export function sensmapShareKey(nickname: string, report: Pick<Report, "id" | "createdAt">) {
  return sensmapOrderKey(sensmapNickname(nickname), report.id, report.createdAt);
}

function emit(room: Room, view: ShareView) {
  room.view = view;
  room.listeners.forEach((listener) => listener(view));
}

function asPending(entry: unknown): PendingItem | null {
  if (!entry || typeof entry !== "object") return null;
  const item = entry as PendingItem;
  if (typeof item.reportId !== "string" || typeof item.linkSecret !== "string" || typeof item.ownerToken !== "string") return null;
  if (typeof item.clientSubmissionId !== "string" || item.orderKey == null) return null;
  return item;
}

function pendingItem(storage: KeyValueStorage, key: string) {
  return createCloudStore(storage).pending().map(asPending).find((entry) => entry && entry.orderKey === key) ?? null;
}

function activeUrl(storage: KeyValueStorage, key: string) {
  const saved = createCloudStore(storage).links()[key];
  if (!saved || saved.status !== "active" || !saved.reportUrl) return "";
  return saved.reportUrl;
}

function initialView(storage: KeyValueStorage, key: string): ShareView {
  const url = activeUrl(storage, key);
  if (url) return { saving: false, note: "", url, failed: false };
  const pending = pendingItem(storage, key);
  const failed = Boolean(pending && pending.attempts > 0 && pending.lastError);
  return { saving: false, note: failed ? pending?.lastError || "这次没生成链接" : "", url: "", failed };
}

function completedAtOf(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return isoShanghai(new Date());
  return isoShanghai(date);
}

/** 每次提交都从调用方此刻交来的 Report 重新组包。队列里的旧包不能代替它。 */
function ensurePending(room: Room) {
  const cloud = createCloudStore(room.deps.storage);
  const found = pendingItem(room.deps.storage, room.key);
  let ids = found;
  if (!found) {
    const created = createSubmissionIds();
    if (created.linkSecret === created.ownerToken) created.ownerToken = createSubmissionIds().ownerToken;
    ids = { ...created, orderKey: room.key, payload: undefined as unknown as PendingItem["payload"], attempts: 0, nextAt: 0, lastError: "" };
  }
  const report = room.getReport();
  const payload = buildSensmapResult({
    nickname: room.nickname,
    report,
    reportId: ids?.reportId,
    clientSubmissionId: ids?.clientSubmissionId,
    completedAt: completedAtOf(report?.createdAt),
  });
  if (!payload || !ids) return null;
  if (found) {
    found.payload = payload;
    cloud.upsertPending(found);
    return found;
  }
  const item: PendingItem = {
    reportId: ids.reportId,
    clientSubmissionId: ids.clientSubmissionId,
    linkSecret: ids.linkSecret,
    ownerToken: ids.ownerToken,
    orderKey: room.key,
    payload,
    attempts: 0,
    nextAt: 0,
    lastError: "",
  };
  cloud.upsertPending(item);
  cloud.saveOwner(ids.reportId, ids.ownerToken);
  return item;
}

function rememberLink(room: Room, item: PendingItem) {
  const reportUrl = buildShareUrl(resolveReportBase(room.deps.location, ASSESSMENT_CLOUD_CONFIG), item.reportId, item.linkSecret);
  const cloud = createCloudStore(room.deps.storage);
  cloud.removePending(item.reportId);
  cloud.saveLink(room.key, { reportId: item.reportId, reportUrl, status: "active", byteSize: 0 });
  emit(room, { saving: false, note: "", url: reportUrl, failed: false });
}

function failPending(room: Room, item: PendingItem, message: string, generation: object) {
  const cloud = createCloudStore(room.deps.storage);
  item.attempts += 1;
  item.lastError = message;
  item.nextAt = Date.now() + backoffMs(item.attempts);
  cloud.upsertPending(item);
  if (room.generation !== generation) return;
  emit(room, { saving: false, note: message, url: "", failed: true });
  if (item.attempts < 8) {
    room.deps.clear(room.timer as ReturnType<typeof setTimeout>);
    room.timer = room.deps.schedule(() => {
      if (room.generation === generation) void run(room);
    }, backoffMs(item.attempts));
  }
}

function stopRetry(room: Room, item: PendingItem, generation: object) {
  item.lastError = "这次没生成链接";
  item.attempts = 8;
  createCloudStore(room.deps.storage).upsertPending(item);
  if (room.generation !== generation) return;
  emit(room, { saving: false, note: item.lastError, url: "", failed: true });
}

async function run(room: Room) {
  if (room.running) return;
  room.running = true;
  const generation = {};
  room.generation = generation;
  room.deps.clear(room.timer as ReturnType<typeof setTimeout>);
  room.timer = 0;
  let item: PendingItem | null = null;
  try {
    const saved = activeUrl(room.deps.storage, room.key);
    if (saved) {
      emit(room, { saving: false, note: room.view.note === "链接已复制" ? room.view.note : "", url: saved, failed: false });
      return;
    }
    const nickname = sensmapNickname(room.nickname);
    const endpoint = resolveEndpoint(room.deps.location, ASSESSMENT_CLOUD_CONFIG);
    if (!nickname) {
      emit(room, { saving: false, note: "先填一个昵称，才能分享", url: "", failed: true });
      return;
    }
    if (phoneNickname(room.nickname) || phoneNickname(nickname)) {
      emit(room, { saving: false, note: "昵称不能是手机号", url: "", failed: true });
      return;
    }
    const gate = gateSubmit({ agreed: true, endpoint, nickname });
    if (!gate.ok) {
      emit(room, { saving: false, note: "现在没法生成链接", url: "", failed: true });
      return;
    }
    emit(room, { saving: true, note: "链接生成中", url: "", failed: false });
    item = ensurePending(room);
    if (room.generation !== generation) return;
    if (!item) {
      emit(room, { saving: false, note: "这一次结果不完整，没法分享", url: "", failed: true });
      return;
    }
    const response = await room.deps.fetch(`${endpoint}/v1/results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submitBody(item)),
    });
    if (room.generation !== generation) return;
    const body = await response.json().catch(() => ({})) as { reportId?: string };
    if (room.generation !== generation) return;
    if (response.status === 200 && body.reportId) {
      rememberLink(room, item);
      return;
    }
    if (response.status === 409) {
      const savedResponse = await room.deps.fetch(`${endpoint}/v1/results/read`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId: item.reportId, linkSecret: item.linkSecret }),
      });
      if (room.generation !== generation) return;
      if (savedResponse.status === 200) {
        rememberLink(room, item);
        return;
      }
      stopRetry(room, item, generation);
      return;
    }
    if (response.status === 422) {
      stopRetry(room, item, generation);
      return;
    }
    failPending(room, item, response.status === 429 ? "刚才点得太快了，稍后再试" : "这次没生成链接", generation);
  } catch {
    if (room.generation !== generation) return;
    if (item) failPending(room, item, "这次没生成链接", generation);
    else emit(room, { saving: false, note: "这次没生成链接", url: "", failed: true });
  } finally {
    if (room.generation === generation) room.running = false;
  }
}

function roomMapKey(storage: object, key: string) {
  return `${storageId(storage)}:${key}`;
}

export function watchSensmapShare(
  input: { nickname: string; getReport: () => Report | null | undefined },
  onView: (view: ShareView) => void,
  extra?: Partial<CloudDeps>,
) {
  const deps = resolveDeps(extra);
  const nickname = sensmapNickname(input.nickname) || String(input.nickname || "");
  let report: Report | null | undefined;
  try {
    report = input.getReport();
  } catch {
    report = null;
  }
  const key = report ? sensmapShareKey(nickname, report) : sensmapOrderKey(sensmapNickname(nickname), "", "");
  const mapKey = roomMapKey(deps.storage, key);
  let room = rooms.get(mapKey);
  if (!room) {
    room = {
      key,
      nickname,
      getReport: input.getReport,
      deps,
      listeners: new Set(),
      view: initialView(deps.storage, key),
      generation: null,
      timer: 0,
      copyTimer: 0,
      running: false,
    };
    rooms.set(mapKey, room);
  } else {
    room.nickname = nickname;
    room.getReport = input.getReport;
    room.deps = deps;
  }
  room.listeners.add(onView);
  onView(room.view);
  if (!room.view.url && !room.running && !room.timer) {
    const pending = pendingItem(deps.storage, key);
    if (pending && pending.attempts > 0 && pending.attempts < 8) {
      const wait = Math.max(0, (pending.nextAt || 0) - Date.now());
      room.timer = deps.schedule(() => { void run(room); }, wait);
    } else if (!room.view.failed) {
      void run(room);
    }
  }
  return {
    key,
    stop() {
      room.listeners.delete(onView);
    },
  };
}

export function retrySensmapShare(key: string, extra?: Partial<CloudDeps>) {
  const deps = resolveDeps(extra);
  const room = rooms.get(roomMapKey(deps.storage, key));
  if (!room || room.running) return;
  deps.clear(room.timer as ReturnType<typeof setTimeout>);
  room.timer = 0;
  const pending = pendingItem(deps.storage, key);
  if (pending) {
    pending.attempts = 0;
    pending.lastError = "";
    pending.nextAt = 0;
    createCloudStore(deps.storage).upsertPending(pending);
  }
  void run(room);
}

async function writeClipboard(text: string) {
  const nav = globalThis.navigator;
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return;
    } catch {
      /* 下面再试一次系统复制。 */
    }
  }
  const doc = globalThis.document;
  if (!doc?.body) throw new Error("copy");
  const area = doc.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  doc.body.appendChild(area);
  area.select();
  const ok = doc.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy");
}

export async function activateSensmapShare(key: string, extra?: Partial<CloudDeps>) {
  const deps = resolveDeps(extra);
  const room = rooms.get(roomMapKey(deps.storage, key));
  if (!room) return;
  if (room.view.url) {
    try {
      await (room.deps.writeClipboard ?? writeClipboard)(room.view.url);
      emit(room, { ...room.view, note: "链接已复制", failed: false });
      deps.clear(room.copyTimer as ReturnType<typeof setTimeout>);
      room.copyTimer = deps.schedule(() => {
        if (room.view.note === "链接已复制") emit(room, { ...room.view, note: "" });
      }, 2500);
    } catch {
      emit(room, { ...room.view, note: "没复制上，再点一次" });
    }
    return;
  }
  if (room.running || room.view.saving) {
    emit(room, { ...room.view, note: "链接生成中，稍后再试" });
    return;
  }
  retrySensmapShare(key, extra);
}
