// src/components/dashboard/KPICard.tsx
// Fundamento: Clean Code - DRY (Don't Repeat Yourself)
// Responsabilidade: Card reutilizável para exibir métricas (KPIs)

'use client';

import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function KPICard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: KPICardProps) {
  return (
    <Card className={cn('transition-shadow hover:shadow-lg', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <div className="rounded-full bg-blue-50 p-2">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          {/* Main Value */}
          <div className="text-3xl font-bold text-gray-900">{value}</div>

          {/* Description or Trend */}
          <div className="flex items-center gap-2">
            {description && (
              <p className="text-sm text-gray-500">{description}</p>
            )}

            {trend && (
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  trend.isPositive
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-600'
                )}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
