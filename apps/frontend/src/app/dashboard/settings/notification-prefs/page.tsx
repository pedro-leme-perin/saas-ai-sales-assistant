"use client";

// =============================================
// 🔔 NOTIFICATION PREFERENCES PAGE (Session 48)
// =============================================
// Matrix UI: rows = notification types, columns = channels.
// Each cell is a toggle for `enabled`. Global quiet-hours + timezone +
// digest (EMAIL only) applied to all items on save.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  notificationPreferencesService,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  type NotificationChannelKey,
  type NotificationPreferenceItem,
  type NotificationTypeKey,
} from "@/services/notification-preferences.service";

type MatrixState = Record<
  NotificationTypeKey,
  Record<NotificationChannelKey, boolean>
>;

function defaultMatrix(): MatrixState {
  const m = {} as MatrixState;
  for (const t of NOTIFICATION_TYPES) {
    m[t] = {} as Record<NotificationChannelKey, boolean>;
    for (const c of NOTIFICATION_CHANNELS) m[t][c] = true;
  }
  return m;
}

export default function NotificationPrefsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationPreferencesService.list(),
  });

  const [matrix, setMatrix] = useState<MatrixState>(defaultMatrix);
  const [quietStart, setQuietStart] = useState<string>("");
  const [quietEnd, setQuietEnd] = useState<string>("");
  const [timezone, setTimezone] = useState<string>(
    () =>
      (typeof Intl !== "undefined" &&
        Intl.DateTimeFormat().resolvedOptions().timeZone) ||
      "UTC",
  );
  const [digestMode, setDigestMode] = useState<boolean>(false);

  useEffect(() => {
    if (items.length === 0) return;
    const m = defaultMatrix();
    let qs = "";
    let qe = "";
    let tz = "";
    let dm = false;
    for (const it of items) {
      m[it.type][it.channel] = it.enabled;
      if (!qs && it.quietHoursStart) qs = it.quietHoursStart;
      if (!qe && it.quietHoursEnd) qe = it.quietHoursEnd;
      if (!tz && it.timezone) tz = it.timezone;
      if (it.digestMode) dm = true;
    }
    setMatrix(m);
    if (qs) setQuietStart(qs);
    if (qe) setQuietEnd(qe);
    if (tz) setTimezone(tz);
    setDigestMode(dm);
  }, [items]);

  const upsertMut = useMutation({
    mutationFn: (input: Parameters<typeof notificationPreferencesService.upsert>[0]) =>
      notificationPreferencesService.upsert(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success(t("notificationPrefs.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMut = useMutation({
    mutationFn: () => notificationPreferencesService.reset(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      setMatrix(defaultMatrix());
      setQuietStart("");
      setQuietEnd("");
      setDigestMode(false);
      toast.success(t("notificationPrefs.reset"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleToggle = (type: NotificationTypeKey, channel: NotificationChannelKey) => {
    setMatrix((prev) => ({
      ...prev,
      [type]: { ...prev[type], [channel]: !prev[type][channel] },
    }));
  };

  const handleSave = () => {
    const payload: NotificationPreferenceItem[] = [];
    for (const type of NOTIFICATION_TYPES) {
      for (const channel of NOTIFICATION_CHANNELS) {
        payload.push({
          type,
          channel,
          enabled: matrix[type][channel],
          quietHoursStart: quietStart || null,
          quietHoursEnd: quietEnd || null,
          timezone: timezone || null,
          digestMode: channel === "EMAIL" ? digestMode : false,
        });
      }
    }
    upsertMut.mutate({ items: payload });
  };

  const timezones = useMemo(() => {
    const base = [
      "UTC",
      "America/Sao_Paulo",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Berlin",
      "Asia/Tokyo",
    ];
    if (timezone && !base.includes(timezone)) base.unshift(timezone);
    return base;
  }, [timezone]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("notificationPrefs.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("notificationPrefs.subtitle")}
          </p>
        </div>
        <Button
          className="ml-auto"
          variant="outline"
          onClick={() => resetMut.mutate()}
          disabled={resetMut.isPending}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t("notificationPrefs.resetBtn")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("notificationPrefs.matrixTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium py-2 pr-4">
                      {t("notificationPrefs.typeCol")}
                    </th>
                    {NOTIFICATION_CHANNELS.map((c) => (
                      <th key={c} className="text-center font-medium py-2 px-2">
                        {t(`notificationPrefs.channels.${c}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_TYPES.map((type) => (
                    <tr key={type} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        {t(`notificationPrefs.types.${type}`)}
                      </td>
                      {NOTIFICATION_CHANNELS.map((channel) => (
                        <td key={channel} className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={matrix[type][channel]}
                            onChange={() => handleToggle(type, channel)}
                            aria-label={`${type} ${channel}`}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("notificationPrefs.quietTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {t("notificationPrefs.quietStart")}
                  </label>
                  <input
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    className="w-full px-3 py-2 border rounded bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {t("notificationPrefs.quietEnd")}
                  </label>
                  <input
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                    className="w-full px-3 py-2 border rounded bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {t("notificationPrefs.timezone")}
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border rounded bg-background"
                  >
                    {timezones.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("notificationPrefs.quietHint")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("notificationPrefs.digestTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={digestMode}
                  onChange={(e) => setDigestMode(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {t("notificationPrefs.digestLabel")}
                </span>
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                {t("notificationPrefs.digestHint")}
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={upsertMut.isPending}>
              {upsertMut.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
