import { redirect } from "next/navigation";

import { AUTH_ROUTES } from "@/lib/auth-config";
import { loginAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getMiniAuthLoginUrl } from "@/lib/auth-service";
import { getPreferencesForLayout } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(AUTH_ROUTES.postLogin);
  }

  const miniAuthLoginUrl = getMiniAuthLoginUrl(AUTH_ROUTES.postLogin);
  const preferences = await getPreferencesForLayout();
  const dictionary = getDictionary(preferences.locale);
  const params = await searchParams;
  const miniAuthEnabled = miniAuthLoginUrl !== AUTH_ROUTES.login;
  const errorMessage =
    params.error === "inactive"
      ? dictionary.auth.inactive
      : params.error === "mfa_send"
        ? dictionary.auth.mfaSendFailed
      : params.error === "invalid"
        ? dictionary.auth.invalid
        : null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="hero-card">
          <span className="login-brand">
            <span className="subtitle-only">{dictionary.appName}</span>
            {preferences.locale === "ZH_CN" ? <span className="login-brand-subtitle" lang="en">{dictionary.appSubtitle}</span> : null}
          </span>
        </section>

        <section className="login-card">
          <div className="stack">
            <h2>{dictionary.auth.loginTitle}</h2>
            {errorMessage ? <div className="badge badge-danger">{errorMessage}</div> : null}
            <form action={loginAction}>
              <div className="field">
                <label htmlFor="email">{dictionary.auth.email}</label>
                <input id="email" name="email" type="email" required disabled={miniAuthEnabled} />
              </div>
              <div className="field">
                <label htmlFor="password">{dictionary.auth.password}</label>
                <input id="password" name="password" type="password" required minLength={8} disabled={miniAuthEnabled} />
              </div>
              {miniAuthEnabled ? (
                <>
                  <p className="muted">{dictionary.auth.sharedLoginNotice}</p>
                  <a className="button auth-secondary-button" href={miniAuthLoginUrl}>
                    {dictionary.auth.sharedLoginAction}
                  </a>
                </>
              ) : (
                <button type="submit">{dictionary.auth.submit}</button>
              )}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
