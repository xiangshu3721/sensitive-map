import { useEffect, useState } from "react";
import { resolveBooking } from "./logic/booking";
import type { BookingView, Session } from "./model";
import { HomePage, ImpactPage, NeedsPage, PrivacyPage, QuizPage, ScenarioPage } from "./pages/FlowPages";
import { PreviewPage } from "./pages/PreviewPage";
import { ResultPage } from "./pages/ResultPage";
import { kit } from "./lib/records";
import { SessionProvider } from "./session/context";
import { clearSession, createSession, loadSession, saveSession } from "./session/store";

const CLOSED = resolveBooking(null);
const FLOW_STEPS = ["quiz", "impact", "scenario", "needs"];

function openSession(): Session {
  const saved = loadSession();
  if (!saved) return createSession();
  if (saved.step === "consent") {
    return { ...saved, step: "quiz" };
  }
  if (saved.step === "result" || saved.step === "preview") {
    return { ...saved, step: "home", returnStep: "result" };
  }
  return saved;
}

export function App() {
  const [session, setSession] = useState<Session>(openSession);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [booking, setBooking] = useState<BookingView>(CLOSED);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  // 昵称门槛：只要停在作答的页面（含刷新恢复、直接打开），没有确认过昵称就先补录；返回则回到首页。
  useEffect(() => {
    const k = kit();
    if (!k || !FLOW_STEPS.includes(session.step)) return;
    k.ensureNick(
      () => {
        const nick = k.nick.get();
        setSession((cur) => (cur.nick === nick ? cur : { ...cur, nick }));
      },
      { onCancel: () => setSession((cur) => ({ ...cur, step: "home" })) },
    );
  }, [session.step, session.id]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch(`${import.meta.env.BASE_URL}ops-config.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!ignore) setBooking(resolveBooking(data));
      })
      .catch(() => {
        if (!ignore) setBooking(CLOSED);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function patch(recipe: (current: Session) => Session) {
    setSession((current) => {
      const next = recipe(current);
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }

  function restart() {
    kit()?.nickReset();
    clearSession();
    setSession(createSession());
  }

  function retest() {
    kit()?.nickReset();
    clearSession();
    const next = createSession();
    next.step = "quiz";
    setSession(next);
  }

  return (
    <SessionProvider value={{ session, offline, booking, patch, restart, retest }}>
      <div className="app">
        {offline && <p className="offline">当前没有网络。已填内容留在这台设备上，可以继续。</p>}
        <main className="phone">
          {session.step === "home" && <HomePage />}
          {session.step === "quiz" && <QuizPage />}
          {session.step === "impact" && <ImpactPage />}
          {session.step === "scenario" && <ScenarioPage />}
          {session.step === "needs" && <NeedsPage />}
          {session.step === "result" && <ResultPage />}
          {session.step === "preview" && <PreviewPage />}
          {session.step === "privacy" && <PrivacyPage />}
        </main>
      </div>
    </SessionProvider>
  );
}
