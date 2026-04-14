'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);

    // Capture error in Sentry for monitoring
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: {
          digest: error.digest,
        },
      });
    }
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Algo deu errado</h1>
        <p className="text-muted-foreground mb-2">
          Ocorreu um erro inesperado. Nossa equipe já foi notificada.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mb-6 font-mono">
            Código: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            aria-label="Tentar novamente"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
          </button>
          <Link href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Home className="h-4 w-4" /> Ir para Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
