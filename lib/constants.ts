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
