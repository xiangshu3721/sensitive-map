import type { BookingView, OpsConfig } from "../model";

export const RECEPTION_IDENTITIES = ["如一老师本人微信", "如一老师预约助理微信"] as const;

const DEFAULTS: OpsConfig = {
  bookingOpen: false,
  qrImageUrl: "",
  receptionIdentity: "",
  headline: "",
  body: "",
  bookingMessage: "",
  service: { form: "", duration: "", price: "", hours: "", capacity: "" },
};

export function resolveBooking(raw: Partial<OpsConfig> | null | undefined): BookingView {
  const service = { ...DEFAULTS.service, ...(raw?.service ?? {}) };
  const config: OpsConfig = {
    ...DEFAULTS,
    ...(raw ?? {}),
    qrImageUrl: raw?.qrImageUrl?.trim() ?? "",
    receptionIdentity: raw?.receptionIdentity?.trim() ?? "",
    service,
  };
  const identityOk = RECEPTION_IDENTITIES.includes(
    config.receptionIdentity as (typeof RECEPTION_IDENTITIES)[number],
  );
  const available = Boolean(config.bookingOpen && config.qrImageUrl && identityOk);
  const labels: { key: keyof OpsConfig["service"]; label: string }[] = [
    { key: "form", label: "形式" },
    { key: "duration", label: "时长" },
    { key: "price", label: "收费" },
    { key: "hours", label: "时段" },
    { key: "capacity", label: "容量" },
  ];
  return {
    available,
    headline: config.headline,
    body: config.body,
    bookingMessage: config.bookingMessage,
    qrImageUrl: available ? config.qrImageUrl : "",
    receptionIdentity: available ? config.receptionIdentity : "",
    serviceLines: labels
      .map((item) => ({ label: item.label, value: service[item.key].trim() }))
      .filter((item) => item.value),
  };
}
