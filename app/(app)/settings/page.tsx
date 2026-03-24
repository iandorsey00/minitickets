import { updateSettingsAction } from "@/lib/actions";
import { accentValues, localeValues, themeValues } from "@/lib/constants";
import { getViewerContext } from "@/lib/data";
import { PageHeader, Panel } from "@/components/ui";

export default async function SettingsPage() {
  const data = await getViewerContext();
  const t = data.dictionary;

  return (
    <>
      <PageHeader title={t.settings.title} subtitle={t.settings.profile} />
      <Panel title={t.settings.appearance}>
        <form action={updateSettingsAction} className="stack">
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
            <label htmlFor="accentColor">{t.common.accentColor}</label>
            <select id="accentColor" name="accentColor" defaultValue={data.user.accentColor}>
              {accentValues.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="password">{t.common.password}</label>
            <input id="password" name="password" type="password" />
            <p className="muted">{t.settings.passwordHelp}</p>
          </div>
          <div>
            <button type="submit">{t.common.save}</button>
          </div>
        </form>
      </Panel>
    </>
  );
}
