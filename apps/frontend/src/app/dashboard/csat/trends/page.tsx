"use client";

// =============================================
// 📈 CSAT Trends Page (Session 59 — Feature A2)
// =============================================
// Time-series view over CsatResponse (score, NPS, response counts) with
// optional breakdown by agent / tag / channel. Charts rendered inline via
// hand-written SVG (no recharts dep).
//
// Design decisions:
//   - Window default: last 30 days. User can pick 7d / 30d / 90d / 180d.
//   - Bucket auto-scales (day if ≤45d, week if ≤180d).
//   - All currency/format strings go through i18n `useTranslation()`.
//   - Loading / error / empty states explicit + bounded (no flicker).
//   - Error boundary inherited from layout.tsx siblings (error.tsx here too).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/index";
import { useTranslation } from "@/i18n/use-translation";
import {
  csatService,
  type CsatChannel,
  type CsatTrigger,
  type TrendBucket,
  type TrendBreakdownRow,
  type TrendBucketRow,
  type TrendGroupBy,
} from "@/services/csat.service";
import { cn } from "@/lib/utils";

type WindowPreset = "7d" | "30d" | "90d" | "180d";

const PRESET_DAYS: Record<WindowPreset, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
};

function presetToWindow(p: WindowPreset): { since: string; until: string; bucket: TrendBucket } {
  const until = new Date();
  const since = new Date(until.getTime() - PRESET_DAYS[p] * 86_400_000);
  const days = PRESET_DAYS[p];
  const bucket: TrendBucket = days <= 45 ? "day" : "week";
  return {
    since: since.toISOString(),
    until: until.toISOString(),
    bucket,
  };
}

export default function CsatTrendsPage() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<WindowPreset>("30d");
  const [groupBy, setGroupBy] = useState<TrendGroupBy | "none">("agent");
  const [channel, setChannel] = useState<CsatChannel | "all">("all");
  const [trigger, setTrigger] = useState<CsatTrigger | "all">("all");

  const window = useMemo(() => presetToWindow(preset), [preset]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["csat", "trends", preset, groupBy, channel, trigger],
    queryFn: () =>
      csatService.trends({
        since: window.since,
        until: window.until,
        bucket: window.bucket,
        groupBy: groupBy === "none" ? undefined : groupBy,
        channel: channel === "all" ? undefined : channel,
        trigger: trigger === "all" ? undefined : trigger,
      }),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("csatTrends.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("csatTrends.subtitle")}
          </p>
        </div>
      </header>

      <FilterBar
        preset={preset}
        setPreset={setPreset}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        channel={channel}
        setChannel={setChannel}
        trigger={trigger}
        setTrigger={setTrigger}
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {t("csatTrends.error")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && data && (
        <>
          <KpiGrid summary={data.summary} />
          <TimeSeriesChart
            rows={data.timeSeries}
            bucket={data.window.bucket}
            title={t("csatTrends.chart.timeSeries")}
          />
          {data.breakdown && data.breakdown.length > 0 && (
            <BreakdownTable rows={data.breakdown} groupBy={groupBy as TrendGroupBy} />
          )}
          {data.breakdown && data.breakdown.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t("csatTrends.breakdown.empty")}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ===== Filter bar ==========================================================

function FilterBar(props: {
  preset: WindowPreset;
  setPreset: (p: WindowPreset) => void;
  groupBy: TrendGroupBy | "none";
  setGroupBy: (g: TrendGroupBy | "none") => void;
  channel: CsatChannel | "all";
  setChannel: (c: CsatChannel | "all") => void;
  trigger: CsatTrigger | "all";
  setTrigger: (tr: CsatTrigger | "all") => void;
}) {
  const { t } = useTranslation();
  const presets: WindowPreset[] = ["7d", "30d", "90d", "180d"];
  const groupByOptions: Array<TrendGroupBy | "none"> = ["none", "agent", "tag", "channel"];
  const channels: Array<CsatChannel | "all"> = ["all", "WHATSAPP", "EMAIL"];
  const triggers: Array<CsatTrigger | "all"> = ["all", "CALL_END", "CHAT_CLOSE"];

  return (
    <Card>
      <CardContent className="flex flex-wrap gap-4 p-4">
        <FilterGroup label={t("csatTrends.filters.window")}>
          {presets.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={props.preset === p ? "default" : "outline"}
              onClick={() => props.setPreset(p)}
            >
              {t(`csatTrends.presets.${p}`)}
            </Button>
          ))}
        </FilterGroup>

        <FilterGroup label={t("csatTrends.filters.groupBy")}>
          {groupByOptions.map((g) => (
            <Button
              key={g}
              size="sm"
              variant={props.groupBy === g ? "default" : "outline"}
              onClick={() => props.setGroupBy(g)}
            >
              {t(`csatTrends.groupBy.${g}`)}
            </Button>
          ))}
        </FilterGroup>

        <FilterGroup label={t("csatTrends.filters.channel")}>
          {channels.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={props.channel === c ? "default" : "outline"}
              onClick={() => props.setChannel(c)}
            >
              {c === "all" ? t("csatTrends.all") : t(`csat.channel.${c}`)}
            </Button>
          ))}
        </FilterGroup>

        <FilterGroup label={t("csatTrends.filters.trigger")}>
          {triggers.map((tr) => (
            <Button
              key={tr}
              size="sm"
              variant={props.trigger === tr ? "default" : "outline"}
              onClick={() => props.setTrigger(tr)}
            >
              {tr === "all" ? t("csatTrends.all") : t(`csat.trigger.${tr}`)}
            </Button>
          ))}
        </FilterGroup>
      </CardContent>
    </Card>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

// ===== KPI grid ============================================================

function KpiGrid({
  summary,
}: {
  summary: {
    total: number;
    responded: number;
    responseRate: number;
    avgScore: number;
    nps: number;
    promoters: number;
    passives: number;
    detractors: number;
  };
}) {
  const { t } = useTranslation();
  const cards = [
    { label: t("csatTrends.kpi.total"), value: summary.total },
    { label: t("csatTrends.kpi.responded"), value: summary.responded },
    {
      label: t("csatTrends.kpi.responseRate"),
      value: `${summary.responseRate.toFixed(1)}%`,
    },
    { label: t("csatTrends.kpi.avgScore"), value: summary.avgScore.toFixed(2) },
    { label: t("csatTrends.kpi.nps"), value: summary.nps },
    { label: t("csatTrends.kpi.promoters"), value: summary.promoters },
    { label: t("csatTrends.kpi.passives"), value: summary.passives },
    { label: t("csatTrends.kpi.detractors"), value: summary.detractors },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===== Time-series chart (inline SVG) ======================================

function TimeSeriesChart({
  rows,
  bucket,
  title,
}: {
  rows: TrendBucketRow[];
  bucket: TrendBucket;
  title: string;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {t("csatTrends.chart.empty")}
        </CardContent>
      </Card>
    );
  }

  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 32, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const xStep = innerW / Math.max(1, rows.length - 1);

  // avgScore line scaled to 0..5
  const yFromScore = (v: number) =>
    padding.top + innerH - (Math.min(5, Math.max(0, v)) / 5) * innerH;

  // responded count — independent axis (right-side). Compute max for scaling.
  const maxResponded = Math.max(1, ...rows.map((r) => r.responded));
  const yFromCount = (v: number) =>
    padding.top + innerH - (v / maxResponded) * innerH;

  const scorePath = rows
    .map((r, i) => {
      const x = padding.left + i * xStep;
      const y = yFromScore(r.avgScore);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const countPath = rows
    .map((r, i) => {
      const x = padding.left + i * xStep;
      const y = yFromCount(r.responded);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const fmtBucket = (iso: string) => {
    const d = new Date(iso);
    if (bucket === "month") {
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            role="img"
            aria-label={title}
          >
            {/* Y grid lines (score 0..5) */}
            {[0, 1, 2, 3, 4, 5].map((s) => {
              const y = yFromScore(s);
              return (
                <g key={s}>
                  <line
                    x1={padding.left}
                    x2={padding.left + innerW}
                    y1={y}
                    y2={y}
                    className="stroke-border"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={padding.left - 6}
                    y={y + 4}
                    className="fill-muted-foreground text-[10px]"
                    textAnchor="end"
                  >
                    {s}
                  </text>
                </g>
              );
            })}

            {/* X axis labels (sparse — every Nth bucket if crowded) */}
            {rows.map((r, i) => {
              const showEvery = Math.max(1, Math.ceil(rows.length / 8));
              if (i % showEvery !== 0 && i !== rows.length - 1) return null;
              const x = padding.left + i * xStep;
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {fmtBucket(r.bucketStart)}
                </text>
              );
            })}

            {/* Response-count bars (background layer) */}
            {rows.map((r, i) => {
              const x = padding.left + i * xStep - Math.max(2, (xStep * 0.6) / 2);
              const barW = Math.max(4, xStep * 0.6);
              const y = yFromCount(r.responded);
              const h = padding.top + innerH - y;
              return (
                <rect
                  key={`bar-${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  className="fill-primary/15"
                  rx={2}
                />
              );
            })}

            {/* avgScore line (foreground) */}
            <path d={scorePath} className="stroke-primary" strokeWidth={2} fill="none" />

            {/* avgScore dots with a11y labels */}
            {rows.map((r, i) => {
              const x = padding.left + i * xStep;
              const y = yFromScore(r.avgScore);
              return (
                <circle
                  key={`dot-${i}`}
                  cx={x}
                  cy={y}
                  r={2.5}
                  className="fill-primary"
                >
                  <title>
                    {fmtBucket(r.bucketStart)} · score {r.avgScore.toFixed(2)} ·
                    NPS {r.nps} · {r.responded} {t("csatTrends.chart.responses")}
                  </title>
                </circle>
              );
            })}
          </svg>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("csatTrends.chart.legend")}
        </p>
      </CardContent>
    </Card>
  );
}

// ===== Breakdown table =====================================================

function BreakdownTable({
  rows,
  groupBy,
}: {
  rows: TrendBreakdownRow[];
  groupBy: TrendGroupBy;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("csatTrends.breakdown.title")} · {t(`csatTrends.groupBy.${groupBy}`)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{t("csatTrends.breakdown.col.key")}</th>
              <th className="px-3 py-2 text-right">
                {t("csatTrends.breakdown.col.responded")}
              </th>
              <th className="px-3 py-2 text-right">
                {t("csatTrends.breakdown.col.avgScore")}
              </th>
              <th className="px-3 py-2 text-right">{t("csatTrends.breakdown.col.nps")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 text-right">{r.responded}</td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={cn(
                      "font-medium",
                      r.avgScore >= 4 && "text-emerald-600",
                      r.avgScore < 3 && "text-destructive",
                    )}
                  >
                    {r.avgScore.toFixed(2)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Badge
                    variant={
                      r.nps >= 50 ? "success" : r.nps >= 0 ? "outline" : "destructive"
                    }
                  >
                    {r.nps}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
