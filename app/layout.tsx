import "@fontsource/inter/index.css";
import "@fontsource-variable/noto-sans-sc/index.css";

import "@/app/globals.css";
import { accentTokenMap, themeTokenMap } from "@/lib/constants";
import { getPreferencesForLayout } from "@/lib/data";
import { formatLocale } from "@/lib/i18n";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preferences = await getPreferencesForLayout();

  return (
    <html
      lang={formatLocale(preferences.locale)}
      data-theme={themeTokenMap[preferences.themePreference]}
      data-accent={accentTokenMap[preferences.accentColor]}
    >
      <body>{children}</body>
    </html>
  );
}
