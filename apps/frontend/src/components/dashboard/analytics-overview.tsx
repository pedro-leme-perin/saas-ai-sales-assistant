"use client";

import { useMemo } from "react";
import {
  Brain,
  Heart,
  Radio,
  Target,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n/use-translation";

interface AnalyticsOverviewData {
  totalCalls: number;
  totalChats: number;
  aiSuggestionsUsed: number;
  avgSentiment: number;
  conversionRate: number;
}

interface AnalyticsOverviewProps {
  data: AnalyticsOverviewData;
}

interface MetricConfig {
  labelKey: string;
  value: string;
  icon: typeof Brain;
  color: string;
  bgColor: string;
  trend: number;
  barSegments: number[];
  barColors: string[];
}

function MiniSparkBar({
  segments,
  colors,
}: {
  segments: number[];
  colors: string[];
}) {
  const maxVal = Math.max(...segments, 1);

  return (
    <div className="flex items-end gap-0.5 h-6 mt-2">
      {segments.map((val, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${colors[i % colors.length]} transition-all duration-300`}
          style={{ height: `${Math.max((val / maxVal) * 100, 8)}%` }}
        />
      ))}
    </div>
  );
}

function TrendIndicator({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">--</span>
    );
  }

  const isPositive = value > 0;

  return (
    <span
      className={`inline-flex items-center text-xs font-medium tabular-nums ${
        isPositive
          ? "text-green-600 dark:text-green-400"
          : "text-red-500 dark:text-red-400"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3 mr-0.5" />
      ) : (
        <TrendingDown className="h-3 w-3 mr-0.5" />
      )}
      {isPositive ? "+" : ""}
      {value}%
    </span>
  );
}

export default function AnalyticsOverview({ data }: AnalyticsOverviewProps) {
  const { t } = useTranslation();

  const totalSuggestions = data.totalCalls + data.totalChats;
  const adoptionRate =
    totalSuggestions > 0
      ? Math.round((data.aiSuggestionsUsed / totalSuggestions) * 100)
      : 0;

  const sentimentPercent = Math.round(data.avgSentiment * 100);

  const activeChannels =
    (data.totalCalls > 0 ? 1 : 0) + (data.totalChats > 0 ? 1 : 0);

  const metrics: MetricConfig[] = useMemo(
    () => [
      {
        labelKey: "analyticsOverview.aiAdoption",
        value: `${adoptionRate}%`,
        icon: Brain,
        color: "text-violet-500",
        bgColor: "bg-violet-500/10 dark:bg-violet-500/20",
        trend: adoptionRate > 50 ? 12 : adoptionRate > 30 ? 5 : -3,
        barSegments: [
          data.aiSuggestionsUsed,
          Math.max(totalSuggestions - data.aiSuggestionsUsed, 0),
        ],
        barColors: ["bg-violet-500", "bg-violet-500/20"],
      },
      {
        labelKey: "analyticsOverview.avgSentiment",
        value: `${sentimentPercent}%`,
        icon: Heart,
        color: "text-rose-500",
        bgColor: "bg-rose-500/10 dark:bg-rose-500/20",
        trend: sentimentPercent > 70 ? 8 : sentimentPercent > 50 ? 2 : -5,
        barSegments: [30, 55, 70, 85, sentimentPercent],
        barColors: [
          "bg-rose-300 dark:bg-rose-400/40",
          "bg-rose-400 dark:bg-rose-400/60",
          "bg-rose-400 dark:bg-rose-400/70",
          "bg-rose-500/80",
          "bg-rose-500",
        ],
      },
      {
        labelKey: "analyticsOverview.activeChannels",
        value: `${activeChannels}/2`,
        icon: Radio,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
        trend: activeChannels === 2 ? 100 : 0,
        barSegments: [data.totalCalls, data.totalChats],
        barColors: ["bg-blue-500", "bg-green-500"],
      },
      {
        labelKey: "analyticsOverview.conversionRate",
        value: `${data.conversionRate}%`,
        icon: Target,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
        trend:
          data.conversionRate > 20 ? 15 : data.conversionRate > 10 ? 4 : -2,
        barSegments: [10, 20, 35, 50, data.conversionRate],
        barColors: [
          "bg-emerald-300 dark:bg-emerald-400/40",
          "bg-emerald-400 dark:bg-emerald-400/60",
          "bg-emerald-400 dark:bg-emerald-400/70",
          "bg-emerald-500/80",
          "bg-emerald-500",
        ],
      },
    ],
    [
      adoptionRate,
      sentimentPercent,
      activeChannels,
      data.aiSuggestionsUsed,
      data.totalCalls,
      data.totalChats,
      data.conversionRate,
      totalSuggestions,
    ],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          {t("analyticsOverview.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.labelKey}
              className="rounded-lg border p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md ${metric.bgColor}`}
                >
                  <metric.icon className={`h-3.5 w-3.5 ${metric.color}`} />
                </div>
                <TrendIndicator value={metric.trend} />
              </div>
              <p className="text-xl font-bold tabular-nums mt-1.5">
                {metric.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(metric.labelKey)}
              </p>
              <MiniSparkBar
                segments={metric.barSegments}
                colors={metric.barColors}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
