import type { Idea, AIFeasibilityScore, TechStack } from '../types/rapid.js';

/**
 * Feasibility Scoring Prompt
 * Assesses whether an idea can be built within hackathon constraints
 */
export function feasibilityPrompt(
  idea: Idea,
  teamSize: number,
  timeHours: number
): string {
  return `You are a technical feasibility assessor for hackathon ideas.

Idea Title: ${idea.title}
Description: ${idea.description}

Team Context:
- Team Size: ${teamSize} people
- Time Available: ${timeHours} hours
- Typical hackathon skills: Web dev, APIs, databases, some AI/ML

Rate the feasibility of building this idea within the given constraints.

Consider:
1. Can the core functionality be built in ${timeHours} hours?
2. What are the main technical risks?
3. Are there known pitfalls with this type of project?
4. Is the scope realistic for a hackathon?

Respond in valid JSON format (no markdown, no code blocks):
{
  "score": <number 1-5, where 5=very feasible, 1=impossible>,
  "reasoning": "<2-3 sentences explaining the score>",
  "risks": ["<risk1>", "<risk2>"],
  "recommendations": ["<suggestion1>", "<suggestion2>"]
}`;
}

/**
 * Idea Combination Prompt
 * Suggests creative ways to combine two ideas
 */
export function ideaCombinationPrompt(idea1: Idea, idea2: Idea): string {
  return `You are a creative hackathon mentor helping teams brainstorm.

Idea 1: ${idea1.title}
${idea1.description}

Idea 2: ${idea2.title}
${idea2.description}

Suggest an innovative way to combine these two ideas into something unique.

Respond in valid JSON format (no markdown, no code blocks):
{
  "title": "<catchy combined idea name>",
  "description": "<1-2 sentences describing the combination>",
  "uniqueValue": "<what makes this combination special>"
}`;
}

/**
 * Tech Stack Suggestion Prompt
 * Recommends appropriate technologies for the winning idea
 */
export function techStackPrompt(
  winningIdea: Idea,
  teamSize: number,
  timeHours: number
): string {
  return `You are a hackathon tech advisor helping teams choose their stack.

Winning Idea: ${winningIdea.title}
Description: ${winningIdea.description}

Team: ${teamSize} people, ${timeHours} hours available

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
}`;
}

/**
 * Work Distribution Prompt
 * Assigns tasks to team members based on the MVP features
 */
export function workDistributionPrompt(
  winningIdea: Idea,
  features: string[],
  teamSize: number,
  timeHours: number
): string {
  return `You are a hackathon project manager helping distribute work.

Project: ${winningIdea.title}
Must-Have Features: ${features.join(', ')}

Team: ${teamSize} people
Time: ${timeHours} hours

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
}`;
}

/**
 * MVP Feature Prioritization Prompt
 * Helps categorize features into must-have, nice-to-have, and out-of-scope
 */
export function mvpPrioritizationPrompt(
  winningIdea: Idea,
  teamSize: number,
  timeHours: number
): string {
  return `You are a hackathon MVP advisor helping teams scope their project.

Project: ${winningIdea.title}
Description: ${winningIdea.description}

Team: ${teamSize} people, ${timeHours} hours

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
}`;
}
