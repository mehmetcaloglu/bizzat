export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'ROUTE_NOT_FOUND'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'LISTING_NOT_FOUND'
  | 'LISTING_NOT_EDITABLE'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFICATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
