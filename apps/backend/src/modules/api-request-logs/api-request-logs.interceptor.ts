// =============================================
// 🎯 ApiRequestLogsInterceptor (Session 52)
// =============================================
// Global interceptor that captures API requests non-blockingly.
// Skips:
//   - internal /health endpoints (not tenant-scoped)
//   - webhook endpoints (already audited via their own trails)
//   - requests without a resolved companyId (unauthenticated / landing)

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import type { Request, Response } from 'express';
import { ApiRequestLogsService } from './api-request-logs.service';

const SKIP_PATH_PREFIXES = ['/health', '/metrics', '/webhooks/'];

@Injectable()
export class ApiRequestLogsInterceptor implements NestInterceptor {
  constructor(private readonly logs: ApiRequestLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context
      .switchToHttp()
      .getRequest<
        Request & { companyId?: string; apiKey?: { id: string }; user?: { id?: string } }
      >();
    const res = context.switchToHttp().getResponse<Response>();
    const path = (req.route?.path as string) || req.path || req.url || '';
    if (SKIP_PATH_PREFIXES.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    const started = Date.now();

    const persist = (statusCode: number): void => {
      const companyId = req.companyId;
      if (!companyId) return;
      this.logs.enqueue({
        companyId,
        apiKeyId: req.apiKey?.id ?? null,
        userId: req.user?.id ?? null,
        method: req.method,
        path,
        statusCode,
        latencyMs: Date.now() - started,
        requestId: (req.headers['x-request-id'] as string | undefined) ?? null,
        ipAddress:
          ((req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
            req.ip) ||
          null,
        userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
        createdAt: new Date(),
      });
    };

    return next.handle().pipe(
      tap(() => persist(res.statusCode ?? 200)),
      catchError((err: { status?: number; statusCode?: number }) => {
        persist(err?.status ?? err?.statusCode ?? 500);
        return throwError(() => err);
      }),
    );
  }
}
