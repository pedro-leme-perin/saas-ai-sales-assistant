'use client';

import { useMemo } from 'react';
import { Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SentimentAnalyticsProps {
  sentimentData?: {
    avgSentiment?: number;
    distribution?: Array<{ label: string; count: number; percentage: number }>;
    weeklyTrend?: Array<{ week: string; avgSentiment: number }>;
  };
  t: (key: string, ...args: any[]) => string;
}

export default function SentimentAnalytics({
  sentimentData,
  t,
}: SentimentAnalyticsProps) {
  const memoizedDistribution = useMemo(
    () => sentimentData?.distribution ?? [],
    [sentimentData?.distribution]
  );

  const memoizedTrend = useMemo(
    () => sentimentData?.weeklyTrend ?? [],
    [sentimentData?.weeklyTrend]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-500" />
          <CardTitle className="text-base">{t('analytics.sentiment.title')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('analytics.sentiment.avgSentiment')}</span>
          <span className="text-lg font-bold tabular-nums">
            {((sentimentData?.avgSentiment ?? 0) * 100).toFixed(0)}%
          </span>
        </div>
        <div className="space-y-2">
          {memoizedDistribution.map((d) => (
            <div key={d.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span
                  className={
                    d.label === 'POSITIVE'
                      ? 'text-green-600'
                      : d.label === 'NEGATIVE'
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                  }
                >
                  {d.label === 'POSITIVE'
                    ? t('analytics.sentiment.positive')
                    : d.label === 'NEGATIVE'
                      ? t('analytics.sentiment.negative')
                      : t('analytics.sentiment.neutral')}
                </span>
                <span className="tabular-nums">
                  {d.count} ({d.percentage}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    d.label === 'POSITIVE'
                      ? 'bg-green-500'
                      : d.label === 'NEGATIVE'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                  }`}
                  style={{ width: `${d.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {memoizedTrend.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t('analytics.sentiment.weeklyTrend')}
            </p>
            <div className="flex gap-1 items-end h-12">
              {memoizedTrend.map((week, i) => (
                <div
                  key={i}
                  className="flex-1 bg-rose-500/20 rounded-t hover:bg-rose-500/40 transition-colors"
                  style={{ height: `${Math.max(week.avgSentiment * 100, 5)}%` }}
                  title={`${t('analytics.sentiment.weekLabel')} ${week.week}: ${(week.avgSentiment * 100).toFixed(0)}%`}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
