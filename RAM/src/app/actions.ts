'use server';

import { generateSystemPromptInjection } from '@/lib/knowledge-base';

/**
 * Fetches the distilled system prompt from the local knowledge base.
 * This runs on the server to allow access to the filesystem (fs).
 */
export async function getPersonalizedPrompt(): Promise<string> {
  try {
    return generateSystemPromptInjection();
  } catch (error) {
    console.error('Failed to generate personalized prompt:', error);
    return '';
  }
}
