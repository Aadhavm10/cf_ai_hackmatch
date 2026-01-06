# AI Prompts Used in HackMatch

This document details all AI prompts used in the cf_ai_hackmatch project, as required by the Cloudflare AI assignment.

## Overview

HackMatch uses Workers AI (Llama 3.1-8b-instruct) to provide intelligent assistance during hackathon brainstorming sessions. The AI helps teams:
- Assess idea feasibility
- Combine ideas creatively
- Suggest appropriate tech stacks
- Prioritize MVP features
- Distribute work among team members

---

## 1. Feasibility Scoring Prompt

**Purpose:** Assesses whether a hackathon idea can realistically be built within time and resource constraints.

**Input Variables:**
- `idea.title` - The name of the idea
- `idea.description` - Detailed description of the idea
- `teamSize` - Number of people on the team (default: 3)
- `timeHours` - Available time in hours (default: 24)

**Prompt Template:**
```
You are a technical feasibility assessor for hackathon ideas.

Idea Title: {idea.title}
Description: {idea.description}

Team Context:
- Team Size: {teamSize} people
- Time Available: {timeHours} hours
- Typical hackathon skills: Web dev, APIs, databases, some AI/ML

Rate the feasibility of building this idea within the given constraints.

Consider:
1. Can the core functionality be built in {timeHours} hours?
2. What are the main technical risks?
3. Are there known pitfalls with this type of project?
4. Is the scope realistic for a hackathon?

Respond in valid JSON format (no markdown, no code blocks):
{
  "score": <number 1-5, where 5=very feasible, 1=impossible>,
  "reasoning": "<2-3 sentences explaining the score>",
  "risks": ["<risk1>", "<risk2>"],
  "recommendations": ["<suggestion1>", "<suggestion2>"]
}
```

**Expected Output Format:**
```json
{
  "score": 4,
  "reasoning": "The core features are achievable with React and a simple backend. The main challenge is integrating the payment API within the time limit.",
  "risks": ["Payment API integration might take 4-6 hours", "Authentication could be complex"],
  "recommendations": ["Use a pre-built auth solution like Auth0", "Start with mock payments first"]
}
```

**Example Usage:**
- **Triggered:** When a user scores an idea during Stage P (Prioritize)
- **Location:** `src/HackMatchAgent.ts:408` - `scoreIdeaWithAI()` method
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## 2. Idea Combination Prompt

**Purpose:** Suggests creative ways to merge two separate ideas into a unique concept.

**Input Variables:**
- `idea1.title` & `idea1.description` - First idea
- `idea2.title` & `idea2.description` - Second idea

**Prompt Template:**
```
You are a creative hackathon mentor helping teams brainstorm.

Idea 1: {idea1.title}
{idea1.description}

Idea 2: {idea2.title}
{idea2.description}

Suggest an innovative way to combine these two ideas into something unique.

Respond in valid JSON format (no markdown, no code blocks):
{
  "title": "<catchy combined idea name>",
  "description": "<1-2 sentences describing the combination>",
  "uniqueValue": "<what makes this combination special>"
}
```

**Expected Output Format:**
```json
{
  "title": "Budget Battle Royale",
  "description": "Combine expense tracking with competitive multiplayer gaming where users compete to save the most money.",
  "uniqueValue": "First expense tracker that makes budgeting fun through social competition"
}
```

**Example Usage:**
- **Triggered:** During Stage A (All Ideas) when AI suggests combining user-submitted ideas
- **Location:** `src/ai/prompts.ts:31` - `ideaCombinationPrompt()` function
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## 3. Tech Stack Suggestion Prompt

**Purpose:** Recommends appropriate technologies for building the winning idea.

**Input Variables:**
- `winningIdea.title` & `winningIdea.description` - The selected idea
- `teamSize` - Number of team members (default: 3)
- `timeHours` - Available time (default: 24)

**Prompt Template:**
```
You are a hackathon tech advisor helping teams choose their stack.

Winning Idea: {winningIdea.title}
Description: {winningIdea.description}

Team: {teamSize} people, {timeHours} hours available

Recommend a practical tech stack. Prioritize:
1. Technologies that are quick to set up
2. Well-documented, stable tools
3. Common hackathon stacks (avoid experimental tech)
4. Ease of deployment

Respond in valid JSON format (no markdown, no code blocks):
{
  "frontend": "<framework/library>",
  "backend": "<framework/runtime>",
  "database": "<database choice>",
  "deployment": "<hosting platform>",
  "reasoning": "<2-3 sentences explaining why this stack works>"
}
```

**Expected Output Format:**
```json
{
  "frontend": "React with Vite",
  "backend": "Express.js on Node.js",
  "database": "MongoDB Atlas",
  "deployment": "Vercel (frontend) + Railway (backend)",
  "reasoning": "This stack allows rapid development with minimal setup. React/Vite provides fast builds, Express is beginner-friendly, MongoDB handles flexible data, and deployment is one-click."
}
```

**Example Usage:**
- **Triggered:** Automatically during transition to Stage I (Identify MVP)
- **Location:** `src/HackMatchAgent.ts:522` - `generateMVPSuggestions()` method
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## 4. Work Distribution Prompt

**Purpose:** Assigns tasks to team members based on features and skills.

**Input Variables:**
- `winningIdea` - The selected project
- `features[]` - List of must-have features
- `teamSize` - Number of team members (default: 3)
- `timeHours` - Available time (default: 24)

**Prompt Template:**
```
You are a hackathon project manager helping distribute work.

Project: {winningIdea.title}
Must-Have Features: {features.join(', ')}

Team: {teamSize} people
Time: {timeHours} hours

Distribute the work evenly and suggest a timeline.

Assume team members have full-stack skills. Consider:
1. Dependencies (what must be built first?)
2. Parallel work (what can be done simultaneously?)
3. Time buffers for debugging and integration

Respond in valid JSON format (no markdown, no code blocks):
{
  "assignments": [
    {
      "personNumber": 1,
      "tasks": ["<task1>", "<task2>"],
      "estimatedHours": <number>
    },
    {
      "personNumber": 2,
      "tasks": ["<task3>", "<task4>"],
      "estimatedHours": <number>
    }
  ],
  "timeline": "<hour-by-hour breakdown>",
  "dependencies": ["<what blocks what>"]
}
```

**Expected Output Format:**
```json
{
  "assignments": [
    {
      "personNumber": 1,
      "tasks": ["Set up React project", "Build expense entry form", "Create dashboard UI"],
      "estimatedHours": 8
    },
    {
      "personNumber": 2,
      "tasks": ["Set up Express backend", "MongoDB schema design", "API endpoints"],
      "estimatedHours": 9
    },
    {
      "personNumber": 3,
      "tasks": ["Authentication setup", "Deployment pipeline", "Testing"],
      "estimatedHours": 7
    }
  ],
  "timeline": "Hours 0-2: Project setup. Hours 2-10: Core features. Hours 10-20: Integration. Hours 20-24: Testing & polish.",
  "dependencies": ["Backend API must be ready before frontend integration", "Database schema needed for backend development"]
}
```

**Example Usage:**
- **Triggered:** During Stage I (Identify MVP) after tech stack suggestion
- **Location:** `src/ai/prompts.ts:73` - `workDistributionPrompt()` function
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## 5. MVP Feature Prioritization Prompt

**Purpose:** Categorizes features into must-have, nice-to-have, and out-of-scope for MVP.

**Input Variables:**
- `winningIdea.title` & `winningIdea.description` - The selected project
- `teamSize` - Number of team members (default: 3)
- `timeHours` - Available time (default: 24)

**Prompt Template:**
```
You are a hackathon MVP advisor helping teams scope their project.

Project: {winningIdea.title}
Description: {winningIdea.description}

Team: {teamSize} people, {timeHours} hours

Break this idea into features and categorize them:
- Must Have: 3-5 features that deliver core value
- Nice to Have: 2-3 features that would enhance it
- Out of Scope: Features that are too ambitious for the timeframe

Each feature should be achievable in 1-3 hours.

Respond in valid JSON format (no markdown, no code blocks):
{
  "mustHave": ["<feature1>", "<feature2>", "<feature3>"],
  "niceToHave": ["<feature4>", "<feature5>"],
  "outOfScope": ["<feature6>", "<feature7>"],
  "reasoning": "<why this scope makes sense>"
}
```

**Expected Output Format:**
```json
{
  "mustHave": [
    "Manual expense entry with amount and category",
    "Budget tracking dashboard showing spending vs. limit",
    "Basic XP system that rewards staying under budget",
    "Simple user authentication (email/password)"
  ],
  "niceToHave": [
    "Receipt photo scanning with OCR",
    "Social features (compare with friends)",
    "Custom budget categories"
  ],
  "outOfScope": [
    "Mobile app (focus on web first)",
    "Investment recommendations (too complex)",
    "Bank account integration (API approval takes too long)"
  ],
  "reasoning": "The must-haves deliver the core gamification value and are achievable in 15-18 hours, leaving buffer time for testing and deployment."
}
```

**Example Usage:**
- **Triggered:** Automatically during transition to Stage I (Identify MVP)
- **Location:** `src/HackMatchAgent.ts:514` - `generateMVPSuggestions()` method
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## AI Model Configuration

**Model Used:** `@cf/meta/llama-3.1-8b-instruct`

**Rationale for Model Choice:**
- Fast inference time (~2-3 seconds per request)
- Good balance of quality and speed for real-time brainstorming
- Available on Cloudflare Workers AI
- Handles JSON output reliably

**Note:** We attempted to use Llama 3.3 70B as specified in the original plan, but verified availability on Workers AI and used Llama 3.1 8B for better performance and reliability.

**Common Parameters:**
```typescript
{
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 1024-1500 (depending on expected response length),
  temperature: 0.7 (balanced creativity and consistency)
}
```

**Error Handling:**
- All AI calls are wrapped in try-catch blocks
- Fallback: If AI fails, the application continues without AI suggestions
- JSON parsing includes regex extraction to handle markdown code blocks
- Timeout: No explicit timeout set (relies on Workers AI defaults)

---

## Prompt Engineering Principles Used

1. **Clear Role Assignment:** Each prompt starts with "You are a [specific role]" to set context
2. **Explicit Constraints:** Always specify team size, time limits, and skill assumptions
3. **Numbered Considerations:** Provides structured thinking for the AI
4. **Strict Output Format:** Demands JSON with specific fields and no markdown
5. **Examples in Instructions:** Uses scoring scales (1-5) with explanations
6. **Real-World Context:** Mentions "hackathon" explicitly to prime domain knowledge

---

## Future Enhancements

Potential additional prompts for Phase 2:
- **Uniqueness Scoring:** Checks if idea is overdone (e.g., "Uber for X")
- **Prize Alignment:** Verifies idea meets sponsor challenge requirements
- **Impact Assessment:** Evaluates real-world value and user need
- **Risk Mitigation:** Suggests fallback plans for technical challenges

---

## License & Attribution

All prompts in this document are original work created for the cf_ai_hackmatch project. The prompts are designed specifically for the RAPID brainstorming framework used in hackathon settings.

**AI Model:** Cloudflare Workers AI - Llama 3.1 8B Instruct
**Platform:** Cloudflare Workers with Durable Objects
**Framework:** RAPID (Review, All Ideas, Prioritize, Identify MVP, Decide)
