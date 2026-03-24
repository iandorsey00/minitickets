import { redirect } from "next/navigation";

import { loginAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getPreferencesForLayout } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const preferences = await getPreferencesForLayout();
  const dictionary = getDictionary(preferences.locale);
  const params = await searchParams;
  const errorMessage =
    params.error === "inactive"
      ? dictionary.auth.inactive
      : params.error === "invalid"
        ? dictionary.auth.invalid
        : null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="hero-card">
          <h1>{dictionary.appName}</h1>
          <span className="subtitle">{dictionary.appSubtitle}</span>
          <p>{dictionary.auth.welcome}</p>
        </section>

        <section className="login-card">
          <div className="stack">
            <div>
              <h2>{dictionary.auth.loginTitle}</h2>
              <p className="muted">{dictionary.auth.helper}</p>
            </div>
            {errorMessage ? <div className="badge badge-danger">{errorMessage}</div> : null}
            <form action={loginAction}>
              <div className="field">
                <label htmlFor="email">{dictionary.auth.email}</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div className="field">
                <label htmlFor="password">{dictionary.auth.password}</label>
                <input id="password" name="password" type="password" required minLength={8} />
              </div>
              <button type="submit">{dictionary.auth.submit}</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
