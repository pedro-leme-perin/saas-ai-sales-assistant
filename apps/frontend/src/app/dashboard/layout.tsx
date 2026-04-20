'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/utils';
import {
  LayoutDashboard, Phone, MessageSquare, BarChart3,
  Users, CreditCard, Settings, Menu, X, Sparkles, Trophy,
  Bell, ChevronLeft, Moon, Sun, Check, Contact as ContactIcon, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/index';
import { PageTransition } from '@/components/ui/page-transition';
import { AnnouncementBanner } from '@/components/announcements/announcement-banner';
import { useNotificationsStore, useUIStore } from '@/stores';
import { useTranslation } from '@/i18n/use-translation';

const navigationKeys = [
  { key: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'nav.calls', href: '/dashboard/calls', icon: Phone },
  { key: 'nav.whatsapp', href: '/dashboard/whatsapp', icon: MessageSquare },
  { key: 'nav.analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { key: 'nav.coaching', href: '/dashboard/coaching', icon: Sparkles },
  { key: 'nav.goals', href: '/dashboard/goals', icon: Trophy },
  { key: 'nav.contacts', href: '/dashboard/contacts', icon: ContactIcon },
  { key: 'nav.csat', href: '/dashboard/csat', icon: Star },
  { key: 'nav.team', href: '/dashboard/team', icon: Users },
  { key: 'nav.billing', href: '/dashboard/billing', icon: CreditCard },
  { key: 'nav.settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user } = useUser();
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotificationsStore();
  const { theme, setTheme } = useUIStore();
  const { t } = useTranslation();

  const recentNotifications = notifications.slice(0, 5);

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('dark');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        {t('accessibility.skipToContent')}
      </a>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label={t('accessibility.sidebar')}
        role="navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="font-bold text-sidebar-foreground">TheIAdvisor</span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? t('accessibility.expandMenu') : t('accessibility.collapseMenu')}
            className="hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('accessibility.closeMenu')}
            className="lg:hidden text-sidebar-foreground h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <ul className="space-y-1">
            {navigationKeys.map((item) => {
              const name = t(item.key);
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                    aria-label={collapsed ? name : undefined}
                    title={collapsed ? name : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-3">
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: { avatarBox: 'h-8 w-8' },
              }}
            />
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('flex flex-col transition-all duration-300', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('accessibility.openMenu')}
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb / Page title */}
          <div className="flex-1">
            <p className="text-sm text-muted-foreground hidden sm:block">
              {navigationKeys.find((n) =>
                n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href)
              )
                ? t(navigationKeys.find((n) =>
                    n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href)
                  )!.key)
                : t('nav.dashboard')}
            </p>
          </div>

          {/* Theme Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')} className="h-9 w-9">
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label={unreadCount > 0 ? t('accessibility.notificationsCount', { count: unreadCount }) : t('notifications.title')}
              aria-expanded={showNotifications}
              className="relative h-9 w-9"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Notification Panel */}
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 rounded-xl border bg-popover shadow-lg animate-slide-in-bottom">
                  <div className="flex items-center justify-between p-4 pb-2">
                    <h3 className="font-semibold text-sm">{t('notifications.title')}</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('notifications.markAllRead')}
                      </button>
                    )}
                  </div>
                  <Separator />
                  {recentNotifications.length > 0 ? (
                    <div className="max-h-80 overflow-auto p-2 space-y-1">
                      {recentNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            'flex items-start gap-3 rounded-lg p-2.5 transition-colors cursor-pointer hover:bg-muted',
                            !notification.isRead && 'bg-primary/5'
                          )}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{notification.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{formatRelative(notification.createdAt)}</p>
                          </div>
                          {!notification.isRead && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{t('notifications.noNotifications')}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* User button (mobile) */}
          <div className="lg:hidden">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4">
          <AnnouncementBanner />
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
