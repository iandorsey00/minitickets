export const SESSION_COOKIE = "minitickets_session";
export const LOCALE_COOKIE = "minitickets_locale";
export const THEME_COOKIE = "minitickets_theme";
export const ACCENT_COOKIE = "minitickets_accent";
export const WORKSPACE_COOKIE = "minitickets_workspace";

export const accentValues = [
  "BLUE",
  "CYAN",
  "TEAL",
  "GREEN",
  "LIME",
  "YELLOW",
  "ORANGE",
  "RED",
  "PINK",
  "PURPLE",
] as const;

export const localeValues = ["ZH_CN", "EN"] as const;
export const themeValues = ["SYSTEM", "LIGHT", "DARK"] as const;
export const timeZoneValues = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export const defaultStatusKey = "NEW";
export const defaultPriorityKey = "MEDIUM";
export const defaultCategoryKey = "GENERAL_REQUEST";

export const accentTokenMap: Record<(typeof accentValues)[number], string> = {
  BLUE: "blue",
  CYAN: "cyan",
  TEAL: "teal",
  GREEN: "green",
  LIME: "lime",
  YELLOW: "yellow",
  ORANGE: "orange",
  RED: "red",
  PINK: "pink",
  PURPLE: "purple",
};

export const themeTokenMap: Record<(typeof themeValues)[number], string> = {
  SYSTEM: "system",
  LIGHT: "light",
  DARK: "dark",
};

export const localeTokenMap: Record<(typeof localeValues)[number], string> = {
  ZH_CN: "zh-CN",
  EN: "en",
};

export const accentLabelMap: Record<
  (typeof accentValues)[number],
  { zh: string; en: string }
> = {
  BLUE: { zh: "蓝色", en: "Blue" },
  CYAN: { zh: "青色", en: "Cyan" },
  TEAL: { zh: "蓝绿", en: "Teal" },
  GREEN: { zh: "绿色", en: "Green" },
  LIME: { zh: "黄绿", en: "Lime" },
  YELLOW: { zh: "黄色", en: "Yellow" },
  ORANGE: { zh: "橙色", en: "Orange" },
  RED: { zh: "红色", en: "Red" },
  PINK: { zh: "粉色", en: "Pink" },
  PURPLE: { zh: "紫色", en: "Purple" },
};

export const timeZoneLabelMap: Record<(typeof timeZoneValues)[number], { zh: string; en: string }> = {
  "America/Los_Angeles": { zh: "洛杉矶（太平洋时间）", en: "Los Angeles (Pacific Time)" },
  "America/Denver": { zh: "丹佛（山区时间）", en: "Denver (Mountain Time)" },
  "America/Chicago": { zh: "芝加哥（中部时间）", en: "Chicago (Central Time)" },
  "America/New_York": { zh: "纽约（东部时间）", en: "New York (Eastern Time)" },
  "Europe/London": { zh: "伦敦", en: "London" },
  "Europe/Paris": { zh: "巴黎", en: "Paris" },
  "Asia/Shanghai": { zh: "上海", en: "Shanghai" },
  "Asia/Hong_Kong": { zh: "香港", en: "Hong Kong" },
  "Asia/Singapore": { zh: "新加坡", en: "Singapore" },
  "Asia/Tokyo": { zh: "东京", en: "Tokyo" },
  "Australia/Sydney": { zh: "悉尼", en: "Sydney" },
};
