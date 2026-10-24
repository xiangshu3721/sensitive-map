import { useEffect, useRef, useState } from "react";
import type { Report } from "../model";
import { activateSensmapShare, retrySensmapShare, sensmapShareKey, watchSensmapShare, type ShareView } from "../lib/cloud-share";
import { kit } from "../lib/records";
import { useSession } from "../session/context";

function readNickname(fallback?: string) {
  try {
    const fromKit = kit()?.nick.get();
    if (fromKit) return fromKit;
  } catch {
    /* 没有结果工具时仍用会话里的昵称。 */
  }
  return fallback || "";
}

export function ShareResult({ report }: { report: Report }) {
  const { session } = useSession();
  const nickname = readNickname(session.nick);
  const key = sensmapShareKey(nickname, report);
  const reportRef = useRef(report);
  reportRef.current = report;
  const [view, setView] = useState<ShareView>({ saving: false, note: "", url: "", failed: false });

  useEffect(() => watchSensmapShare({ nickname, getReport: () => reportRef.current }, setView).stop, [key, nickname]);

  const busy = view.saving && !view.url;
  const warn = Boolean(view.note && view.note !== "链接已复制" && view.note !== "链接生成中");
  return (
    <>
      <button type="button" className="btn" disabled={busy} aria-busy={busy || undefined} onClick={() => void activateSensmapShare(key)}>
        分享结果
      </button>
      {view.failed && !busy && (
        <button type="button" className="btn ghost" onClick={() => retrySensmapShare(key)}>
          重试
        </button>
      )}
      {view.note && (
        <p className={warn ? "meta share-note warn" : "meta share-note"} role="status">
          {view.note}
        </p>
      )}
    </>
  );
}
