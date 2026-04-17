// =====================================================
// REQUEST ID MIDDLEWARE
// =====================================================
// Ensures every request has a unique X-Request-Id header
// for distributed tracing and structured logging.
//
// If a load balancer or reverse proxy already set the
// header, it is preserved. Otherwise, a UUID v4 is
// generated. The ID is attached to both the request
// object (request.requestId) and the response header.
//
// Reference: SRE — Distributed Systems Observability
// Reference: Release It! — Transparency
// =====================================================

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request to include requestId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Preserve existing ID from load balancer/reverse proxy, or generate new one
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    // Attach to request for downstream use in logging/tracing
    req.requestId = requestId;

    // Set on request headers so guards/interceptors can read it consistently
    req.headers['x-request-id'] = requestId;

    // Set on response so clients and monitoring tools can correlate
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
