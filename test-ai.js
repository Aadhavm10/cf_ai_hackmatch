// Quick test to verify AI is working
export default {
  async fetch(request, env) {
    try {
      console.log('Testing AI binding...');

      const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct', {
        messages: [{
          role: 'user',
          content: 'Respond with valid JSON only: {"test": "hello", "working": true}'
        }],
        max_tokens: 100,
        temperature: 0.1,
      });

      console.log('AI Response:', response);

      return new Response(JSON.stringify({
        success: true,
        aiResponse: response
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('AI Test Error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
