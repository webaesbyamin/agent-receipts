import { z } from 'zod'
import type { ErrorResponse } from './api'

/**
 * Validate data against a Zod schema.
 * Returns { success: true, data } or { success: false, error: ErrorResponse }
 */
export function validate<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: ErrorResponse } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: createErrorResponse(
      'VALIDATION_ERROR',
      formatZodError(result.error),
      400
    ),
  }
}

/**
 * Format Zod errors into a human-readable message.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join('; ')
}

/**
 * Create a standard error response object.
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number
): ErrorResponse {
  return {
    error: {
      code: code as ErrorResponse['error']['code'],
      message,
      status,
    },
  }
}
