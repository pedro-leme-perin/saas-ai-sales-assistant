// =============================================
// 📝 LOGGING INTERCEPTOR
// =============================================
// Request/Response logging with OpenTelemetry trace correlation
// =============================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { TelemetryService } from '../../infrastructure/telemetry/telemetry.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(@Optional() private readonly telemetry?: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const requestId = request.headers['x-request-id'] || uuidv4();
    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    const { method, url, user } = request;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip || request.connection.remoteAddress;

    // Get trace context for log correlation (SRE — Distributed Tracing)
    const traceCtx = this.telemetry?.getTraceContext();

    const startTime = Date.now();

    // Log request with trace correlation
    this.logger.log({
      type: 'REQUEST',
      requestId,
      traceId: traceCtx?.traceId,
      spanId: traceCtx?.spanId,
      method,
      url,
      userId: user?.id,
      companyId: user?.companyId,
      ip,
      userAgent: userAgent.substring(0, 100),
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;

          this.logger.log({
            type: 'RESPONSE',
            requestId,
            traceId: traceCtx?.traceId,
            method,
            url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
          });

          // Emit metric (SRE — Four Golden Signals: latency + traffic)
          this.telemetry?.recordRequest(method, url, response.statusCode, duration);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.error({
            type: 'ERROR',
            requestId,
            traceId: traceCtx?.traceId,
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            error: error.message,
          });

          // Emit metric (SRE — Four Golden Signals: errors)
          this.telemetry?.recordRequest(method, url, statusCode, duration);
        },
      }),
    );
  }
}
