import { NextResponse } from 'next/server'

interface ErrorBody {
  error: string
  code: string
  details?: unknown
}

function errorResponse(body: ErrorBody, status: number): NextResponse {
  return NextResponse.json(body, { status })
}

export function unauthorized(message = 'Unauthorized') {
  return errorResponse({ error: message, code: 'UNAUTHORIZED' }, 401)
}

export function forbidden(message = 'Forbidden') {
  return errorResponse({ error: message, code: 'FORBIDDEN' }, 403)
}

export function notFound(message = 'Not found') {
  return errorResponse({ error: message, code: 'NOT_FOUND' }, 404)
}

export function badRequest(message = 'Bad request', details?: unknown) {
  return errorResponse({ error: message, code: 'BAD_REQUEST', details }, 400)
}

export function validationError(details: unknown) {
  return errorResponse({ error: 'Validation failed', code: 'VALIDATION_ERROR', details }, 400)
}

export function serverError(message = 'Internal server error') {
  return errorResponse({ error: message, code: 'INTERNAL_ERROR' }, 500)
}

export function rateLimited(retryAfter = 60) {
  const response = errorResponse({ error: 'Too many requests', code: 'RATE_LIMITED' }, 429)
  response.headers.set('Retry-After', String(retryAfter))
  return response
}
