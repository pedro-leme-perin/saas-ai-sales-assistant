'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { notificationsService } from '@/services/api';
import { logger } from '@/lib/logger';

interface NotificationsTabProps {
  t: (key: string) => string;
}

interface PreferencesState {
  emailCalls: boolean;
  emailMessages: boolean;
  pushSuggestions: boolean;
  emailReports: boolean;
  emailBilling: boolean;
}

export default function NotificationsTab({ t }: NotificationsTabProps) {
  const [preferences, setPreferences] = useState<PreferencesState>({
    emailCalls: true,
    emailMessages: true,
    pushSuggestions: true,
    emailReports: true,
    emailBilling: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const notificationItems = useMemo(
    () => [
      {
        id: 'emailCalls',
        titleKey: 'settings.notifications.missedCalls',
        descKey: 'settings.notifications.missedCallsDesc',
      },
      {
        id: 'emailMessages',
        titleKey: 'settings.notifications.newMessages',
        descKey: 'settings.notifications.newMessagesDesc',
      },
      {
        id: 'pushSuggestions',
        titleKey: 'settings.notifications.aiSuggestions',
        descKey: 'settings.notifications.aiSuggestionsDesc',
      },
      {
        id: 'emailReports',
        titleKey: 'settings.notifications.weeklyReports',
        descKey: 'settings.notifications.weeklyReportsDesc',
      },
      {
        id: 'emailBilling',
        titleKey: 'settings.notifications.billingUpdates',
        descKey: 'settings.notifications.billingUpdatesDesc',
      },
    ],
    []
  );

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const prefs = await notificationsService.getPreferences();
        setPreferences({
          emailCalls: prefs.emailCalls ?? true,
          emailMessages: prefs.emailMessages ?? true,
          pushSuggestions: prefs.pushSuggestions ?? true,
          emailReports: prefs.emailReports ?? true,
          emailBilling: prefs.emailBilling ?? true,
        });
      } catch (error) {
        logger.ui.error('Failed to load notification preferences', error);
        toast.error(t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [t]);

  // Handle toggle change - save immediately
  const handleToggle = async (key: keyof PreferencesState) => {
    const newValue = !preferences[key];
    const updatedPreferences = { ...preferences, [key]: newValue };

    setPreferences(updatedPreferences);
    setSaving(true);

    try {
      await notificationsService.updatePreferences(updatedPreferences);
      toast.success(t('common.saveChanges'));
    } catch (error) {
      logger.ui.error('Failed to update notification preferences', error);
      // Revert on error
      setPreferences(preferences);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.notifications.title')}</CardTitle>
          <CardDescription>{t('settings.notifications.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

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
              <input
                type="checkbox"
                className="sr-only peer"
                checked={preferences[item.id as keyof PreferencesState]}
                onChange={() => handleToggle(item.id as keyof PreferencesState)}
                disabled={saving}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-disabled:opacity-50"></div>
            </label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
