// =============================================
// 📝 LOGGING INTERCEPTOR
// =============================================
// Request/Response logging
// =============================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const requestId = request.headers['x-request-id'] || uuidv4();
    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    const { method, url, user } = request;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip || request.connection.remoteAddress;

    const startTime = Date.now();

    // Log request
    this.logger.log({
      type: 'REQUEST',
      requestId,
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
            method,
            url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            type: 'ERROR',
            requestId,
            method,
            url,
            statusCode: error.status || 500,
            duration: `${duration}ms`,
            error: error.message,
          });
        },
      }),
    );
  }
}
