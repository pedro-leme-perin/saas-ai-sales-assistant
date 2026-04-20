"use client";

// =============================================
// 📡 API REQUEST LOGS PAGE (Session 52)
// =============================================
// Visualization for the per-tenant API request audit trail.
// - Metrics card (totalRequests / errorRate / p50-p95 / top paths / status dist)
// - Filterable cursor-paginated log table with method/path/status/latency.

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Activity,
  Gauge,
  AlertCircle,
  Clock,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  apiRequestLogsService,
  type ApiRequestLogsFilters,
  type ApiRequestLogItem,
} from "@/services/api-request-logs.service";

function latencyColor(ms: number): string {
  if (ms < 300) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 1000) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function statusColor(code: number): string {
  if (code >= 500) return "bg-red-500/10 text-red-700 dark:text-red-300";
  if (code >= 400) return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (code >= 300) return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

export default function ApiLogsPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ApiRequestLogsFilters>({ limit: 50 });

  const metricsQuery = useQuery({
    queryKey: ["api-request-logs", "metrics"],
    queryFn: () => apiRequestLogsService.metrics(),
    refetchInterval: 30_000,
  });

  const listQuery = useQuery({
    queryKey: ["api-request-logs", "list", filters],
    queryFn: () => apiRequestLogsService.list(filters),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/settings">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {t("apiLogs.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("apiLogs.subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid md:grid-cols-4 gap-3">
        <MetricCard
          icon={<Gauge className="w-4 h-4" />}
          label={t("apiLogs.metrics.totalRequests")}
          value={metricsQuery.data?.totalRequests ?? "—"}
        />
        <MetricCard
          icon={<AlertCircle className="w-4 h-4" />}
          label={t("apiLogs.metrics.errorRate")}
          value={metricsQuery.data ? `${metricsQuery.data.errorRate}%` : "—"}
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label={t("apiLogs.metrics.p50")}
          value={metricsQuery.data ? `${metricsQuery.data.p50LatencyMs} ms` : "—"}
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label={t("apiLogs.metrics.p95")}
          value={metricsQuery.data ? `${metricsQuery.data.p95LatencyMs} ms` : "—"}
        />
      </div>

      {/* Top paths + Status distribution */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("apiLogs.topPaths")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metricsQuery.data?.topPaths.length ? (
              metricsQuery.data.topPaths.map((p) => (
                <div
                  key={p.path}
                  className="flex items-center justify-between text-xs border-b last:border-b-0 py-1.5"
                >
                  <span className="font-mono truncate max-w-xs">{p.path}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {p.count} · {p.avgLatencyMs} ms
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">{t("apiLogs.empty")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("apiLogs.statusDistribution")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metricsQuery.data?.statusDistribution.length ? (
              metricsQuery.data.statusDistribution.map((s) => (
                <div
                  key={s.bucket}
                  className="flex items-center justify-between text-xs border-b last:border-b-0 py-1.5"
                >
                  <span className="font-mono">{s.bucket}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">{t("apiLogs.empty")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              {t("apiLogs.filters")}
            </div>
            <input
              type="text"
              placeholder={t("apiLogs.filter.path")}
              className="h-9 px-3 rounded border bg-background text-sm"
              value={filters.path ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  path: e.target.value || undefined,
                  cursor: undefined,
                }))
              }
            />
            <select
              className="h-9 px-3 rounded border bg-background text-sm"
              value={filters.method ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  method: e.target.value || undefined,
                  cursor: undefined,
                }))
              }
            >
              <option value="">{t("apiLogs.filter.method")}</option>
              {["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder={t("apiLogs.filter.statusCode")}
              min={100}
              max={599}
              className="h-9 px-3 rounded border bg-background text-sm w-32"
              value={filters.statusCode ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  statusCode: e.target.value ? Number(e.target.value) : undefined,
                  cursor: undefined,
                }))
              }
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ limit: 50 })}
            >
              {t("apiLogs.filter.reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">
                  {t("apiLogs.col.method")}
                </th>
                <th className="text-left py-2 px-3 font-medium">
                  {t("apiLogs.col.path")}
                </th>
                <th className="text-left py-2 px-3 font-medium">
                  {t("apiLogs.col.status")}
                </th>
                <th className="text-left py-2 px-3 font-medium">
                  {t("apiLogs.col.latency")}
                </th>
                <th className="text-left py-2 px-3 font-medium">
                  {t("apiLogs.col.createdAt")}
                </th>
              </tr>
            </thead>
            <tbody>
              {listQuery.data?.items.length ? (
                listQuery.data.items.map((r: ApiRequestLogItem) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2 px-3 font-mono">{r.method}</td>
                    <td className="py-2 px-3 font-mono truncate max-w-md">
                      {r.path}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${statusColor(r.statusCode)}`}
                      >
                        {r.statusCode}
                      </span>
                    </td>
                    <td className={`py-2 px-3 font-medium ${latencyColor(r.latencyMs)}`}>
                      {r.latencyMs} ms
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("apiLogs.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {listQuery.data?.nextCursor ? (
            <div className="p-3 border-t flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters((f) => ({ ...f, cursor: listQuery.data?.nextCursor ?? undefined }))
                }
              >
                {t("apiLogs.loadMore")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
