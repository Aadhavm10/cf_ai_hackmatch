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
    try {
      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      return response.response || '';
    } catch (error) {
      console.error('Workers AI error:', error);
      throw new Error('AI generation failed');
    }
  }

  /**
   * Generate and parse JSON response
   */
  async generateJSON<T>(prompt: string): Promise<T> {
    const text = await this.generate(prompt, 1500);

    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Otherwise try parsing directly
      return JSON.parse(text);
    } catch (error) {
      console.error('JSON parse error:', error);
      console.error('AI response was:', text);
      throw new Error('Failed to parse AI response as JSON');
    }
  }
}
