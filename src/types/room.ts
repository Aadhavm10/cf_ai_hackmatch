import type { RAPIDStage, Challenge, TechStack } from './rapid.js';

export interface RoomState {
  roomId: string;
  currentStage: RAPIDStage;
  selectedChallenges: string[]; // JSON array of challenge IDs
  winningIdeaId: number | null;
  techStack: TechStack | null;
  createdAt: number;
  updatedAt: number;
}

export interface Participant {
  userId: string;
  userName: string;
  joinedAt: number;
}

// Client -> Agent messages
export interface ClientMessage {
  type: 'sendMessage' | 'submitIdea' | 'scoreIdea' | 'transitionStage' | 'submitFeature' | 'updateChallenge' | 'voteDecide';
  payload: any;
}

// Agent -> Client messages
export interface ServerMessage {
  type: 'stateUpdate' | 'message' | 'idea' | 'score' | 'aiSuggestion' | 'error';
  payload: any;
}
