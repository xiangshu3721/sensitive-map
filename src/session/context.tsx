import { createContext, useContext, type ReactNode } from "react";
import type { BookingView, Session } from "../model";

export type SessionApi = {
  session: Session;
  offline: boolean;
  booking: BookingView;
  patch: (recipe: (session: Session) => Session) => void;
  restart: () => void;
  retest: () => void;
};

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionApi;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const value = useContext(SessionContext);
  if (!value) throw new Error("缺少测评会话");
  return value;
}
