import type { AiProvider } from "./provider";
import { DummyAiProvider } from "./dummyProvider";

let instance: AiProvider | null = null;

/**
 * Resolves the active AiProvider. Currently always returns the
 * DummyAiProvider (Phase 5 has no real AI integration by design - see
 * Phase 5 spec's "Strictly Out Of Scope" section).
 *
 * A future phase can change this function to select a real provider
 * (by config/env var) without touching any other file - every caller
 * in this codebase depends on the AiProvider interface, never on
 * DummyAiProvider directly.
 */
export function getAiProvider(): AiProvider {
  if (!instance) {
    instance = new DummyAiProvider();
  }
  return instance;
}
