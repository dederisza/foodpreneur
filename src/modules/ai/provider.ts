import type { AiSynthesisContext, AiSynthesisOutput } from "./types";

/**
 * AI PROVIDER ABSTRACTION (Phase 5, Section 1)
 * ---------------------------------------------------------------------------
 * The rest of the application depends on this interface only, never on
 * a concrete provider. Swapping DummyAiProvider for a real LLM-backed
 * provider later (OpenAI / Anthropic / Gemini) means writing one new
 * class that satisfies this interface and pointing the registry
 * (modules/ai/registry.ts) at it - no other file in the app needs to
 * change.
 *
 * Kept deliberately small and practical, per the Phase 5 instructions:
 * one method, one input type, one output type. No API keys, no SDKs,
 * no network calls live here or in any current implementation of it.
 *
 * A provider receives only the structured AiSynthesisContext - never a
 * raw HTTP request, never a client-supplied business id, never direct
 * database access. This keeps every provider implementation, present
 * and future, incapable of leaking cross-business data or inventing
 * facts outside the findings it was given.
 */
export interface AiProvider {
  /** Short identifier, surfaced in AiSynthesisResult.provider (e.g. "dummy"). */
  readonly name: string;
  generateSynthesis(context: AiSynthesisContext): Promise<AiSynthesisOutput>;
}
