'use client';

import { useMemo } from 'react';
import { Brain, Zap, Activity, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AIPerformanceDetailProps {
  aiPerfData?: {
    helpfulRate?: number;
    avgLatency?: number;
    p95Latency?: number;
    avgConfidence?: number;
    byProvider?: Array<{
      provider: string;
      count: number;
      avgLatency: number;
    }>;
  };
  t: (key: string, ...args: any[]) => string;
}

export default function AIPerformanceDetail({
  aiPerfData,
  t,
}: AIPerformanceDetailProps) {
  const metrics = useMemo(
    () => [
      {
        label: t('analytics.aiDetail.approvalRate'),
        value: `${aiPerfData?.helpfulRate ?? 0}%`,
        icon: Zap,
      },
      {
        label: t('analytics.aiDetail.avgLatency'),
        value: `${aiPerfData?.avgLatency ?? 0}ms`,
        icon: Activity,
      },
      {
        label: t('analytics.aiDetail.p95Latency'),
        value: `${aiPerfData?.p95Latency ?? 0}ms`,
        icon: Activity,
      },
      {
        label: t('analytics.aiDetail.avgConfidence'),
        value: `${((aiPerfData?.avgConfidence ?? 0) * 100).toFixed(0)}%`,
        icon: Sparkles,
      },
    ],
    [aiPerfData, t]
  );

  const memoizedProviders = useMemo(
    () => Array.isArray(aiPerfData?.byProvider) ? aiPerfData.byProvider : [],
    [aiPerfData?.byProvider]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          <CardTitle className="text-base">{t('analytics.aiDetail.title')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((item) => (
          <div key={item.label} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <item.icon className="h-3 w-3" />
              {item.label}
            </span>
            <span className="font-medium tabular-nums">{item.value}</span>
          </div>
        ))}
        {memoizedProviders.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t('analytics.aiDetail.byProvider')}
            </p>
            <div className="space-y-2">
              {memoizedProviders.map((p) => (
                <div key={p.provider} className="flex justify-between text-xs">
                  <span>
                    {t(
                      `analytics.aiDetail.providers.${p.provider}` as Parameters<typeof t>[0]
                    ) || p.provider}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {p.count} {t('analytics.aiDetail.calls')}, {p.avgLatency}ms{' '}
                    {t('analytics.aiDetail.avgLabel')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
