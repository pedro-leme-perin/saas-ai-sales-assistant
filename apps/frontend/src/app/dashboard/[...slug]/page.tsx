"use client";

import Link from "next/link";
import { Sparkles, Home } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

export default function DashboardCatchAll() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <p className="text-5xl font-bold text-primary mb-2">404</p>
        <h2 className="text-lg font-semibold mb-2">
          {t("errors.pageNotFound")}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("errors.pageNotFoundDesc")}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" /> {t("errors.goToDashboard")}
        </Link>
      </div>
    </div>
  );
}
