// Narrowing for provider JSON, which arrives as `unknown`. Each reader returns null for a missing
// or mistyped field, so a changed provider shape degrades to "not reported" instead of a crash.

export type JsonObject = Readonly<Record<string, unknown>>

export function object(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null
}

export function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

/** A non-blank string, or null. */
export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Follows `path` through nested objects. */
export function at(value: unknown, ...path: string[]): unknown {
  let current = value
  for (const key of path) current = object(current)?.[key]
  return current
}
