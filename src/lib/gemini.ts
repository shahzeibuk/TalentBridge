/** Shared Gemini model ids and request helpers. */

export const GEMINI_MODEL = "gemini-3.8-flash"
export const GEMINI_FAST_MODEL = "gemini-3.5-flash-lite"

export function geminiGenerateUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

export const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"

/** Gemini 3.x expects thinkingLevel (low|medium|high), not thinkingBudget. */
export function geminiThinkingLow() {
  return { thinkingConfig: { thinkingLevel: "low" } }
}

export function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
}
