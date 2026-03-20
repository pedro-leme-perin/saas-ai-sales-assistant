'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface NotificationsTabProps {
  t: (key: string) => string;
}

export default function NotificationsTab({ t }: NotificationsTabProps) {
  const notificationItems = useMemo(
    () => [
      {
        id: 'email_calls',
        titleKey: 'settings.notifications.missedCalls',
        descKey: 'settings.notifications.missedCallsDesc',
      },
      {
        id: 'email_messages',
        titleKey: 'settings.notifications.newMessages',
        descKey: 'settings.notifications.newMessagesDesc',
      },
      {
        id: 'push_suggestions',
        titleKey: 'settings.notifications.aiSuggestions',
        descKey: 'settings.notifications.aiSuggestionsDesc',
      },
      {
        id: 'email_reports',
        titleKey: 'settings.notifications.weeklyReports',
        descKey: 'settings.notifications.weeklyReportsDesc',
      },
      {
        id: 'email_billing',
        titleKey: 'settings.notifications.billingUpdates',
        descKey: 'settings.notifications.billingUpdatesDesc',
      },
    ],
    []
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.notifications.title')}</CardTitle>
        <CardDescription>{t('settings.notifications.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notificationItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">{t(item.titleKey)}</p>
              <p className="text-sm text-muted-foreground">{t(item.descKey)}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
