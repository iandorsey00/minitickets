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

const sharedCookieDomain = process.env.MINITICKETS_AUTH_COOKIE_DOMAIN?.trim();
export const AUTH_SHARED_COOKIE_DOMAIN =
  sharedCookieDomain && sharedCookieDomain.length > 0 ? sharedCookieDomain : undefined;
