# cf_ai_hackmatch - HackMatch

AI-Powered RAPID Brainstorming Platform for Hackathon Teams

## Overview

HackMatch guides hackathon teams through the proven RAPID framework, helping them go from idea chaos to clear MVP in 30 minutes instead of 3-5 hours of unstructured brainstorming.

### RAPID Framework (5 Stages)

1. **Review** (3 min): Select hackathon challenges to focus on
2. **All Ideas** (10 min): Silent brainstorming → group sharing with AI combinations
3. **Prioritize** (5 min): Score ideas on feasibility with AI-powered objective scoring
4. **Identify MVP** (5 min): Drag features into Must/Nice/Out of Scope, AI suggests tech stack
5. **Decide** (2 min): Final vote and export project summary

## Technology Stack

- **Backend**: Cloudflare Workers + Durable Objects using [Cloudflare Agent SDK](https://agents.cloudflare.com/)
- **AI**: Workers AI (Llama 3.3-70b-instruct)
- **Frontend**: Standalone HTML/JavaScript
- **Database**: SQLite in Durable Objects
- **Real-time**: WebSocket (via Durable Objects)

## Setup Instructions

### Prerequisites

- Node.js 18+
- npm
- Cloudflare account (for deployment)

### Local Development

1. **Clone and Install**:
   ```bash
   git clone <your-repo-url>
   cd cf_ai_hackmatch
   npm install
   ```

2. **Run Backend** (Terminal 1):
   ```bash
   npm run dev
   ```
   Backend will be available at `http://localhost:8787`

3. **Run Frontend** (Terminal 2):
   ```bash
   cd public
   python3 -m http.server 8080
   # or: npx serve
   ```
   Frontend will be available at `http://localhost:8080`

4. **Test with Multiple Users**:
   Open multiple browser windows/tabs to simulate a team collaborating in real-time.

## Project Structure

```
cf_ai_hackmatch/
├── src/
│   ├── index.ts              # Worker entry point
│   ├── HackMatchAgent.ts     # Main Agent class (Durable Object)
│   ├── schema.sql            # SQLite database schema
│   ├── types/                # TypeScript interfaces
│   └── ai/                   # AI prompts and scoring logic
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks (useAgent)
│   │   └── store/            # Zustand state management
│   └── vite.config.ts
├── wrangler.toml             # Cloudflare Workers config
└── package.json
```

## Deployment

### Live Deployment

The application is currently deployed and accessible at:
- **Frontend**: https://hackmatch.pages.dev (or https://24a5b151.hackmatch.pages.dev)
- **Backend API**: https://cf_ai_hackmatch.aadhavmanimurugan.workers.dev

Visit the frontend URL to start a brainstorming session!

### Deploy Backend (Worker + Durable Object)

```bash
npm run deploy
```

This will deploy:
- The HackMatch Worker (handles HTTP/WebSocket routing)
- The HackMatchAgent Durable Object (manages room state and AI)
- SQLite database (automatic with Durable Objects)
- Workers AI integration (automatic)

### Deploy Frontend (Cloudflare Pages)

Option 1 - Using Wrangler:
```bash
npx wrangler pages deploy public
```

Option 2 - Via Cloudflare Dashboard:
1. Go to Cloudflare Dashboard → Pages
2. Create new project
3. Upload the `public/` directory
4. Deploy

The frontend at `public/index.html` is a complete interactive demo that connects to the deployed Worker.

### Testing Locally

Terminal 1 - Start the Worker:
```bash
npm run dev
```

Terminal 2 - Serve the frontend:
```bash
cd public
python3 -m http.server 8080
# or: npx serve
```

Then open http://localhost:8080 in your browser.

**Note:** When testing locally, the WebSocket will connect to `localhost:8787` (the wrangler dev server).

## Features

✅ Team member profiles with skills & experience
✅ AI-powered track validation
✅ Experience-aware recommendations
✅ Role allocation suggestions (Frontend, Backend, Database, Design)
✅ Complexity adjustment based on team experience
✅ Real-time collaboration (WebSocket)
✅ AI-powered idea scoring
✅ Structured RAPID workflow
✅ Export project summary
✅ Works on desktop and mobile

## Cloudflare Requirements Met

- ✅ LLM: Workers AI (Llama 3.3-70b-instruct)
- ✅ Workflow: Cloudflare Workers + Durable Objects
- ✅ User Input: Chat + idea submission forms + team profiles
- ✅ Memory/State: SQLite in Durable Objects
- ✅ Repository prefix: cf_ai_
- ✅ Documentation: README.md (this file)
- ✅ AI Prompts: See [PROMPTS.md](PROMPTS.md)

## Architecture

The application uses the **Cloudflare Agent SDK** which provides:
- Built-in WebSocket management
- Automatic state synchronization
- @callable() decorators for client-invokable methods
- Direct SQL database access
- Integrated Workers AI binding

## Contributing

This project was built for the Cloudflare AI assignment. See [PROMPTS.md](PROMPTS.md) for all AI prompts used in development.

## License

ISC
