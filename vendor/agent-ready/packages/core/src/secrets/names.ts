/** Every secret the extension can hold. Each is the user's own credential for a provider. */
export type SecretName =
  | 'dataforseo_login'
  | 'dataforseo_password'
  | 'cloro_key'
  | 'anthropic_key'
  | 'openai_key'
  | 'gemini_key'
