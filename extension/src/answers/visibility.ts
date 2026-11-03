// local_ai_visibility: one local buyer question to each assistant, and whether the answer names
// the business. Assist mode reads the user's own sessions after the user presses Enter; with a
// Cloro key, ChatGPT, Gemini and AI Mode are asked unattended through Cloro instead, within the
// spend cap. Perplexity has no Cloro endpoint, so it always uses Assist mode.
import type {
  AiEngine,
  EngineAnswer,
  LocalAiVisibilityResult,
  ToolArgs,
} from '@local-seo/core/bridge'
import { ALL_AI_ENGINES } from '@local-seo/core/bridge'
import { missing } from '@local-seo/core/business'
import { answerVisibility } from '@local-seo/core/ai'
import { CLORO_ESTIMATED_CREDITS, CLORO_USD_PER_CREDIT } from '@open-agent-ready/core/providers'

export interface AnswerText {
  readonly text: string
  readonly citedUrls: readonly string[]
}

export type EngineRead =
  | { readonly kind: 'answer'; readonly answer: AnswerText }
  | { readonly kind: 'missing'; readonly reason: string }

export interface AnswerDeps {
  /** Opens the assistant with the prompt filled in; `focus` brings its tab to the front. */
  readonly assist: (engine: AiEngine, prompt: string, focus: boolean) => Promise<EngineRead>
  /** Null when no Cloro key is set; Cloro then asks nothing. */
  readonly cloro: ((engine: CloroEngine, prompt: string) => Promise<EngineRead>) | null
}

export type CloroEngine = Exclude<AiEngine, 'perplexity'>
export const CLORO_ENGINES: readonly AiEngine[] = ['chatgpt', 'gemini', 'ai_mode']

/** What one Cloro run costs: the credits of each engine Cloro serves, at the listed rate. */
export function cloroEstimateUsd(engines: readonly AiEngine[]): number {
  const credits = engines
    .filter(isCloroEngine)
    .reduce((sum, engine) => sum + CLORO_ESTIMATED_CREDITS[engine], 0)
  return credits * CLORO_USD_PER_CREDIT
}

/** The question a local buyer asks, as the tool and the panel both phrase it. */
export function localPrompt(query: string, city: string): string {
  return `What is the best ${query.trim()} in ${city.trim()}?`
}

export async function localAiVisibility(
  args: ToolArgs['local_ai_visibility'],
  deps: AnswerDeps,
): Promise<LocalAiVisibilityResult> {
  const prompt = localPrompt(args.query, args.city)
  const engines = args.engines ?? ALL_AI_ENGINES
  const source = deps.cloro === null ? 'assist' : 'cloro'
  let focused = false
  const answers = await Promise.all(
    engines.map(async (engine): Promise<EngineAnswer> => {
      const cloro = isCloroEngine(engine) ? deps.cloro : null
      // Only the first assistant opened in Assist mode takes the front, so tabs do not pile up.
      const focus = cloro === null && !focused
      if (focus) focused = true
      const read =
        cloro !== null && isCloroEngine(engine)
          ? await cloro(engine, prompt).catch(failed)
          : await deps.assist(engine, prompt, focus).catch(failed)
      if (read.kind === 'missing') return { engine, answer: missing(read.reason) }
      return {
        engine,
        answer: answerVisibility({
          text: read.answer.text,
          citedUrls: read.answer.citedUrls,
          businessName: args.businessName,
          competitors: args.competitors ?? [],
        }),
      }
    }),
  )
  const estimatedCostUsd = source === 'cloro' ? cloroEstimateUsd(engines) : null
  return { prompt, answers, source, estimatedCostUsd }
}

function isCloroEngine(engine: AiEngine): engine is CloroEngine {
  return CLORO_ENGINES.includes(engine)
}

function failed(error: unknown): EngineRead {
  return { kind: 'missing', reason: error instanceof Error ? error.message : String(error) }
}
