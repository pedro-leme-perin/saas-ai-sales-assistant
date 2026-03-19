// =============================================
// 🛡️ GLOBAL EXCEPTION FILTER
// =============================================
// Handles all exceptions and formats responses
// Fundamentado em: Release It! - Error Handling
// =============================================

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  details?: unknown;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log the error
    this.logError(exception, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const requestId = request.headers['x-request-id'] as string;

    // HTTP Exception
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message = exception.message;
      let details: unknown;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as Record<string, unknown>;
        message = (response.message as string) || message;
        details = response.errors || response.details;
      }

      return {
        success: false,
        statusCode: status,
        message: Array.isArray(message) ? message[0] : message,
        error: HttpStatus[status] || 'Error',
        details,
        timestamp,
        path,
        requestId,
      };
    }

    // Prisma Errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, timestamp, path, requestId);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided',
        error: 'Validation Error',
        timestamp,
        path,
        requestId,
      };
    }

    // Unknown Error
    const error = exception as Error;
    return {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message || 'Unknown error',
      error: 'Internal Server Error',
      timestamp,
      path,
      requestId,
    };
  }

  private handlePrismaError(
    error: Prisma.PrismaClientKnownRequestError,
    timestamp: string,
    path: string,
    requestId?: string,
  ): ErrorResponse {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const target = (error.meta?.target as string[])?.join(', ') || 'field';
        return {
          success: false,
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${target} already exists`,
          error: 'Conflict',
          details: { code: error.code, target },
          timestamp,
          path,
          requestId,
        };

      case 'P2025':
        // Record not found
        return {
          success: false,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
          details: { code: error.code },
          timestamp,
          path,
          requestId,
        };

      case 'P2003':
        // Foreign key constraint
        return {
          success: false,
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record not found',
          error: 'Bad Request',
          details: { code: error.code },
          timestamp,
          path,
          requestId,
        };

      default:
        return {
          success: false,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'Internal Server Error',
          details: process.env.NODE_ENV === 'development' ? { code: error.code } : undefined,
          timestamp,
          path,
          requestId,
        };
    }
  }

  private logError(exception: unknown, errorResponse: ErrorResponse) {
    const logMessage = {
      statusCode: errorResponse.statusCode,
      message: errorResponse.message,
      path: errorResponse.path,
      requestId: errorResponse.requestId,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error('Server Error', {
        ...logMessage,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn('Client Error', logMessage);
    }
  }
}
