import { completePasswordSetupAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getPreferencesForLayout } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { hashPasswordSetupToken } from "@/lib/password-setup";
import { prisma } from "@/lib/prisma";

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const currentUser = await getCurrentUser();

  const dictionary = getDictionary(currentUser?.locale ?? (await getPreferencesForLayout()).locale);
  const params = await searchParams;
  const rawToken = params.token ?? "";

  const setupToken = rawToken
    ? await prisma.passwordSetupToken.findUnique({
        where: { tokenHash: hashPasswordSetupToken(rawToken) },
        include: { user: true },
      })
    : null;

  const expired = !setupToken || setupToken.usedAt || setupToken.expiresAt < new Date() || !setupToken.user.isActive;
  const errorMessage =
    expired || params.error === "expired"
      ? dictionary.auth.setupExpired
      : params.error === "invalid"
        ? dictionary.auth.passwordMismatch
        : null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="hero-card">
          <span className="subtitle-only">{dictionary.appName}</span>
        </section>

        <section className="login-card">
          <div className="stack">
            <h2>{dictionary.auth.setupTitle}</h2>
            <p className="muted">{dictionary.auth.setupIntro}</p>
            {currentUser ? <p className="muted">{dictionary.auth.setupLoggedInHint}</p> : null}
            {errorMessage ? <div className="badge badge-danger">{errorMessage}</div> : null}
            {!expired ? (
              <form action={completePasswordSetupAction}>
                <input type="hidden" name="token" value={rawToken} />
                <div className="field">
                  <label htmlFor="password">{dictionary.auth.password}</label>
                  <input id="password" name="password" type="password" required minLength={8} />
                </div>
                <div className="field">
                  <label htmlFor="passwordConfirm">{dictionary.auth.passwordConfirm}</label>
                  <input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} />
                </div>
                <button type="submit">{dictionary.auth.setupSubmit}</button>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
