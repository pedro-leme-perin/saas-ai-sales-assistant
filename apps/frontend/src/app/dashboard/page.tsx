"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  MessageSquare,
  Sparkles,
  TrendingUp,
  TrendingDown,
  PhoneMissed,
  Clock,
  Users,
  ArrowRight,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  callsService,
  companiesService,
  analyticsService,
  type DashboardData,
} from "@/services/api";
import {
  formatDuration,
  formatDateTime,
  formatPhone,
  getCallStatusColor,
} from "@/lib/utils";
import type { Call } from "@/types";
import Link from "next/link";
import { useTranslation } from "@/i18n/use-translation";

function KPISkeleton() {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-28 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-48 bg-muted rounded animate-pulse mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, j) => (
              <div
                key={j}
                className="h-10 w-full bg-muted rounded animate-pulse"
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentCallsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border animate-pulse"
        >
          <div className="h-9 w-9 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
          <div className="space-y-1.5 text-right">
            <div className="h-4 w-12 bg-muted rounded ml-auto" />
            <div className="h-3 w-16 bg-muted rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const { t } = useTranslation();

  const { data: callStats, isLoading: statsLoading } = useQuery({
    queryKey: ["call-stats"],
    queryFn: () => callsService.getStats(),
  });

  const { data: recentCalls, isLoading: callsLoading } = useQuery({
    queryKey: ["calls-recent"],
    queryFn: () => callsService.getAll({ limit: 5 }),
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["company-usage"],
    queryFn: () => companiesService.getUsage(),
  });

  const { data: dashboardRaw, isLoading: dashLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: () => analyticsService.getDashboard(),
  });

  const dashboard = dashboardRaw as DashboardData | undefined;
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("greeting.morning")
      : hour < 18
        ? t("greeting.afternoon")
        : t("greeting.evening");
  const isLoading = statsLoading || dashLoading;

  const getStatusLabel = (status: string) => {
    if (status === "COMPLETED") return t("dashboard.statusCompleted");
    if (status === "MISSED") return t("dashboard.statusMissed");
    return t("dashboard.statusInProgress");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {greeting}, {user?.firstName || t("common.user")}
        </h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <KPISkeleton />
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.totalCalls")}
              </CardTitle>
              <Phone className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{callStats?.total || 0}</div>
              {(dashboard?.calls?.growth ?? 0) >= 0 ? (
                <div className="flex items-center text-xs text-green-600 mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />+
                  {dashboard?.calls?.growth ?? 0}% {t("dashboard.thisMonth")}
                </div>
              ) : (
                <div className="flex items-center text-xs text-red-500 mt-1">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {dashboard?.calls?.growth ?? 0}% {t("dashboard.thisMonth")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.whatsappChats")}
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard?.chats?.total || 0}
              </div>
              {(dashboard?.chats?.growth ?? 0) >= 0 ? (
                <div className="flex items-center text-xs text-green-600 mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />+
                  {dashboard?.chats?.growth ?? 0}% {t("dashboard.thisMonth")}
                </div>
              ) : (
                <div className="flex items-center text-xs text-red-500 mt-1">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {dashboard?.chats?.growth ?? 0}% {t("dashboard.thisMonth")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.missedCalls")}
              </CardTitle>
              <PhoneMissed className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {callStats?.byStatus?.MISSED || 0}
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <Activity className="h-3 w-3 mr-1" />
                {t("dashboard.requiresAttention")}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.avgDuration")}
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDuration(callStats?.avgDuration || 0)}
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <Activity className="h-3 w-3 mr-1" />
                {t("dashboard.perCall")}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Middle Row */}
      {isLoading || usageLoading ? (
        <CardsSkeleton />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* AI Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>{t("dashboard.aiAssistant")}</CardTitle>
              </div>
              <CardDescription>{t("dashboard.aiPerformance")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {dashboard?.ai?.total || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.suggestionsGenerated")}
                  </p>
                </div>
                <div className="bg-background rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {dashboard?.ai?.adoptionRate || 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.adoptionRate")}
                  </p>
                </div>
              </div>
              <Link href="/dashboard/analytics">
                <Button variant="outline" className="w-full" size="sm">
                  {t("dashboard.viewAnalytics")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Usage Card */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>{t("dashboard.planUsage")}</CardTitle>
              <CardDescription>
                {t("dashboard.plan")} {usage?.plan || "Starter"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  labelKey: "dashboard.users",
                  icon: Users,
                  used: usage?.users?.used,
                  limit: usage?.users?.limit,
                  pct: usage?.users?.percentage,
                  color: "bg-primary",
                },
                {
                  labelKey: "nav.calls",
                  icon: Phone,
                  used: usage?.calls?.used,
                  limit: usage?.calls?.limit,
                  pct: usage?.calls?.percentage,
                  color: "bg-blue-500",
                },
                {
                  labelKey: "whatsapp.conversations",
                  icon: MessageSquare,
                  used: usage?.chats?.used,
                  limit: usage?.chats?.limit,
                  pct: usage?.chats?.percentage,
                  color: "bg-green-500",
                },
              ].map((item) => (
                <div key={item.labelKey}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-1">
                      <item.icon className="h-3 w-3" /> {t(item.labelKey)}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {item.used || 0} / {item.limit || 0}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all`}
                      style={{ width: `${Math.min(item.pct || 0, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <Link href="/dashboard/billing">
                <Button variant="outline" className="w-full" size="sm">
                  {t("dashboard.managePlan")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle>{t("dashboard.quickAccess")}</CardTitle>
              <CardDescription>
                {t("dashboard.quickAccessDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                {
                  href: "/dashboard/calls",
                  labelKey: "dashboard.newCallWithAI",
                  icon: Phone,
                  color: "text-blue-500",
                },
                {
                  href: "/dashboard/whatsapp",
                  labelKey: "dashboard.openWhatsApp",
                  icon: MessageSquare,
                  color: "text-green-500",
                },
                {
                  href: "/dashboard/analytics",
                  labelKey: "dashboard.viewReports",
                  icon: TrendingUp,
                  color: "text-purple-500",
                },
                {
                  href: "/dashboard/team",
                  labelKey: "dashboard.manageTeam",
                  icon: Users,
                  color: "text-orange-500",
                },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    size="sm"
                  >
                    <item.icon className={`mr-2 h-4 w-4 ${item.color}`} />
                    {t(item.labelKey)}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Calls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("dashboard.recentCalls")}</CardTitle>
            <CardDescription>{t("dashboard.recentCallsDesc")}</CardDescription>
          </div>
          <Link href="/dashboard/calls">
            <Button variant="outline" size="sm">
              {t("common.viewAll")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {callsLoading ? (
            <RecentCallsSkeleton />
          ) : recentCalls?.data && recentCalls.data.length > 0 ? (
            <div className="space-y-2">
              {recentCalls.data.map((call: Call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {call.contactName || formatPhone(call.phoneNumber)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(call.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono tabular-nums">
                      {formatDuration(call.duration)}
                    </p>
                    <p className={`text-xs ${getCallStatusColor(call.status)}`}>
                      {getStatusLabel(call.status)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="h-12 w-12 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noCallsYet")}
              </p>
              <Link href="/dashboard/calls" className="mt-3">
                <Button size="sm">{t("dashboard.makeFirstCall")}</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
