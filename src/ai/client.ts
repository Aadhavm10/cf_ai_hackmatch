/**
 * Workers AI Client Helper
 * Provides simple interface to call Workers AI models
 */

export interface AIBinding {
  run(model: string, options: any): Promise<any>;
}

export class WorkersAIClient {
  constructor(private ai: AIBinding) {}

  /**
   * Generate text using Llama model
   */
  async generate(prompt: string, maxTokens: number = 1024): Promise<string> {
    console.log('[AI CLIENT] Starting AI generation request');
    console.log('[AI CLIENT] Prompt length:', prompt.length);
    console.log('[AI CLIENT] Max tokens:', maxTokens);

    const model = '@cf/meta/llama-3.1-8b-instruct'; // Using stable 8b model
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI CLIENT] Attempt ${attempt}/${maxRetries} - Calling AI.run with model: ${model}`);

        const response = await this.ai.run(model, {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.7,
        });

        console.log('[AI CLIENT] ✓ AI response received successfully');
        console.log('[AI CLIENT] Response text length:', response.response?.length || 0);

        return response.response || '';
      } catch (error) {
        lastError = error as Error;
        const errorMessage = (error as Error).message;

        console.error(`[AI CLIENT] ❌ Attempt ${attempt}/${maxRetries} failed:`, errorMessage);

        // Check if it's a capacity/rate limit error
        if (errorMessage.includes('Capacity temporarily exceeded') || errorMessage.includes('3040')) {
          if (attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.log(`[AI CLIENT] ⏳ Capacity exceeded, retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          } else {
            console.error('[AI CLIENT] ❌ Max retries exceeded for capacity issue');
          }
        } else {
          // Non-retryable error, fail immediately
          console.error('[AI CLIENT] ❌ Non-retryable error:', error);
          break;
        }
      }
    }

    console.error('[AI CLIENT] Error details:', {
      name: lastError?.name,
      message: lastError?.message,
      stack: lastError?.stack,
    });
    throw new Error(`AI generation failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate and parse JSON response
   */
  async generateJSON<T>(prompt: string): Promise<T> {
    console.log('[AI CLIENT] generateJSON called');

    const text = await this.generate(prompt, 1500);

    console.log('[AI CLIENT] Raw AI text response:', text);

    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('[AI CLIENT] Extracted JSON from response');
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[AI CLIENT] Successfully parsed JSON:', parsed);
        return parsed;
      }

      // Otherwise try parsing directly
      console.log('[AI CLIENT] Attempting direct JSON parse');
      const parsed = JSON.parse(text);
      console.log('[AI CLIENT] Successfully parsed JSON:', parsed);
      return parsed;
    } catch (error) {
      console.error('[AI CLIENT] ❌ JSON parse error:', error);
      console.error('[AI CLIENT] AI response was:', text);
      throw new Error(`Failed to parse AI response as JSON: ${(error as Error).message}`);
    }
  }
}
