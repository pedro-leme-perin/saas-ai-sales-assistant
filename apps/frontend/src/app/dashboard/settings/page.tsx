"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  User,
  Building,
  Bell,
  Shield,
  Palette,
  Webhook,
  FileText,
  Tags,
  Key,
  BellRing,
  Cog,
  Timer,
  Download,
  Archive,
  Activity,
  Flag,
  Megaphone,
  Upload,
  Users,
  Database,
  Gauge,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { companiesService } from "@/services/api";
import { useUIStore } from "@/stores";
import { useTranslation } from "@/i18n/use-translation";
import { toast } from "sonner";

// Dynamically import heavy form sections
const ProfileTab = dynamic(
  () => import("@/components/settings/tabs/profile-tab"),
  { ssr: false, loading: () => <TabSkeleton /> },
);

const CompanyTab = dynamic(
  () => import("@/components/settings/tabs/company-tab"),
  { ssr: false, loading: () => <TabSkeleton /> },
);

const NotificationsTab = dynamic(
  () => import("@/components/settings/tabs/notifications-tab"),
  { ssr: false, loading: () => <TabSkeleton /> },
);

const SecurityTab = dynamic(
  () => import("@/components/settings/tabs/security-tab"),
  { ssr: false, loading: () => <TabSkeleton /> },
);

const AppearanceTab = dynamic(
  () => import("@/components/settings/tabs/appearance-tab"),
  { ssr: false, loading: () => <TabSkeleton /> },
);

function TabSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-10 w-full bg-muted rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type Tab = "profile" | "company" | "notifications" | "security" | "appearance";

export default function SettingsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const { theme, setTheme, locale, setLocale } = useUIStore();
  const { t } = useTranslation();

  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: () => companiesService.getCurrent(),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      companiesService.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success(t("common.saveChanges"));
    },
    onError: () => {
      toast.error(t("common.error"));
    },
  });

  const tabs: { id: Tab; labelKey: string; icon: typeof User }[] = useMemo(
    () => [
      { id: "profile", labelKey: "settings.tabs.profile", icon: User },
      { id: "company", labelKey: "settings.tabs.company", icon: Building },
      {
        id: "notifications",
        labelKey: "settings.tabs.notifications",
        icon: Bell,
      },
      { id: "security", labelKey: "settings.tabs.security", icon: Shield },
      { id: "appearance", labelKey: "settings.tabs.appearance", icon: Palette },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
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
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
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
          {activeTab === "profile" && <ProfileTab user={user} t={t} />}

          {/* Company Tab */}
          {activeTab === "company" && (
            <CompanyTab
              company={company}
              updateMutation={updateCompanyMutation}
              t={t}
            />
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && <NotificationsTab t={t} />}

          {/* Security Tab */}
          {activeTab === "security" && <SecurityTab t={t} />}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <AppearanceTab
              theme={theme}
              setTheme={setTheme}
              locale={locale}
              setLocale={setLocale}
              t={t}
            />
          )}

          {/* Session 46 — Advanced integrations links */}
          <div className="grid md:grid-cols-2 gap-3">
            <Link
              href="/dashboard/settings/webhooks"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Webhook className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("webhooks.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("webhooks.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/templates"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("templates.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("templates.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/tags"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Tags className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("tags.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("tags.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/api-keys"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Key className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("apiKeys.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("apiKeys.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/notification-prefs"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <BellRing className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("notificationPrefs.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("notificationPrefs.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/jobs"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Cog className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("jobs.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("jobs.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/sla"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Timer className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("sla.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("sla.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/exports"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Download className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("exports.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("exports.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/retention"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Archive className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("retention.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("retention.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/api-logs"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Activity className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("apiLogs.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("apiLogs.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/feature-flags"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Flag className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("featureFlags.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("featureFlags.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/announcements"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Megaphone className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("announcements.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("announcements.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/contacts/import"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Upload className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("dataImport.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("dataImport.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/assignment-rules"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Users className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("assignmentRules.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("assignmentRules.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/custom-fields"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Database className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("customFields.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("customFields.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
            <Link
              href="/dashboard/settings/usage-quotas"
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <Gauge className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t("usageQuotas.title")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("usageQuotas.subtitle")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
