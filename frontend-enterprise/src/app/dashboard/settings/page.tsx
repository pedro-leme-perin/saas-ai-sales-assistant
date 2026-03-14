'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  User,
  Building,
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  Save,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { companiesService } from '@/services/api';
import { useUIStore } from '@/stores';
import { useTranslation } from '@/i18n/use-translation';

type Tab = 'profile' | 'company' | 'notifications' | 'security' | 'appearance';

export default function SettingsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const { theme, setTheme, locale, setLocale } = useUIStore();
  const { t } = useTranslation();

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companiesService.getCurrent(),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (data: any) => companiesService.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });

  const tabs: { id: Tab; labelKey: string; icon: typeof User }[] = [
    { id: 'profile', labelKey: 'settings.tabs.profile', icon: User },
    { id: 'company', labelKey: 'settings.tabs.company', icon: Building },
    { id: 'notifications', labelKey: 'settings.tabs.notifications', icon: Bell },
    { id: 'security', labelKey: 'settings.tabs.security', icon: Shield },
    { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: Palette },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <Card className="lg:w-64 flex-shrink-0">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {t(tab.labelKey)}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.profile.title')}</CardTitle>
                <CardDescription>{t('settings.profile.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-medium">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('settings.profile.firstName')}</label>
                    <input
                      type="text"
                      defaultValue={user?.firstName || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('settings.profile.lastName')}</label>
                    <input
                      type="text"
                      defaultValue={user?.lastName || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">{t('settings.profile.email')}</label>
                    <input
                      type="email"
                      defaultValue={user?.primaryEmailAddress?.emailAddress || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('settings.profile.emailHint')}
                    </p>
                  </div>
                </div>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  {t('common.saveChanges')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.company.title')}</CardTitle>
                <CardDescription>{t('settings.company.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('settings.company.name')}</label>
                    <input
                      type="text"
                      defaultValue={company?.name || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('settings.company.slug')}</label>
                    <input
                      type="text"
                      defaultValue={company?.slug || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('settings.company.website')}</label>
                    <input
                      type="url"
                      defaultValue={company?.website || ''}
                      placeholder={t('settings.company.websitePlaceholder')}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('settings.company.industry')}</label>
                    <select
                      defaultValue={company?.industry || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    >
                      <option value="">{t('settings.company.industryPlaceholder')}</option>
                      <option value="technology">{t('settings.company.industries.technology')}</option>
                      <option value="retail">{t('settings.company.industries.retail')}</option>
                      <option value="services">{t('settings.company.industries.services')}</option>
                      <option value="healthcare">{t('settings.company.industries.healthcare')}</option>
                      <option value="finance">{t('settings.company.industries.finance')}</option>
                      <option value="education">{t('settings.company.industries.education')}</option>
                      <option value="other">{t('settings.company.industries.other')}</option>
                    </select>
                  </div>
                </div>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  {t('common.saveChanges')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.notifications.title')}</CardTitle>
                <CardDescription>{t('settings.notifications.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'email_calls', titleKey: 'settings.notifications.missedCalls', descKey: 'settings.notifications.missedCallsDesc' },
                  { id: 'email_messages', titleKey: 'settings.notifications.newMessages', descKey: 'settings.notifications.newMessagesDesc' },
                  { id: 'push_suggestions', titleKey: 'settings.notifications.aiSuggestions', descKey: 'settings.notifications.aiSuggestionsDesc' },
                  { id: 'email_reports', titleKey: 'settings.notifications.weeklyReports', descKey: 'settings.notifications.weeklyReportsDesc' },
                  { id: 'email_billing', titleKey: 'settings.notifications.billingUpdates', descKey: 'settings.notifications.billingUpdatesDesc' },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
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
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.security.authentication')}</CardTitle>
                  <CardDescription>{t('settings.security.authSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Key className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{t('settings.security.twoFactor')}</p>
                        <p className="text-sm text-muted-foreground">{t('settings.security.twoFactorDesc')}</p>
                      </div>
                    </div>
                    <Button variant="outline">{t('common.configure')}</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{t('settings.security.activeSessions')}</p>
                        <p className="text-sm text-muted-foreground">{t('settings.security.activeSessionsDesc')}</p>
                      </div>
                    </div>
                    <Button variant="outline">{t('common.viewSessions')}</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.security.apiKeys')}</CardTitle>
                  <CardDescription>{t('settings.security.apiKeysDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div>
                      <p className="font-mono text-sm">sk_live_••••••••••••••••</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('settings.security.createdAt', { date: '01/01/2026' })}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">{t('common.regenerate')}</Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.appearance.title')}</CardTitle>
                <CardDescription>{t('settings.appearance.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block">{t('settings.appearance.theme')}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', labelKey: 'settings.appearance.themeLight', icon: Sun },
                      { id: 'dark', labelKey: 'settings.appearance.themeDark', icon: Moon },
                      { id: 'system', labelKey: 'settings.appearance.themeSystem', icon: Monitor },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setTheme(item.id as 'light' | 'dark' | 'system')}
                        className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors ${
                          theme === item.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <item.icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{t(item.labelKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">{t('settings.appearance.language')}</label>
                  <select
                    className="w-full px-4 py-2 border rounded-lg bg-background"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as 'pt-BR' | 'en')}
                  >
                    <option value="pt-BR">Portugu&ecirc;s (Brasil)</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">{t('settings.appearance.timezone')}</label>
                  <select className="w-full px-4 py-2 border rounded-lg bg-background">
                    <option value="America/Sao_Paulo">{t('settings.appearance.timezones.saoPaulo')}</option>
                    <option value="America/New_York">{t('settings.appearance.timezones.newYork')}</option>
                    <option value="Europe/London">{t('settings.appearance.timezones.london')}</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
