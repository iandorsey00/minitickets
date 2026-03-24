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
