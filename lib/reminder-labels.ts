import type { Locale } from "@prisma/client";

export function formatReminderOffsetLabel(offsetMinutes: number, locale: Locale) {
  if (offsetMinutes === 0) {
    return locale === "EN" ? "At time of event" : "事件开始时";
  }

  const hours = offsetMinutes / 60;
  if (Number.isInteger(hours) && hours >= 1) {
    if (locale === "EN") {
      return hours === 1 ? "1 hour before" : `${hours} hours before`;
    }
    return hours === 1 ? "1 小时前" : `${hours} 小时前`;
  }

  if (locale === "EN") {
    return offsetMinutes === 1 ? "1 minute before" : `${offsetMinutes} minutes before`;
  }

  return `${offsetMinutes} 分钟前`;
}
