import { z } from 'zod'

/**
 * A single constraint definition that specifies a rule to evaluate.
 */
export const ConstraintDefinition = z.object({
  type: z.string().min(1),
  value: z.unknown(),
  message: z.string().optional(),
})
export type ConstraintDefinition = z.infer<typeof ConstraintDefinition>

/**
 * Result of evaluating a single constraint.
 */
export const SingleConstraintResult = z.object({
  type: z.string(),
  passed: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown(),
  message: z.string().optional(),
})
export type SingleConstraintResult = z.infer<typeof SingleConstraintResult>

/**
 * Aggregate result of evaluating all constraints on a receipt.
 */
export const ConstraintResult = z.object({
  passed: z.boolean(),
  results: z.array(SingleConstraintResult),
  evaluated_at: z.string().datetime(),
})
export type ConstraintResult = z.infer<typeof ConstraintResult>

/**
 * Array of constraint definitions.
 */
export const ConstraintDefinitions = z.array(ConstraintDefinition)
export type ConstraintDefinitions = z.infer<typeof ConstraintDefinitions>
