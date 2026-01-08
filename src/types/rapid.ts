// RAPID Stage types
export type RAPIDStage = 'R' | 'A' | 'P' | 'PRD' | 'D';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  sponsor?: string;
  prize?: number;
}

export interface Idea {
  id: number;
  userId: string;
  userName: string;
  title: string;
  description: string;
  phase: 'silent' | 'group';
  createdAt: number;
}

export interface IdeaScore {
  id: number;
  ideaId: number;
  userId: string;
  criterion: 'feasibility' | 'uniqueness' | 'alignment' | 'impact';
  score: number; // 1-5
  createdAt: number;
}

export interface AIFeasibilityScore {
  score: number; // 1-5
  reasoning: string;
  risks: string[];
  recommendations: string[];
}

export interface MVPFeature {
  id: number;
  featureName: string;
  featureDescription?: string;
  category: 'must_have' | 'nice_to_have' | 'out_of_scope';
  sortOrder: number;
  createdAt: number;
}

export interface TechStack {
  frontend: string;
  backend: string;
  database: string;
  deployment: string;
  reasoning: string;
}

export interface WorkAssignment {
  id: number;
  userId: string;
  userName: string;
  taskTitle: string;
  taskDescription?: string;
  estimatedHours?: number;
  createdAt: number;
}

export interface Message {
  id: number;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  messageType: 'user' | 'ai' | 'system';
}

export interface TeamMember {
  id: number;
  userId: string;
  userName: string;
  skills: string; // JSON array
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredRole?: string;
  assignedRole?: string;
  joinedAt: number;
}

export interface HackathonSetup {
  id: number;
  teamSize?: number;
  rulesText?: string;
  timeHours: number;
  sponsorName?: string;
  sponsorDetails?: string;
  primaryTrack?: string;
  selectedTracks?: string; // JSON array
  trackValidation?: string; // JSON
  profilesComplete: number;
  setupComplete: number;
  createdAt?: number;
}

export interface PRDQuestion {
  id: number;
  questionKey: string;
  questionText: string;
  answerText?: string;
  sortOrder: number;
  answered: number;
  createdAt: number;
}

export interface PRDDocument {
  id: number;
  winningIdeaId: number;
  problemStatement?: string;
  solutionOverview?: string;
  targetUsers?: string;
  coreFeatures?: string; // JSON array
  techStack?: string; // JSON object
  timeline?: string; // JSON object
  successCriteria?: string; // JSON array
  constraints?: string;
  generatedAt?: number;
  prdComplete: number;
}
