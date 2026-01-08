# AI Prompts Used in HackMatch

This document details all AI prompts used in the cf_ai_hackmatch project, as required by the Cloudflare AI assignment.

## Overview

HackMatch uses Workers AI (Llama 3.1-8b-instruct) to provide intelligent assistance during hackathon brainstorming sessions. The AI helps teams:
- Assess idea feasibility
- Combine ideas creatively
- Suggest appropriate tech stacks
- Prioritize MVP features
- Distribute work among team members
- Generate PRD questions and documents
- Validate track selections
- Allocate team roles

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
- **Location:** `src/HackMatchAgent.ts` - `generateMVPSuggestions()` method
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## 6. Track Validation Prompt

**Purpose:** Validates if selected hackathon tracks are a good fit for the team's skills and experience.

**Input Variables:**
- `selectedTracks` - Array of track names selected by the team
- `teamMembers` - Array of team member objects (with skills and experience level)
- `hackathonRules` - Optional rules/constraints text

**Prompt Template:**
```
You are a hackathon strategy advisor helping teams choose the right tracks.

Team Composition:
[For each member: name, skills, experience level]

Selected Tracks: [track names]
Hackathon Rules: [if provided]

Analyze if the selected tracks are a good fit for this team's skills and experience.

Respond in valid JSON format (no markdown, no code blocks):
{
  "overallFit": "excellent" | "good" | "fair" | "poor",
  "trackAnalysis": [
    {
      "trackName": "<track name>",
      "fitScore": <1-5>,
      "reasoning": "<why this track fits or doesn't fit the team>",
      "requiredSkills": ["<skill1>", "<skill2>"],
      "teamCoverage": "<which team members have relevant skills>"
    }
  ],
  "recommendations": "<overall advice on track selection>",
  "alternativeTracks": ["<suggestion1>", "<suggestion2>"]
}
```

**Example Output:**
```json
{
  "overallFit": "good",
  "trackAnalysis": [
    {
      "trackName": "Best Use of AI",
      "fitScore": 3,
      "reasoning": "Team has Python skills but no ML experience. Feasible with pre-trained models.",
      "requiredSkills": ["Python", "ML/AI frameworks", "API integration"],
      "teamCoverage": "Alice has Python, no one has ML experience"
    }
  ],
  "recommendations": "Focus on using existing AI APIs rather than building models from scratch",
  "alternativeTracks": ["Best Design", "Social Impact"]
}
```

**Example Usage:**
- **Triggered:** During Stage R (Review) when user requests track validation
- **Location:** `src/HackMatchAgent.ts` - `validateTracks()` method
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## 7. Role Allocation Prompt

**Purpose:** Suggests role assignments (Frontend, Backend, Database, Design) based on team member profiles.

**Input Variables:**
- `teamMembers` - Array of team member objects (skills, experience, preferred role)
- `winningIdea` - Optional winning idea object (if decided)

**Prompt Template:**
```
You are a hackathon team coordinator assigning roles.

Team Members:
[For each member: name, ID, skills, experience level, preferred role]

Project: [if decided, show title and description]

Assign roles: Frontend, Backend, Database, Design

Consider:
1. Respect preferred roles when skills match
2. Balance workload across team members
3. Match experience levels to complexity
4. Some members may take multiple roles if team is small

Respond in valid JSON format (no markdown, no code blocks):
{
  "assignments": [
    {
      "userId": "<user_id>",
      "userName": "<name>",
      "assignedRole": "Frontend",
      "reasoning": "<why this assignment makes sense>",
      "matchesPreference": true
    }
  ],
  "teamBalance": "<assessment of overall role distribution>",
  "suggestions": "<any advice for collaboration>"
}
```

**Example Output:**
```json
{
  "assignments": [
    {
      "userId": "user123",
      "userName": "Alice",
      "assignedRole": "Frontend",
      "reasoning": "Strong React skills match project needs, aligns with preference",
      "matchesPreference": true
    },
    {
      "userId": "user456",
      "userName": "Bob",
      "assignedRole": "Backend",
      "reasoning": "Python and API experience perfect for backend, though prefers full-stack",
      "matchesPreference": false
    }
  ],
  "teamBalance": "Good coverage with clear separation of concerns",
  "suggestions": "Consider pair programming sessions for knowledge sharing"
}
```

**Example Usage:**
- **Triggered:** During Stage I (Identify MVP) when user requests role allocation
- **Location:** `src/HackMatchAgent.ts` - `allocateRoles()` method
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## 8. PRD Question Generation Prompt

**Purpose:** Generates contextual questions to guide teams through creating a Product Requirements Document (PRD).

**Input Variables:**
- `winningIdea.title` & `winningIdea.description` - The selected project
- `questionNumber` - Current question (1-6)
- `previousAnswers` - Array of previous Q&A pairs
- `hackathonSetup` - Team size, time available, primary track, rules

**Prompt Template:**
```
You are a hackathon mentor helping a team create a comprehensive PRD (Product Requirements Document).

Winning Idea: {winningIdea.title}
Description: {winningIdea.description}

Hackathon Context:
- Team Size: {teamSize} people
- Time Available: {timeHours} hours
- Primary Track: {primaryTrack}
- Rules: {rulesText if provided}

Previous Q&A:
[If questions already answered, list them here]

This is question {questionNumber} of 6 total questions to build the PRD.

Focus Areas for Questions:
1. Problem Statement (What problem are you solving? Who has this problem?)
2. Target Users (Who will use this? What are their pain points?)
3. Core Features (What are the must-have features for the MVP?)
4. Technical Constraints (Any technical limitations or requirements?)
5. Success Criteria (How will you know if this is successful?)
6. Timeline Breakdown (How will you divide the {timeHours} hours?)

Generate a thoughtful, contextual question that:
- Builds on previous answers if applicable
- Helps the team think deeply about their project
- Is specific and actionable
- Relates to the hackathon constraints

Respond in valid JSON format (no markdown, no code blocks):
{
  "questionKey": "<one of: problem_statement, target_users, core_features, constraints, success_criteria, timeline>",
  "questionText": "<the actual question to ask the team>",
  "reasoning": "<1 sentence on why this question is important>"
}
```

**Expected Output Format:**
```json
{
  "questionKey": "problem_statement",
  "questionText": "What specific pain point does your budget gamification app solve that existing expense trackers don't address?",
  "reasoning": "Understanding the unique problem helps differentiate the solution from existing apps"
}
```

**Example Usage:**
- **Triggered:** During Stage PRD after a winning idea is selected
- **Location:** `src/HackMatchAgent.ts:1236` - `askNextPRDQuestion()` method
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## 9. PRD Document Generation Prompt

**Purpose:** Synthesizes all 6 Q&A responses into a comprehensive Product Requirements Document.

**Input Variables:**
- `winningIdea` - The selected project
- `qaList` - Array of all 6 question-answer pairs
- `hackathonSetup` - Team size, time available, primary track, rules
- `techStack` - Optional recommended tech stack

**Prompt Template:**
```
You are a technical product manager creating a comprehensive PRD for a hackathon project.

Project: {winningIdea.title}
Description: {winningIdea.description}

Hackathon Context:
- Team Size: {teamSize} people
- Time Available: {timeHours} hours
- Primary Track: {primaryTrack}
- Rules: {rulesText if provided}

Team's Answers to PRD Questions:
Q: {question1}
A: {answer1}

Q: {question2}
A: {answer2}
[... all 6 Q&A pairs ...]

Recommended Tech Stack:
- Frontend: {frontend}
- Backend: {backend}
- Database: {database}
- Deployment: {deployment}

Synthesize all this information into a comprehensive PRD document.

The PRD should be:
- Clear and actionable
- Realistic for the hackathon timeframe
- Aligned with the team's answers
- Professional but concise

Respond in valid JSON format (no markdown, no code blocks):
{
  "problemStatement": "<2-3 sentences describing the problem>",
  "solutionOverview": "<2-3 sentences describing the solution>",
  "targetUsers": "<1-2 sentences describing who will use this>",
  "keyFeatures": ["<feature1>", "<feature2>", "<feature3>"],
  "technicalApproach": "<2-3 sentences on how it will be built>",
  "successMetrics": ["<metric1>", "<metric2>"],
  "timeline": {
    "phase1": "<hours X-Y: what to build>",
    "phase2": "<hours Y-Z: what to build>",
    "phase3": "<hours Z-end: what to build>"
  }
}
```

**Expected Output Format:**
```json
{
  "problemStatement": "College students struggle to stick to budgets because traditional expense trackers are boring and lack motivation. There's no reward system for good financial behavior.",
  "solutionOverview": "Budget Battle Royale gamifies expense tracking by awarding XP for staying under budget, creating a competitive multiplayer experience where users level up by making smart financial choices.",
  "targetUsers": "College students aged 18-24 who want to manage money better but find traditional budgeting apps too tedious.",
  "keyFeatures": [
    "Manual expense entry with category selection",
    "XP system that rewards staying under budget",
    "Budget dashboard showing spending vs. limits",
    "User authentication and profile"
  ],
  "technicalApproach": "React frontend with Vite for fast development, Express.js backend with MongoDB for flexible data storage, deployed on Vercel (frontend) and Railway (backend).",
  "successMetrics": [
    "Users can track expenses and see budget status within 2 clicks",
    "XP system correctly awards points for under-budget behavior",
    "App loads in under 2 seconds"
  ],
  "timeline": {
    "phase1": "Hours 0-8: Set up React project, Express backend, MongoDB schema, basic auth",
    "phase2": "Hours 8-18: Build expense entry, budget tracking, XP calculation logic",
    "phase3": "Hours 18-24: Integration, testing, deployment, polish"
  }
}
```

**Example Usage:**
- **Triggered:** After all 6 PRD questions are answered
- **Location:** `src/HackMatchAgent.ts:1394` - `generateFinalPRD()` method
- **Model:** `@cf/meta/llama-3.1-8b-instruct`

---

## Experience-Aware Prompt Enhancements

The following existing prompts have been enhanced to consider team experience levels:

### Tech Stack Prompt (Enhanced)
- Now accepts optional `teamMembers` parameter
- Recommends tech stack matching team's actual skills
- Adjusts complexity based on experience levels
- Returns `learningRequired` and `complexityLevel` fields

### MVP Prioritization Prompt (Enhanced)
- Now accepts optional `teamMembers` parameter
- Calculates average team experience level
- Adjusts feature scope based on team capabilities
- Returns `experienceAdjustments` field explaining simplifications/enhancements

### Work Distribution Prompt (Enhanced)
- Now requires `teamMembers` array instead of just team size
- Assigns tasks based on assigned roles
- Adjusts task complexity to individual experience levels
- Returns `complexity` and `supportNeeded` for each assignment

---

## AI Model Configuration

**Model Used:** `@cf/meta/llama-3.1-8b-instruct`

**Rationale for Model Choice:**
- Fast inference time for real-time hackathon workflow
- Good balance between capability and cost
- Excellent at following JSON formatting instructions
- Available on Cloudflare Workers AI
- Handles complex reasoning tasks reliably
- 8B parameter size provides quality output while maintaining speed

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

## Summary

This document includes **9 comprehensive AI prompts** that power the HackMatch platform:

1. **Feasibility Scoring** - Evaluates if ideas can be built in time
2. **Idea Combination** - Merges two ideas creatively
3. **Tech Stack Suggestion** - Recommends appropriate technologies
4. **Work Distribution** - Assigns tasks to team members
5. **MVP Feature Prioritization** - Categorizes features into must/nice/out-of-scope
6. **Track Validation** - Validates hackathon track selections
7. **Role Allocation** - Assigns team roles based on skills
8. **PRD Question Generation** - Creates contextual questions for PRD (6 questions total)
9. **PRD Document Generation** - Synthesizes Q&A into final PRD

All prompts follow strict JSON output formatting and are optimized for the Llama 3.1-8b-instruct model on Workers AI.

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
**Framework:** RAPID (Review, All Ideas, Prioritize, PRD, Identify MVP, Decide)
