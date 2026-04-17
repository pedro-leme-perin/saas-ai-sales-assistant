"use client";

import { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Phone,
  MessageSquare,
  Clock,
  Sparkles,
  Users,
  BarChart3,
  Brain,
  Heart,
  Zap,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  analyticsService,
  type DashboardData,
  type AnalyticsCallsData,
  type AnalyticsWhatsAppData,
  type AnalyticsSentimentData,
  type AnalyticsAIPerformanceData,
} from "@/services/api";
import { formatDuration } from "@/lib/utils";
import { useTranslation } from "@/i18n/use-translation";

// Dynamically import heavy detail sections
const SentimentAnalytics = dynamic(
  () => import("@/components/dashboard/analytics/sentiment-analytics"),
  { ssr: false, loading: () => <AnalyticsDetailSkeleton /> },
);

const AIPerformanceDetail = dynamic(
  () => import("@/components/dashboard/analytics/ai-performance-detail"),
  { ssr: false, loading: () => <AnalyticsDetailSkeleton /> },
);

function KPISkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-20 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex justify-between">
                <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnalyticsDetailSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(5)].map((_, j) => (
          <div key={j} className="flex justify-between">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();

  const { data: dashboardRaw, isLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: () => analyticsService.getDashboard(),
  });

  const { data: callsData } = useQuery({
    queryKey: ["analytics-calls"],
    queryFn: () => analyticsService.getCalls(),
  });

  const { data: waData } = useQuery({
    queryKey: ["analytics-whatsapp"],
    queryFn: () => analyticsService.getWhatsApp(),
  });

  const { data: sentimentData } = useQuery({
    queryKey: ["analytics-sentiment"],
    queryFn: () => analyticsService.getSentiment(),
  });

  const { data: aiPerfData } = useQuery({
    queryKey: ["analytics-ai-performance"],
    queryFn: () => analyticsService.getAIPerformance(),
  });

  const dashboard = dashboardRaw;

  // Memoize KPI computation
  const kpis = useMemo(
    () => [
      {
        title: t("analytics.totalCalls"),
        value: dashboard?.calls?.total ?? 0,
        sub: `${dashboard?.calls?.thisMonth ?? 0} ${t("analytics.thisMonth")}`,
        growth: dashboard?.calls?.growth ?? 0,
        icon: Phone,
        color: "text-blue-500",
      },
      {
        title: t("analytics.whatsappChats"),
        value: dashboard?.chats?.total ?? 0,
        sub: `${dashboard?.chats?.thisMonth ?? 0} ${t("analytics.thisMonth")}`,
        growth: dashboard?.chats?.growth ?? 0,
        icon: MessageSquare,
        color: "text-green-500",
      },
      {
        title: t("analytics.avgDuration"),
        value: formatDuration(dashboard?.calls?.avgDuration ?? 0),
        sub: t("analytics.perCall"),
        growth: null,
        icon: Clock,
        color: "text-orange-500",
      },
      {
        title: t("analytics.users"),
        value: dashboard?.users?.total ?? 0,
        sub: t("analytics.onTeam"),
        growth: null,
        icon: Users,
        color: "text-purple-500",
      },
      {
        title: t("analytics.aiSuggestions"),
        value: dashboard?.ai?.total ?? 0,
        sub: `${dashboard?.ai?.used ?? 0} ${t("analytics.used")}`,
        growth: null,
        icon: Sparkles,
        color: "text-primary",
      },
      {
        title: t("analytics.aiAdoptionRate"),
        value: `${dashboard?.ai?.adoptionRate ?? 0}%`,
        sub: t("analytics.suggestionsAccepted"),
        growth: null,
        icon: BarChart3,
        color: "text-emerald-500",
      },
    ],
    [dashboard, t],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("analytics.title")}
        </h1>
        <p className="text-muted-foreground">{t("analytics.subtitle")}</p>
      </div>

      {isLoading ? (
        <>
          <KPISkeleton />
          <DetailSkeleton />
        </>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => (
              <Card
                key={kpi.title}
                className="hover:shadow-sm transition-shadow"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </CardTitle>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {kpi.growth !== null ? (
                      kpi.growth >= 0 ? (
                        <span className="flex items-center text-xs text-green-600">
                          <TrendingUp className="h-3 w-3 mr-1" />+{kpi.growth}%{" "}
                          {t("analytics.vsPreviousMonth")}
                        </span>
                      ) : (
                        <span className="flex items-center text-xs text-red-500">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          {kpi.growth}% {t("analytics.vsPreviousMonth")}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {kpi.sub}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-base">
                    {t("analytics.calls30d")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: t("analytics.total"), value: callsData?.total ?? 0 },
                  {
                    label: t("analytics.completed"),
                    value: callsData?.completed ?? 0,
                  },
                  {
                    label: t("analytics.successRate"),
                    value: `${callsData?.successRate ?? 0}%`,
                  },
                  {
                    label: t("analytics.avgDurationLabel"),
                    value: formatDuration(callsData?.avgDuration ?? 0),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium tabular-nums">
                      {item.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                  <CardTitle className="text-base">
                    {t("analytics.whatsapp30d")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    label: t("analytics.newChats"),
                    value: waData?.totalChats ?? 0,
                  },
                  {
                    label: t("analytics.openChats"),
                    value: waData?.openChats ?? 0,
                  },
                  {
                    label: t("analytics.messagesExchanged"),
                    value: waData?.messages ?? 0,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium tabular-nums">
                      {item.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* AI Performance Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">
                  {t("analytics.aiPerformanceTitle")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <p className="text-3xl font-bold text-primary">
                    {dashboard?.ai?.total ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("analytics.suggestionsGenerated")}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-500/5 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">
                    {dashboard?.ai?.used ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("analytics.suggestionsUsed")}
                  </p>
                </div>
                <div className="text-center p-4 bg-amber-500/5 rounded-lg">
                  <p className="text-3xl font-bold text-amber-600">
                    {dashboard?.ai?.adoptionRate ?? 0}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("analytics.adoptionRate")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sentiment & AI Detail Row - Lazy loaded */}
          <div className="grid gap-4 md:grid-cols-2">
            <Suspense fallback={<AnalyticsDetailSkeleton />}>
              <SentimentAnalytics sentimentData={sentimentData} t={t} />
            </Suspense>
            <Suspense fallback={<AnalyticsDetailSkeleton />}>
              <AIPerformanceDetail aiPerfData={aiPerfData} t={t} />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}
