import { type AppLocale } from "@/lib/i18n";

export function formatDateTime(date: Date | string, localeCode: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeCode, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatDate(date: Date | string | null | undefined, localeCode: string) {
  if (!date) {
    return "—";
  }
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeCode, {
    dateStyle: "medium",
  }).format(value);
}

export function localizeDefinition(
  item: { labelZh: string; labelEn: string },
  locale: AppLocale,
) {
  return locale === "ZH_CN" ? item.labelZh : item.labelEn;
}
