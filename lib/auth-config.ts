export const AUTH_APP_ID = "minitickets";
export const AUTH_SERVICE_MODE = process.env.MINITICKETS_AUTH_MODE ?? "LOCAL";

export const AUTH_ROUTES = {
  login: "/login",
  verifyLogin: "/verify-login",
  setupPassword: "/setup-password",
  postLogin: "/tickets",
} as const;

export const AUTH_COOKIE_NAMES = {
  session: "minitickets_session",
  loginChallenge: "minitickets_login_challenge",
} as const;

export const SHARED_PREFERENCE_COOKIE_NAMES = {
  locale: process.env.SHARED_LOCALE_COOKIE_NAME || "mini_locale",
  theme: process.env.SHARED_THEME_COOKIE_NAME || "mini_theme",
  accent: process.env.SHARED_ACCENT_COOKIE_NAME || "mini_accent",
} as const;

export const MINI_AUTH_LOGIN_REDIRECT_ENABLED =
  process.env.MINIAUTH_LOGIN_REDIRECT_ENABLED === "true";

const sharedCookieDomain = process.env.MINITICKETS_AUTH_COOKIE_DOMAIN?.trim();
export const AUTH_SHARED_COOKIE_DOMAIN =
  sharedCookieDomain && sharedCookieDomain.length > 0 ? sharedCookieDomain : undefined;
