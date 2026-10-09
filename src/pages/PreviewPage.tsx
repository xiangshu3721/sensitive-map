import { useState } from "react";
import { createPortal } from "react-dom";
import { ExportSheet } from "../components/ExportSheet";
import { resolveBooking } from "../logic/booking";
import { useSession } from "../session/context";
import { sheetToPng } from "../lib/sheetImage";

const CLOSED_BOOKING = resolveBooking(null);

type Shot = { title: string; url: string };

export function PreviewPage() {
  const { session, patch, retest } = useSession();
  const report = session.report;
  const [variant, setVariant] = useState<"private" | "share">("private");
  const [agreed, setAgreed] = useState(Boolean(session.consent.saveResult?.agreed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [armed, setArmed] = useState(false);

  if (!report) {
    return (
      <section className="screen">
        <h1>还没有可保存的结果</h1>
        <button type="button" className="btn" onClick={() => patch((item) => ({ ...item, step: "result" }))}>
          返回结果
        </button>
      </section>
    );
  }

  async function generate() {
    if (!agreed) return;
    patch((item) => ({
      ...item,
      consent: {
        ...item.consent,
        saveResult: { agreed: true, at: new Date().toISOString() },
      },
    }));
    setError("");
    setShot(null);
    setBusy(true);
    setArmed(true);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const full = document.querySelector<HTMLElement>('[data-export-part="full"]');
      if (!full) throw new Error("图片还没有准备好。");
      setShot({
        title: variant === "private" ? "完整版本" : "分享版本",
        url: await sheetToPng(full),
      });
    } catch {
      setError("图片还没生成成功。你的结果没有受影响，可以再试一次。");
    } finally {
      setBusy(false);
    }
  }

  function selectVariant(next: "private" | "share") {
    setVariant(next);
    setShot(null);
    setError("");
  }

  return (
    <section className="screen">
      <header className="topbar">
        <button type="button" className="text-btn" onClick={() => patch((item) => ({ ...item, step: "result" }))}>
          返回结果
        </button>
        <button type="button" className="text-btn" onClick={retest}>
          重新测试
        </button>
      </header>
      <h1>保存我的心力地图</h1>
      <p>选择要保存的版本。完整版本内容较多，分享版本不包含你的自述和题目细节。</p>
      <div className="choices">
        <button type="button" className={variant === "private" ? "choice on" : "choice"} onClick={() => selectVariant("private")}>
          完整版本
        </button>
        <button type="button" className={variant === "share" ? "choice on" : "choice"} onClick={() => selectVariant("share")}>
          分享版本
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>我同意把这份结果生成图片，并保存到这台设备上。</span>
      </label>
      {!agreed && <p className="meta selection-hint">勾选同意后，才能生成图片。</p>}
      <button type="button" className="btn" disabled={!agreed || busy} onClick={generate}>
        {busy ? "正在生成图片" : "生成图片"}
      </button>
      {error && (
        <div className="quiet-box" role="alert">
          <p>{error}</p>
          <button type="button" className="btn" onClick={generate}>
            重试
          </button>
        </div>
      )}
      {shot && (
        <figure className="shot">
          <figcaption>{shot.title}</figcaption>
          <img src={shot.url} alt={shot.title} />
          <a className="btn ghost" href={shot.url} download={`${shot.title}.png`}>
            保存图片
          </a>
          <p className="meta">如果浏览器拦住下载，也可以长按图片保存。</p>
        </figure>
      )}
      {armed &&
        createPortal(
          <div className="export-stage" aria-hidden="true">
            <ExportSheet report={report} variant={variant} part="full" booking={CLOSED_BOOKING} includeQr={false} nick={session.nick ?? ""} />
          </div>,
          document.body,
        )}
    </section>
  );
}
