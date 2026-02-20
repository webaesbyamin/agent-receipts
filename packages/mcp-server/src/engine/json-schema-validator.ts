/**
 * Minimal JSON Schema validator — zero dependencies.
 * Supports: type, required, properties, items, minLength, maxLength,
 * minimum, maximum, enum, pattern, minItems, maxItems, additionalProperties
 *
 * Returns array of error strings. Empty array = valid.
 */
export function validateJsonSchema(
  data: unknown,
  schema: Record<string, unknown>,
  path = '',
): string[] {
  const errors: string[] = []

  // Empty schema accepts everything
  if (Object.keys(schema).length === 0) {
    return errors
  }

  // type
  if (schema.type !== undefined) {
    const expectedType = schema.type as string
    if (!checkType(data, expectedType)) {
      errors.push(`${path || '.'}: expected type ${expectedType}, got ${getType(data)}`)
      return errors // Short-circuit on type mismatch
    }
  }

  // enum
  if (schema.enum !== undefined) {
    const allowed = schema.enum as unknown[]
    if (!allowed.some((v) => JSON.stringify(v) === JSON.stringify(data))) {
      errors.push(`${path || '.'}: value ${JSON.stringify(data)} not in enum ${JSON.stringify(allowed)}`)
    }
  }

  // String validations
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < (schema.minLength as number)) {
      errors.push(`${path || '.'}: string length ${data.length} < minLength ${schema.minLength}`)
    }
    if (schema.maxLength !== undefined && data.length > (schema.maxLength as number)) {
      errors.push(`${path || '.'}: string length ${data.length} > maxLength ${schema.maxLength}`)
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern as string)
      if (!regex.test(data)) {
        errors.push(`${path || '.'}: string does not match pattern ${schema.pattern}`)
      }
    }
  }

  // Number validations
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < (schema.minimum as number)) {
      errors.push(`${path || '.'}: ${data} < minimum ${schema.minimum}`)
    }
    if (schema.maximum !== undefined && data > (schema.maximum as number)) {
      errors.push(`${path || '.'}: ${data} > maximum ${schema.maximum}`)
    }
  }

  // Object validations
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>

    // required
    if (schema.required !== undefined) {
      const required = schema.required as string[]
      for (const key of required) {
        if (!(key in obj)) {
          errors.push(`${path || '.'}: missing required property "${key}"`)
        }
      }
    }

    // properties
    if (schema.properties !== undefined) {
      const props = schema.properties as Record<string, Record<string, unknown>>
      for (const [key, propSchema] of Object.entries(props)) {
        if (key in obj) {
          const propErrors = validateJsonSchema(obj[key], propSchema, `${path}.${key}`)
          errors.push(...propErrors)
        }
      }
    }

    // additionalProperties
    if (schema.additionalProperties === false && schema.properties !== undefined) {
      const allowedKeys = new Set(Object.keys(schema.properties as Record<string, unknown>))
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          errors.push(`${path || '.'}: additional property "${key}" not allowed`)
        }
      }
    }
  }

  // Array validations
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < (schema.minItems as number)) {
      errors.push(`${path || '.'}: array length ${data.length} < minItems ${schema.minItems}`)
    }
    if (schema.maxItems !== undefined && data.length > (schema.maxItems as number)) {
      errors.push(`${path || '.'}: array length ${data.length} > maxItems ${schema.maxItems}`)
    }
    if (schema.items !== undefined) {
      const itemSchema = schema.items as Record<string, unknown>
      for (let i = 0; i < data.length; i++) {
        const itemErrors = validateJsonSchema(data[i], itemSchema, `${path}[${i}]`)
        errors.push(...itemErrors)
      }
    }
  }

  return errors
}

function checkType(data: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string': return typeof data === 'string'
    case 'number': return typeof data === 'number'
    case 'integer': return typeof data === 'number' && Number.isInteger(data)
    case 'boolean': return typeof data === 'boolean'
    case 'object': return typeof data === 'object' && data !== null && !Array.isArray(data)
    case 'array': return Array.isArray(data)
    case 'null': return data === null
    default: return false
  }
}

function getType(data: unknown): string {
  if (data === null) return 'null'
  if (Array.isArray(data)) return 'array'
  return typeof data
}
