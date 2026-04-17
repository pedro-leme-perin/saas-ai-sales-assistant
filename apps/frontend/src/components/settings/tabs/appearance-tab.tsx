"use client";

import { useCallback, useMemo } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AppearanceTabProps {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  locale: "pt-BR" | "en";
  setLocale: (locale: "pt-BR" | "en") => void;
  t: (key: string) => string;
}

export default function AppearanceTab({
  theme,
  setTheme,
  locale,
  setLocale,
  t,
}: AppearanceTabProps) {
  const themeOptions = useMemo(
    () => [
      { id: "light", labelKey: "settings.appearance.themeLight", icon: Sun },
      { id: "dark", labelKey: "settings.appearance.themeDark", icon: Moon },
      {
        id: "system",
        labelKey: "settings.appearance.themeSystem",
        icon: Monitor,
      },
    ],
    [],
  );

  const handleThemeChange = useCallback(
    (newTheme: "light" | "dark" | "system") => {
      setTheme(newTheme);
    },
    [setTheme],
  );

  const handleLocaleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLocale(e.target.value as "pt-BR" | "en");
    },
    [setLocale],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.appearance.title")}</CardTitle>
        <CardDescription>{t("settings.appearance.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-3 block">
            {t("settings.appearance.theme")}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  handleThemeChange(item.id as "light" | "dark" | "system")
                }
                className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors ${
                  theme === item.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
              >
                <item.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{t(item.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-3 block">
            {t("settings.appearance.language")}
          </label>
          <select
            className="w-full px-4 py-2 border rounded-lg bg-background"
            value={locale}
            onChange={handleLocaleChange}
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-3 block">
            {t("settings.appearance.timezone")}
          </label>
          <select className="w-full px-4 py-2 border rounded-lg bg-background">
            <option value="America/Sao_Paulo">
              {t("settings.appearance.timezones.saoPaulo")}
            </option>
            <option value="America/New_York">
              {t("settings.appearance.timezones.newYork")}
            </option>
            <option value="Europe/London">
              {t("settings.appearance.timezones.london")}
            </option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
