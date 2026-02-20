import { z } from 'zod'

export const RubricCriterion = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().min(0).max(1),
  passing_threshold: z.number().min(0).max(1).optional(),
  examples: z.object({
    good: z.array(z.string()).optional(),
    bad: z.array(z.string()).optional(),
  }).optional(),
})
export type RubricCriterion = z.infer<typeof RubricCriterion>

export const Rubric = z.object({
  version: z.string().default('1.0'),
  criteria: z.array(RubricCriterion).min(1),
  passing_threshold: z.number().min(0).max(1).default(0.7),
  require_all: z.boolean().default(false),
})
export type Rubric = z.infer<typeof Rubric>

export const CriterionResult = z.object({
  criterion: z.string(),
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  reasoning: z.string(),
})
export type CriterionResult = z.infer<typeof CriterionResult>

export const JudgmentResult = z.object({
  verdict: z.enum(['pass', 'fail', 'partial']),
  score: z.number().min(0).max(1),
  criteria_results: z.array(CriterionResult),
  overall_reasoning: z.string(),
  rubric_version: z.string(),
})
export type JudgmentResult = z.infer<typeof JudgmentResult>
