import { redirect } from "next/navigation";

import { AUTH_ROUTES } from "@/lib/auth-config";
import { resendLoginCodeAction, verifyLoginCodeAction } from "@/lib/actions";
import { getCurrentUser, getPendingLoginChallenge } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export default async function VerifyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect(AUTH_ROUTES.postLogin);
  }

  const challenge = await getPendingLoginChallenge();
  if (!challenge) {
    redirect(AUTH_ROUTES.login);
  }

  const dictionary = getDictionary(challenge.user.locale);
  const params = await searchParams;
  const errorMessage =
    params.error === "expired"
      ? dictionary.auth.verifyExpired
      : params.error === "invalid"
        ? dictionary.auth.verifyInvalid
        : null;
  const sentMessage = params.sent === "1" ? dictionary.auth.verifySent : null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="hero-card">
          <span className="subtitle-only">{dictionary.appName}</span>
        </section>

        <section className="login-card">
          <div className="stack">
            <h2>{dictionary.auth.verifyTitle}</h2>
            <p className="muted">
              {dictionary.auth.verifyIntro} {maskEmail(challenge.user.email)}
            </p>
            {errorMessage ? <div className="badge badge-danger">{errorMessage}</div> : null}
            {sentMessage ? <div className="badge">{sentMessage}</div> : null}
            <form action={verifyLoginCodeAction}>
              <div className="field">
                <label htmlFor="code">{dictionary.auth.verificationCode}</label>
                <input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                />
              </div>
              <button type="submit">{dictionary.auth.verifySubmit}</button>
            </form>
            <form action={resendLoginCodeAction}>
              <button type="submit" className="ghost-button auth-secondary-button">
                {dictionary.auth.resendCode}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
