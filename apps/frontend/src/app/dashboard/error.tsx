"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { useTranslation } from "@/i18n/use-translation";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    logger.ui.error("Dashboard error boundary triggered", error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">
            {t("errors.somethingWentWrong")}
          </h2>
          <p className="text-sm text-muted-foreground mb-1">
            {t("errors.unexpectedDashboardError")}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mb-4 font-mono">
              {t("errors.errorCode")}: {error.digest}
            </p>
          )}
          <Button onClick={reset} className="gap-2 mt-2">
            <RefreshCw className="h-4 w-4" /> {t("errors.tryAgain")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
