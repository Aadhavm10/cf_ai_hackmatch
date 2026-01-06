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
  timeHours: number,
  teamMembers?: any[]
): string {
  const teamContext = teamMembers && teamMembers.length > 0
    ? teamMembers.map(m => {
        const skills = JSON.parse(m.skills);
        const experience = m.experience_level || m.experienceLevel;
        const name = m.user_name || m.userName;
        return `- ${name}: ${skills.join(', ')} (${experience})`;
      }).join('\n')
    : '- Team has general full-stack skills';

  return `You are a hackathon tech advisor helping teams choose their stack.

Winning Idea: ${winningIdea.title}
Description: ${winningIdea.description}

Team: ${teamSize} people, ${timeHours} hours available
Team Skills & Experience:
${teamContext}

Recommend a practical tech stack that matches the team's experience levels.
- If team is mostly beginners: suggest simpler, well-documented tools
- If team has advanced members: can suggest more sophisticated architectures
- Match tech to actual team skills when possible

Prioritize:
1. Technologies the team already knows
2. Quick to set up for their skill level
3. Well-documented, stable tools
4. Ease of deployment

Respond in valid JSON format (no markdown, no code blocks):
{
  "frontend": "<framework/library>",
  "backend": "<framework/runtime>",
  "database": "<database choice>",
  "deployment": "<hosting platform>",
  "reasoning": "<2-3 sentences explaining why this stack matches the team>",
  "learningRequired": "<any new tech team needs to learn>",
  "complexityLevel": "simple"
}`;
}

/**
 * Work Distribution Prompt
 * Assigns tasks to team members based on the MVP features
 */
export function workDistributionPrompt(
  winningIdea: Idea,
  features: string[],
  teamMembers: any[],
  timeHours: number
): string {
  const assignments = teamMembers.map(m => {
    const skills = JSON.parse(m.skills);
    const role = m.assigned_role || m.assignedRole || 'No role';
    const experience = m.experience_level || m.experienceLevel;
    const name = m.user_name || m.userName;
    return `- ${name}: ${role} (${experience}, skills: ${skills.join(', ')})`;
  }).join('\n');

  return `You are a hackathon project manager helping distribute work.

Project: ${winningIdea.title}
Must-Have Features: ${features.join(', ')}

Team Assignments:
${assignments}

Time: ${timeHours} hours

Distribute work based on assigned roles and skill levels.

Consider:
1. Assign tasks matching each member's role (Frontend/Backend/Database/Design)
2. Adjust task complexity to member's experience level
3. Dependencies (what must be built first?)
4. Parallel work (what can be done simultaneously?)
5. Beginners may need more time for tasks

Respond in valid JSON format (no markdown, no code blocks):
{
  "assignments": [
    {
      "userId": "<user_id>",
      "userName": "<name>",
      "role": "<their assigned role>",
      "tasks": ["<task1>", "<task2>"],
      "estimatedHours": <number>,
      "complexity": "easy",
      "supportNeeded": "<any help they might need>"
    }
  ],
  "timeline": "<hour-by-hour breakdown>",
  "dependencies": ["<what blocks what>"],
  "checkpoints": ["<milestones to sync on>"]
}`;
}

/**
 * Helper function to calculate average experience level
 */
function calculateAvgExperience(members: any[]): string {
  const levels: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
  const avg = members.reduce((sum, m) => {
    const level = m.experience_level || m.experienceLevel;
    return sum + (levels[level] || 2);
  }, 0) / members.length;
  if (avg < 1.5) return 'beginner';
  if (avg < 2.5) return 'intermediate';
  return 'advanced';
}

/**
 * Helper function to get unique team skills
 */
function getTeamSkills(members: any[]): string {
  const allSkills = members.flatMap(m => JSON.parse(m.skills));
  return [...new Set(allSkills)].join(', ');
}

/**
 * MVP Feature Prioritization Prompt
 * Helps categorize features into must-have, nice-to-have, and out-of-scope
 */
export function mvpPrioritizationPrompt(
  winningIdea: Idea,
  teamSize: number,
  timeHours: number,
  teamMembers?: any[]
): string {
  const avgExperience = teamMembers && teamMembers.length > 0
    ? calculateAvgExperience(teamMembers)
    : 'intermediate';

  const teamContext = teamMembers && teamMembers.length > 0
    ? `Average Experience: ${avgExperience}\nTeam has skills in: ${getTeamSkills(teamMembers)}`
    : 'Team has general hackathon skills';

  return `You are a hackathon MVP advisor helping teams scope their project.

Project: ${winningIdea.title}
Description: ${winningIdea.description}

Team: ${teamSize} people, ${timeHours} hours
${teamContext}

Break this idea into features and categorize them based on team's experience level.

IMPORTANT - Experience-Aware Scoping:
- For beginner teams: Keep features simple, avoid complex integrations
- For intermediate teams: Balance core features with 1-2 stretch goals
- For advanced teams: Can include more sophisticated features

Categorize features:
- Must Have: 3-5 features that deliver core value (achievable for this team's level)
- Nice to Have: 2-3 features that would enhance it (appropriate stretch goals)
- Out of Scope: Features too ambitious for timeframe OR team experience

Each feature should be achievable in 1-3 hours for THIS team's skill level.

Respond in valid JSON format (no markdown, no code blocks):
{
  "mustHave": ["<feature1>", "<feature2>", "<feature3>"],
  "niceToHave": ["<feature4>", "<feature5>"],
  "outOfScope": ["<feature6>", "<feature7>"],
  "reasoning": "<why this scope matches the team's experience>",
  "experienceAdjustments": "<what was simplified or enhanced based on team level>"
}`;
}

/**
 * Track Validation Prompt
 * Validates if selected tracks are a good fit for team's skills
 */
export function trackValidationPrompt(
  selectedTracks: string[],
  teamMembers: any[],
  hackathonRules?: string
): string {
  const teamSkills = teamMembers.map(m => ({
    name: m.user_name || m.userName,
    skills: JSON.parse(m.skills),
    experience: m.experience_level || m.experienceLevel
  }));

  return `You are a hackathon strategy advisor helping teams choose the right tracks.

Team Composition:
${teamSkills.map(t => `- ${t.name}: ${t.skills.join(', ')} (${t.experience})`).join('\n')}

Selected Tracks: ${selectedTracks.join(', ')}
${hackathonRules ? `Hackathon Rules:\n${hackathonRules}` : ''}

Analyze if the selected tracks are a good fit for this team's skills and experience.

Respond in valid JSON format (no markdown, no code blocks):
{
  "overallFit": "excellent",
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
}`;
}

/**
 * Role Allocation Prompt
 * Suggests role assignments based on team member profiles
 */
export function roleAllocationPrompt(
  teamMembers: any[],
  winningIdea?: Idea
): string {
  const profiles = teamMembers.map(m => ({
    name: m.user_name || m.userName,
    userId: m.user_id || m.userId,
    skills: JSON.parse(m.skills),
    experience: m.experience_level || m.experienceLevel,
    preferredRole: m.preferred_role || m.preferredRole
  }));

  return `You are a hackathon team coordinator assigning roles.

Team Members:
${profiles.map(p =>
  `- ${p.name} (ID: ${p.userId})
    Skills: ${p.skills.join(', ')}
    Experience: ${p.experience}
    Prefers: ${p.preferredRole || 'No preference'}`
).join('\n')}

${winningIdea ? `Project: ${winningIdea.title}\n${winningIdea.description}` : 'Project not yet decided'}

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
}`;
}
