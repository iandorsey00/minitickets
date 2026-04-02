import type { Locale } from "@prisma/client";

export function formatReminderOffsetLabel(offsetMinutes: number, locale: Locale) {
  if (offsetMinutes === 0) {
    return locale === "EN" ? "At time of event" : "事件开始时";
  }

  const monthMinutes = 30 * 24 * 60;
  if (offsetMinutes === monthMinutes || offsetMinutes === monthMinutes * 2) {
    const months = offsetMinutes / monthMinutes;
    if (locale === "EN") {
      return months === 1 ? "1 month before" : `${months} months before`;
    }
    return months === 1 ? "1 个月前" : `${months} 个月前`;
  }

  const weekMinutes = 7 * 24 * 60;
  if (Number.isInteger(offsetMinutes / weekMinutes) && offsetMinutes >= weekMinutes) {
    const weeks = offsetMinutes / weekMinutes;
    if (locale === "EN") {
      return weeks === 1 ? "1 week before" : `${weeks} weeks before`;
    }
    return weeks === 1 ? "1 周前" : `${weeks} 周前`;
  }

  const dayMinutes = 24 * 60;
  if (Number.isInteger(offsetMinutes / dayMinutes) && offsetMinutes >= dayMinutes) {
    const days = offsetMinutes / dayMinutes;
    if (locale === "EN") {
      return days === 1 ? "1 day before" : `${days} days before`;
    }
    return days === 1 ? "1 天前" : `${days} 天前`;
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
