import { type AppLocale } from "@/lib/i18n";

const defaultTimeZone = process.env.APP_TIMEZONE ?? "America/Los_Angeles";

export function formatDateTime(date: Date | string, localeCode: string, timeZone = defaultTimeZone) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeCode, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

export function formatEventDateTime(
  date: Date | string,
  allDay: boolean,
  localeCode: string,
  timeZone = defaultTimeZone,
) {
  if (allDay) {
    return formatDate(date, localeCode, "UTC");
  }

  return formatDateTime(date, localeCode, timeZone);
}

export function formatDate(date: Date | string | null | undefined, localeCode: string, timeZone = defaultTimeZone) {
  if (!date) {
    return "—";
  }
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeCode, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

export function localizeDefinition(
  item: { labelZh: string; labelEn: string },
  locale: AppLocale,
) {
  return locale === "ZH_CN" ? item.labelZh : item.labelEn;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
