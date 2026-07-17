// ── Main AI Module: Pluggable AI Provider System ──────────────────────────────

import { generateGemini, solveGemini, summarizeGemini } from './gemini.js';
import { generateOpenRouter, solveOpenRouter, summarizeOpenRouter } from './openrouter.js';
import { generateGroq, solveGroq, summarizeGroq } from './groq.js';
import { generateOpenAI, solveOpenAI, summarizeOpenAI } from './openai.js';

/**
 * Determine which AI provider to use based on environment variable.
 * Defaults to 'openrouter' if not specified.
 */
const getProvider = () => {
  const provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
  return provider;
};

/**
 * Get provider functions based on selected provider.
 * To add a new provider:
 * 1. Create a new file (e.g., anthropic.js) with generate, solve, summarize exports
 * 2. Import it here
 * 3. Add it to the providerMap below
 * 4. Add environment variable to .env (never to .env.example - that's documentation only)
 * 5. That's it! No other files need modification.
 * 5. That's it! No other files need modification.
 */
const providerMap = {
  gemini: {
    generate: generateGemini,
    solve: solveGemini,
    summarize: summarizeGemini,
  },
  openrouter: {
    generate: generateOpenRouter,
    solve: solveOpenRouter,
    summarize: summarizeOpenRouter,
  },
  groq: {
    generate: generateGroq,
    solve: solveGroq,
    summarize: summarizeGroq,
  },
  openai: {
    generate: generateOpenAI,
    solve: solveOpenAI,
    summarize: summarizeOpenAI,
  },
};

/**
 * Get the provider implementation.
 * Throws error if provider is not registered.
 */
const getProviderImpl = () => {
  const provider = getProvider();
  const impl = providerMap[provider];
  if (!impl) {
    throw new Error(`AI_PROVIDER "${provider}" is not supported. Available: ${Object.keys(providerMap).join(', ')}`);
  }
  return impl;
};

/**
 * Main public API: callAI
 *
 * Single entry point for all AI operations.
 * Abstracts provider implementation details.
 *
 * @param {string} type - Operation type: 'generate', 'solve', or 'summarize'
 * @param {object} options - Operation-specific options
 *
 * Examples:
 *   // Generate flashcards from text
 *   callAI('generate', { textContent: '...' })
 *
 *   // Generate from image
 *   callAI('generate', { imageBase64: '...', imageMimeType: 'image/jpeg' })
 *
 *   // Solve a problem
 *   callAI('solve', { text: '...' })
 *   callAI('solve', { fileData: { base64: '...', mimeType: 'image/jpeg' } })
 *
 *   // Summarize flashcards
 *   callAI('summarize', { title: '...', subject: '...', content: '...' })
 */
export const callAI = async (type, options = {}) => {
  if (!type) {
    throw new Error('type parameter is required (generate, solve, or summarize)');
  }

  const provider = getProvider();
  console.log(`[ai] Using provider: ${provider}, type: ${type}`);

  const impl = getProviderImpl();

  switch (type.toLowerCase()) {
    case 'generate':
      return await impl.generate(options);

    case 'solve':
      return await impl.solve(options);

    case 'summarize':
      return await impl.summarize(options);

    default:
      throw new Error(`Unknown AI type: ${type}. Must be 'generate', 'solve', or 'summarize'.`);
  }
};

export default callAI;
