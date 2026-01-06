/**
 * Cloudflare Worker Entry Point
 * Exports the HackMatchAgent Durable Object and handles routing
 */

import { HackMatchAgent } from './HackMatchAgent.js';
import type { Env } from './HackMatchAgent.js';

// Export the Durable Object class
export { HackMatchAgent };

/**
 * Worker fetch handler
 * The Agent SDK handles most routing automatically, but we can add custom endpoints here
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'cf_ai_hackmatch' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Create room endpoint
    if (url.pathname === '/api/create-room' && request.method === 'POST') {
      // Generate a unique room ID
      const roomId = Math.random().toString(36).substring(2, 8);

      return new Response(
        JSON.stringify({
          roomId,
          url: `/api/room/${roomId}`,
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Agent SDK handles WebSocket connections and agent routing
    // Forward all other requests to the appropriate agent instance
    if (url.pathname.startsWith('/api/room/')) {
      const pathParts = url.pathname.split('/');
      const roomId = pathParts[3];

      if (!roomId) {
        return new Response('Room ID required', { status: 400, headers: corsHeaders });
      }

      // Get Durable Object ID from room ID
      const id = env.HACKMATCH_AGENT.idFromName(roomId);
      const stub = env.HACKMATCH_AGENT.get(id);

      // Forward request to the Durable Object
      return stub.fetch(request);
    }

    // Default response
    return new Response('HackMatch API - Use /api/create-room to create a room', {
      headers: { 'Content-Type': 'text/plain', ...corsHeaders },
    });
  },
};
