// Backend configuration - automatically detect local vs production
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const BACKEND_URL = IS_LOCAL
  ? 'http://localhost:8788'
  : 'https://cf_ai_hackmatch.aadhavmanimurugan.workers.dev';

export const WS_URL = IS_LOCAL
  ? 'ws://localhost:8788'
  : 'wss://cf_ai_hackmatch.aadhavmanimurugan.workers.dev';

console.log('Using WebSocket URL:', WS_URL);
