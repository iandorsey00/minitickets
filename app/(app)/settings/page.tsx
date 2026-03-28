import { updateSettingsAction } from "@/lib/actions";
import { accentLabelMap, accentValues, localeValues, themeValues, timeZoneLabelMap, timeZoneValues } from "@/lib/constants";
import { getViewerContext } from "@/lib/data";
import { Badge, PageHeader, Panel } from "@/components/ui";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; password?: string; saved?: string }>;
}) {
  const data = await getViewerContext();
  const t = data.dictionary;
  const params = await searchParams;
  const errorMessage =
    params.error === "password_mismatch"
      ? t.settings.passwordMismatch
      : params.error === "invalid"
        ? t.auth.invalid
        : params.password === "required"
          ? t.settings.passwordRequired
          : null;
  const successMessage = params.saved === "1" ? t.settings.saved : null;

  return (
    <>
      <PageHeader title={t.settings.title} subtitle={t.settings.profile} />
      <Panel title={t.settings.appearance}>
        <form action={updateSettingsAction} className="stack">
          {successMessage ? <Badge label={successMessage} tone="success" /> : null}
          {errorMessage ? <Badge label={errorMessage} tone="danger" /> : null}
          <div className="field">
            <label htmlFor="displayName">{t.common.displayName}</label>
            <input id="displayName" name="displayName" defaultValue={data.user.displayName} required />
          </div>
          <div className="field">
            <label htmlFor="locale">{t.common.language}</label>
            <select id="locale" name="locale" defaultValue={data.user.locale}>
              {localeValues.map((locale) => (
                <option key={locale} value={locale}>
                  {locale === "ZH_CN" ? "简体中文" : "English"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="themePreference">{t.common.theme}</label>
            <select id="themePreference" name="themePreference" defaultValue={data.user.themePreference}>
              {themeValues.map((theme) => (
                <option key={theme} value={theme}>
                  {theme === "LIGHT"
                    ? t.common.light
                    : theme === "DARK"
                      ? t.common.dark
                      : t.common.system}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="timeZone">{t.common.timeZone}</label>
            <select id="timeZone" name="timeZone" defaultValue={data.user.timeZone}>
              {timeZoneValues.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {data.locale === "ZH_CN" ? timeZoneLabelMap[timeZone].zh : timeZoneLabelMap[timeZone].en}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="accentColor">{t.common.accentColor}</label>
              <select id="accentColor" name="accentColor" defaultValue={data.user.accentColor}>
                {accentValues.map((accent) => (
                  <option key={accent} value={accent}>
                    {data.locale === "ZH_CN" ? accentLabelMap[accent].zh : accentLabelMap[accent].en}
                  </option>
                ))}
              </select>
          </div>
          <div className="field">
            <label htmlFor="emailMfaEnabled">{t.settings.emailMfa}</label>
            <label className="checkbox-row" htmlFor="emailMfaEnabled">
              <input
                id="emailMfaEnabled"
                name="emailMfaEnabled"
                type="checkbox"
                defaultChecked={data.user.emailMfaEnabled}
              />
              <span>{t.settings.emailMfaHelp}</span>
            </label>
          </div>
          <div className="field">
            <label htmlFor="password">{t.common.password}</label>
            <input id="password" name="password" type="password" />
            <p className="muted">{t.settings.passwordHelp}</p>
          </div>
          <div className="field">
            <label htmlFor="passwordConfirm">{t.auth.passwordConfirm}</label>
            <input id="passwordConfirm" name="passwordConfirm" type="password" />
            <p className="muted">{t.settings.passwordConfirmHelp}</p>
          </div>
          <div>
            <button type="submit">{t.common.save}</button>
          </div>
        </form>
      </Panel>
    </>
  );
}
