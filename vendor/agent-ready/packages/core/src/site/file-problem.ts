// How a site file that is present breaks the standard it is checked against.

/**
 * missing_h1: an llms.txt opens with no H1. not_json: a manifest is no JSON object.
 * missing_field: a required field is absent or empty. invalid_field: a field holds a value its
 * standard does not allow.
 */
export type FileProblemCode = 'missing_h1' | 'not_json' | 'missing_field' | 'invalid_field'

export interface FileProblem {
  readonly code: FileProblemCode
  /** The JSON field at fault, as a path such as entries[0].type; null for the whole file. */
  readonly field: string | null
}
