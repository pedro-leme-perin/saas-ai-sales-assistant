"use client";

// =============================================
// ⭐ CSAT Dashboard Page (Session 50)
// =============================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Star,
  BarChart3,
  Settings as SettingsIcon,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge } from "@/components/ui/index";
import { useTranslation } from "@/i18n/use-translation";
import {
  csatService,
  type CsatTrigger,
  type CsatChannel,
  type CsatResponseStatus,
  type UpsertCsatConfigInput,
  type CsatSurveyConfig,
} from "@/services/csat.service";
import { cn } from "@/lib/utils";

type Tab = "dashboard" | "config" | "responses";
const TABS: Tab[] = ["dashboard", "config", "responses"];

const TRIGGERS: CsatTrigger[] = ["CALL_END", "CHAT_CLOSE"];
const CHANNELS: CsatChannel[] = ["WHATSAPP", "EMAIL"];
const STATUSES: CsatResponseStatus[] = [
  "SCHEDULED",
  "SENT",
  "RESPONDED",
  "EXPIRED",
  "FAILED",
];

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function CsatPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Star className="h-6 w-6 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">{t("csat.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("csat.subtitle")}</p>
        </div>
      </div>

      <div className="flex border-b">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === tb
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tb === "dashboard" && <BarChart3 className="h-4 w-4" />}
            {tb === "config" && <SettingsIcon className="h-4 w-4" />}
            {tb === "responses" && <ListChecks className="h-4 w-4" />}
            {t(`csat.tabs.${tb}`)}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "config" && <ConfigTab />}
      {tab === "responses" && <ResponsesTab />}
    </div>
  );
}

function DashboardTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["csat", "analytics"],
    queryFn: () => csatService.analytics(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label={t("csat.metrics.total")} value={data.total} />
        <MetricCard label={t("csat.metrics.responded")} value={data.responded} />
        <MetricCard
          label={t("csat.metrics.responseRate")}
          value={pct(data.responseRate)}
        />
        <MetricCard
          label={t("csat.metrics.avgScore")}
          value={data.avgScore.toFixed(2)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label={t("csat.metrics.promoters")} value={data.promoters} />
        <MetricCard label={t("csat.metrics.passives")} value={data.passives} />
        <MetricCard label={t("csat.metrics.detractors")} value={data.detractors} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("csat.metrics.distribution")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(["1", "2", "3", "4", "5"] as const).map((s) => {
              const count = data.distribution[s] ?? 0;
              const max = Math.max(1, ...Object.values(data.distribution));
              const width = (count / max) * 100;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className="flex w-12 items-center gap-1 text-sm font-medium">
                    {s} <Star className="h-3 w-3 text-amber-500" />
                  </div>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm text-muted-foreground">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["csat", "configs"],
    queryFn: () => csatService.listConfigs(),
  });

  const upsertM = useMutation({
    mutationFn: (input: UpsertCsatConfigInput) => csatService.upsertConfig(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["csat", "configs"] });
      toast.success(t("csat.toast.saveOk"));
    },
    onError: () => toast.error(t("csat.config.saveErr")),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => csatService.removeConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["csat", "configs"] });
      toast.success(t("csat.toast.deleteOk"));
    },
    onError: () => toast.error(t("csat.config.removeErr")),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const byTrigger = new Map<CsatTrigger, CsatSurveyConfig>();
  (data ?? []).forEach((c) => byTrigger.set(c.trigger, c));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("csat.config.hint")}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {TRIGGERS.map((trig) => (
          <ConfigCard
            key={trig}
            trigger={trig}
            existing={byTrigger.get(trig)}
            onSave={(input) => upsertM.mutate(input)}
            onRemove={(id) => {
              if (confirm(t("csat.config.confirmDelete"))) removeM.mutate(id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ConfigCard({
  trigger,
  existing,
  onSave,
  onRemove,
}: {
  trigger: CsatTrigger;
  existing?: CsatSurveyConfig;
  onSave: (input: UpsertCsatConfigInput) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [delayMinutes, setDelay] = useState(existing?.delayMinutes ?? 5);
  const [channel, setChannel] = useState<CsatChannel>(
    existing?.channel ?? "WHATSAPP",
  );
  const [messageTpl, setMessageTpl] = useState(
    existing?.messageTpl ??
      "Oi {{name}}, como foi seu atendimento? Avalie em: {{link}}",
  );
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{t(`csat.trigger.${trigger}`)}</span>
          <Badge variant={isActive ? "success" : "outline"}>
            {t("csat.config.active")}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("csat.config.delayMinutes")}</Label>
            <Input
              type="number"
              min={0}
              max={1440}
              value={delayMinutes}
              onChange={(e) => setDelay(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>{t("csat.channel.WHATSAPP")}/{t("csat.channel.EMAIL")}</Label>
            <div className="mt-1 flex gap-1">
              {CHANNELS.map((ch) => (
                <Button
                  key={ch}
                  size="sm"
                  variant={channel === ch ? "default" : "outline"}
                  onClick={() => setChannel(ch)}
                >
                  {t(`csat.channel.${ch}`)}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <Label>{t("csat.config.messageTpl")}</Label>
          <textarea
            value={messageTpl}
            onChange={(e) => setMessageTpl(e.target.value)}
            className="mt-1 w-full rounded border bg-background p-2 text-sm"
            rows={3}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("csat.config.messageTplHint")}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t("csat.config.active")}
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() =>
              onSave({ trigger, delayMinutes, channel, messageTpl, isActive })
            }
          >
            <Save className="mr-2 h-4 w-4" />
            {t("csat.config.save")}
          </Button>
          {existing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRemove(existing.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResponsesTab() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CsatResponseStatus | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ["csat", "responses", status ?? "all"],
    queryFn: () => csatService.listResponses({ status, limit: 100 }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("csat.responses.filterStatus")}:
        </span>
        <Button
          size="sm"
          variant={status === undefined ? "default" : "outline"}
          onClick={() => setStatus(undefined)}
        >
          {t("csat.responses.all")}
        </Button>
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {t(`csat.status.${s}`)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !data || data.data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("csat.responses.empty")}
        </p>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">
                    {t("csat.responses.columns.status")}
                  </th>
                  <th className="px-3 py-2 text-left">
                    {t("csat.responses.columns.trigger")}
                  </th>
                  <th className="px-3 py-2 text-left">
                    {t("csat.responses.columns.channel")}
                  </th>
                  <th className="px-3 py-2 text-center">
                    {t("csat.responses.columns.score")}
                  </th>
                  <th className="px-3 py-2 text-left">
                    {t("csat.responses.columns.comment")}
                  </th>
                  <th className="px-3 py-2 text-left">
                    {t("csat.responses.columns.scheduledFor")}
                  </th>
                  <th className="px-3 py-2 text-left">
                    {t("csat.responses.columns.respondedAt")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/50">
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "RESPONDED" ? "success" : "outline"}>
                        {t(`csat.status.${r.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {t(`csat.trigger.${r.trigger}`)}
                    </td>
                    <td className="px-3 py-2">
                      {t(`csat.channel.${r.channel}`)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.score != null ? (
                        <span className="flex items-center justify-center gap-0.5">
                          {r.score}
                          <Star className="h-3 w-3 text-amber-500" />
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2">
                      {r.comment || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(r.scheduledFor).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.respondedAt
                        ? new Date(r.respondedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
