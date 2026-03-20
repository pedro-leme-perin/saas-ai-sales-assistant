// =============================================
// 📦 API RESPONSE TYPES
// =============================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  details?: Record<string, unknown> | string | null;
  timestamp: string;
  path: string;
  requestId?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
