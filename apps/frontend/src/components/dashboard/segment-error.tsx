"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";

interface SegmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  segment: string;
  title: string;
  description: string;
}

/**
 * Reusable error boundary component for dashboard segments.
 * Each segment renders its own error UI, preventing a single
 * failure from crashing the entire dashboard (Release It! — Bulkheads).
 */
export function SegmentError({
  error,
  reset,
  segment,
  title,
  description,
}: SegmentErrorProps) {
  useEffect(() => {
    logger.ui.error(`[${segment}] Error boundary triggered`, error, {
      digest: error.digest,
    });
  }, [error, segment]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 mx-auto mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h2 className="text-base font-semibold mb-1">{title}</h2>
          <p className="text-sm text-muted-foreground mb-1">{description}</p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mb-3 font-mono">
              ID: {error.digest}
            </p>
          )}
          <Button
            onClick={reset}
            variant="outline"
            size="sm"
            className="gap-2 mt-1"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}