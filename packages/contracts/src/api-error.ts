import { Type } from 'typebox'

export const ApiErrorCodeSchema = Type.Union([
  Type.Literal('VALIDATION_ERROR'),
  Type.Literal('UNAUTHENTICATED'),
  Type.Literal('FORBIDDEN'),
  Type.Literal('ROUTE_NOT_FOUND'),
  Type.Literal('DEPENDENCY_UNAVAILABLE'),
  Type.Literal('LISTING_NOT_FOUND'),
  Type.Literal('LISTING_NOT_EDITABLE'),
  Type.Literal('VERIFICATION_REQUIRED'),
  Type.Literal('VERIFICATION_FAILED'),
  Type.Literal('REFERENCE_PARENT_NOT_FOUND'),
  Type.Literal('RATE_LIMITED'),
  Type.Literal('INTERNAL_ERROR'),
])

export const ApiErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: ApiErrorCodeSchema,
    message: Type.String(),
    requestId: Type.String(),
  }),
})
