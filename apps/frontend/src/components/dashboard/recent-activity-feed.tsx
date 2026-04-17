"use client";

import { useMemo } from "react";
import { Phone, MessageSquare, Brain, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n/use-translation";

type ActivityType = "call" | "chat" | "ai" | "billing";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
}

interface RecentActivityFeedProps {
  activities: Activity[];
}

const ACTIVITY_CONFIG: Record<
  ActivityType,
  {
    icon: typeof Phone;
    color: string;
    bgColor: string;
    lineColor: string;
  }
> = {
  call: {
    icon: Phone,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
    lineColor: "bg-blue-500/30",
  },
  chat: {
    icon: MessageSquare,
    color: "text-green-500",
    bgColor: "bg-green-500/10 dark:bg-green-500/20",
    lineColor: "bg-green-500/30",
  },
  ai: {
    icon: Brain,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10 dark:bg-violet-500/20",
    lineColor: "bg-violet-500/30",
  },
  billing: {
    icon: CreditCard,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
    lineColor: "bg-amber-500/30",
  },
};

function formatRelativeTime(date: Date, t: (key: string) => string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return t("activityFeed.justNow");
  }
  if (diffMin < 60) {
    return t("activityFeed.minutesAgo").replace("{{count}}", String(diffMin));
  }
  if (diffHour < 24) {
    return t("activityFeed.hoursAgo").replace("{{count}}", String(diffHour));
  }
  if (diffDay < 7) {
    return t("activityFeed.daysAgo").replace("{{count}}", String(diffDay));
  }

  return date.toLocaleDateString();
}

export default function RecentActivityFeed({
  activities,
}: RecentActivityFeedProps) {
  const { t } = useTranslation();

  const displayActivities = useMemo(() => activities.slice(0, 5), [activities]);

  if (displayActivities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {t("activityFeed.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
              <Phone className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("activityFeed.noActivity")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          {t("activityFeed.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {displayActivities.map((activity, index) => {
            const config = ACTIVITY_CONFIG[activity.type];
            const isLast = index === displayActivities.length - 1;
            const Icon = config.icon;

            return (
              <div
                key={activity.id}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                {/* Timeline line */}
                {!isLast && (
                  <div
                    className={`absolute left-[15px] top-8 bottom-0 w-px ${config.lineColor}`}
                  />
                )}

                {/* Icon */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bgColor}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight truncate">
                      {activity.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatRelativeTime(new Date(activity.timestamp), t)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {activity.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
