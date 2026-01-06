import type { AIBinding } from './ai/client.js';
import { WorkersAIClient } from './ai/client.js';
import {
  feasibilityPrompt,
  techStackPrompt,
  mvpPrioritizationPrompt,
} from './ai/prompts.js';
import type {
  RAPIDStage,
  Idea,
  Message,
  Challenge,
  TechStack,
  AIFeasibilityScore,
} from './types/rapid.js';

export interface Env {
  AI: AIBinding;
  HACKMATCH_AGENT: DurableObjectNamespace;
}

/**
 * HackMatch Agent - Manages a hackathon brainstorming room using Durable Objects
 * Guides teams through the RAPID framework (Review, All Ideas, Prioritize, Identify MVP, Decide)
 */
export class HackMatchAgent implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private aiClient: WorkersAIClient;
  private roomId: string = '';
  private sessions: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.aiClient = new WorkersAIClient(env.AI);

    // Initialize database schema
    this.state.blockConcurrencyWhile(async () => {
      await this.initDatabase();
    });
  }

  /**
   * Initialize SQLite database with schema
   */
  private async initDatabase() {
    // Inline schema
    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS room_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        room_id TEXT NOT NULL,
        current_stage TEXT NOT NULL CHECK (current_stage IN ('R', 'A', 'P', 'I', 'D')),
        selected_challenges TEXT,
        winning_idea_id INTEGER,
        tech_stack TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `INSERT OR IGNORE INTO room_state (id, room_id, current_stage, created_at, updated_at)
       VALUES (1, '', 'R', 0, 0)`,
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        message_type TEXT DEFAULT 'user' CHECK (message_type IN ('user', 'ai', 'system'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`,
      `CREATE TABLE IF NOT EXISTS ideas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        phase TEXT NOT NULL CHECK (phase IN ('silent', 'group')),
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ideas_phase ON ideas(phase)`,
      `CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idea_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        criterion TEXT NOT NULL CHECK (criterion IN ('feasibility', 'uniqueness', 'alignment', 'impact')),
        score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
        created_at INTEGER NOT NULL,
        UNIQUE(idea_id, user_id, criterion)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_scores_idea ON scores(idea_id)`,
      `CREATE TABLE IF NOT EXISTS ai_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        suggestion_type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_type ON ai_suggestions(suggestion_type)`,
      `CREATE TABLE IF NOT EXISTS mvp_features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_name TEXT NOT NULL,
        feature_description TEXT,
        category TEXT NOT NULL CHECK (category IN ('must_have', 'nice_to_have', 'out_of_scope')),
        sort_order INTEGER,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS challenges (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        sponsor TEXT,
        prize REAL,
        created_at INTEGER NOT NULL
      )`,
    ];

    for (const statement of schemaStatements) {
      try {
        await this.state.storage.sql.exec(statement);
      } catch (error) {
        console.error('Schema init error:', error);
      }
    }

    // Set room ID if not already set
    const result = await this.state.storage.sql
      .exec('SELECT room_id FROM room_state WHERE id = 1')
      .toArray();

    if (result.length > 0 && !result[0].room_id) {
      this.roomId = this.generateRoomId();
      const now = Date.now();
      await this.state.storage.sql.exec(
        `UPDATE room_state SET room_id = ?, created_at = ?, updated_at = ? WHERE id = 1`,
        this.roomId,
        now,
        now
      );
    } else if (result.length > 0) {
      this.roomId = result[0].room_id as string;
    }
  }

  /**
   * Generate a unique room ID
   */
  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  /**
   * Handle HTTP/WebSocket requests
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle HTTP API requests
    const url = new URL(request.url);

    if (url.pathname.endsWith('/state') && request.method === 'GET') {
      const state = await this.getRoomState();
      return new Response(JSON.stringify(state), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('HackMatch Agent', { status: 200 });
  }

  /**
   * Handle WebSocket connection
   */
  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.sessions.add(server);

    // Send initial state to new client
    server.addEventListener('open', async () => {
      const state = await this.getRoomState();
      const ideas = await this.getIdeas();
      const messages = await this.getMessages();

      server.send(
        JSON.stringify({
          type: 'initialState',
          payload: {
            ...state,
            ideas,
            messages,
          },
        })
      );
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : null;
      if (!data) return;

      // Route message based on type
      switch (data.type) {
        case 'sendMessage':
          await this.sendMessage(
            data.payload.userId,
            data.payload.userName,
            data.payload.content
          );
          break;

        case 'submitIdea':
          await this.submitIdea(
            data.payload.userId,
            data.payload.userName,
            data.payload.title,
            data.payload.description,
            data.payload.phase
          );
          break;

        case 'scoreIdea':
          await this.scoreIdea(
            data.payload.userId,
            data.payload.ideaId,
            data.payload.criterion,
            data.payload.score
          );
          break;

        case 'transitionStage':
          await this.transitionStage();
          break;

        case 'updateChallenges':
          await this.updateChallenges(data.payload.challenges);
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message' } }));
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws);
    ws.close();
  }

  /**
   * Get current room state
   */
  private async getRoomState() {
    const result = await this.state.storage.sql
      .exec('SELECT * FROM room_state WHERE id = 1')
      .toArray();

    if (result.length === 0) return null;

    const state = result[0];
    return {
      roomId: state.room_id,
      currentStage: state.current_stage,
      selectedChallenges: state.selected_challenges
        ? JSON.parse(state.selected_challenges as string)
        : [],
      winningIdeaId: state.winning_idea_id,
      techStack: state.tech_stack ? JSON.parse(state.tech_stack as string) : null,
    };
  }

  /**
   * Send a chat message
   */
  private async sendMessage(userId: string, userName: string, content: string) {
    const timestamp = Date.now();

    await this.state.storage.sql.exec(
      `INSERT INTO messages (user_id, user_name, content, timestamp, message_type)
       VALUES (?, ?, ?, ?, 'user')`,
      userId,
      userName,
      content,
      timestamp
    );

    this.broadcast({
      type: 'message',
      payload: { userId, userName, content, timestamp, messageType: 'user' },
    });
  }

  /**
   * Submit an idea
   */
  private async submitIdea(
    userId: string,
    userName: string,
    title: string,
    description: string,
    phase: 'silent' | 'group'
  ) {
    const createdAt = Date.now();

    await this.state.storage.sql.exec(
      `INSERT INTO ideas (user_id, user_name, title, description, phase, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      userId,
      userName,
      title,
      description,
      phase,
      createdAt
    );

    const result = await this.state.storage.sql
      .exec('SELECT last_insert_rowid() as id')
      .toArray();
    const ideaId = result[0].id as number;

    const idea: Idea = {
      id: ideaId,
      userId,
      userName,
      title,
      description,
      phase,
      createdAt,
    };

    this.broadcast({ type: 'idea', payload: idea });
  }

  /**
   * Score an idea
   */
  private async scoreIdea(
    userId: string,
    ideaId: number,
    criterion: 'feasibility',
    score: number
  ) {
    if (score < 1 || score > 5) {
      throw new Error('Score must be between 1 and 5');
    }

    const createdAt = Date.now();

    await this.state.storage.sql.exec(
      `INSERT INTO scores (idea_id, user_id, criterion, score, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(idea_id, user_id, criterion) DO UPDATE SET score = ?, created_at = ?`,
      ideaId,
      userId,
      criterion,
      score,
      createdAt,
      score,
      createdAt
    );

    await this.broadcastIdeaScores(ideaId);

    // Trigger AI scoring
    await this.scoreIdeaWithAI(ideaId);
  }

  /**
   * Get AI-powered feasibility score
   */
  private async scoreIdeaWithAI(ideaId: number): Promise<void> {
    const ideaResult = await this.state.storage.sql
      .exec('SELECT * FROM ideas WHERE id = ?', ideaId)
      .toArray();

    if (ideaResult.length === 0) return;

    const idea: Idea = {
      id: ideaResult[0].id as number,
      userId: ideaResult[0].user_id as string,
      userName: ideaResult[0].user_name as string,
      title: ideaResult[0].title as string,
      description: ideaResult[0].description as string,
      phase: ideaResult[0].phase as 'silent' | 'group',
      createdAt: ideaResult[0].created_at as number,
    };

    try {
      const prompt = feasibilityPrompt(idea, 3, 24);
      const aiScore = await this.aiClient.generateJSON<AIFeasibilityScore>(prompt);

      await this.state.storage.sql.exec(
        `INSERT INTO ai_suggestions (suggestion_type, content, metadata, created_at)
         VALUES ('feasibility_score', ?, ?, ?)`,
        JSON.stringify(aiScore),
        JSON.stringify({ ideaId }),
        Date.now()
      );

      this.broadcast({
        type: 'aiSuggestion',
        payload: {
          type: 'feasibility_score',
          ideaId,
          data: aiScore,
        },
      });
    } catch (error) {
      console.error('AI scoring failed:', error);
    }
  }

  /**
   * Broadcast scores for an idea
   */
  private async broadcastIdeaScores(ideaId: number) {
    const scoresResult = await this.state.storage.sql
      .exec('SELECT * FROM scores WHERE idea_id = ?', ideaId)
      .toArray();

    this.broadcast({
      type: 'score',
      payload: { ideaId, scores: scoresResult },
    });
  }

  /**
   * Transition to next RAPID stage
   */
  private async transitionStage() {
    const state = await this.getRoomState();
    if (!state) return;

    const stages: RAPIDStage[] = ['R', 'A', 'P', 'I', 'D'];
    const currentIndex = stages.indexOf(state.currentStage as RAPIDStage);

    if (currentIndex === stages.length - 1) {
      throw new Error('Already at final stage');
    }

    const nextStage = stages[currentIndex + 1];

    await this.state.storage.sql.exec(
      `UPDATE room_state SET current_stage = ?, updated_at = ? WHERE id = 1`,
      nextStage,
      Date.now()
    );

    this.broadcast({
      type: 'stateUpdate',
      payload: { currentStage: nextStage },
    });

    if (nextStage === 'I') {
      await this.generateMVPSuggestions();
    }
  }

  /**
   * Generate MVP suggestions
   */
  private async generateMVPSuggestions() {
    const state = await this.getRoomState();

    // Get top idea
    const topIdeaResult = await this.state.storage.sql.exec(`
      SELECT idea_id, SUM(score) as total_score
      FROM scores
      GROUP BY idea_id
      ORDER BY total_score DESC
      LIMIT 1
    `).toArray();

    if (topIdeaResult.length === 0) return;

    const winningIdeaId = topIdeaResult[0].idea_id as number;

    const ideaResult = await this.state.storage.sql
      .exec('SELECT * FROM ideas WHERE id = ?', winningIdeaId)
      .toArray();

    if (ideaResult.length === 0) return;

    const idea: Idea = {
      id: ideaResult[0].id as number,
      userId: ideaResult[0].user_id as string,
      userName: ideaResult[0].user_name as string,
      title: ideaResult[0].title as string,
      description: ideaResult[0].description as string,
      phase: ideaResult[0].phase as 'silent' | 'group',
      createdAt: ideaResult[0].created_at as number,
    };

    try {
      const mvpPrompt = mvpPrioritizationPrompt(idea, 3, 24);
      const mvpSuggestion = await this.aiClient.generateJSON<{
        mustHave: string[];
        niceToHave: string[];
        outOfScope: string[];
        reasoning: string;
      }>(mvpPrompt);

      const techPrompt = techStackPrompt(idea, 3, 24);
      const techStack = await this.aiClient.generateJSON<TechStack>(techPrompt);

      await this.state.storage.sql.exec(
        `UPDATE room_state SET tech_stack = ?, winning_idea_id = ? WHERE id = 1`,
        JSON.stringify(techStack),
        winningIdeaId
      );

      this.broadcast({
        type: 'aiSuggestion',
        payload: {
          type: 'mvp_features',
          data: { ...mvpSuggestion, techStack },
        },
      });
    } catch (error) {
      console.error('MVP generation failed:', error);
    }
  }

  /**
   * Update challenges
   */
  private async updateChallenges(challenges: Challenge[]) {
    for (const challenge of challenges) {
      await this.state.storage.sql.exec(
        `INSERT OR REPLACE INTO challenges (id, title, description, sponsor, prize, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        challenge.id,
        challenge.title,
        challenge.description,
        challenge.sponsor || null,
        challenge.prize || null,
        Date.now()
      );
    }

    const challengeIds = challenges.map((c) => c.id);
    await this.state.storage.sql.exec(
      `UPDATE room_state SET selected_challenges = ? WHERE id = 1`,
      JSON.stringify(challengeIds)
    );

    this.broadcast({
      type: 'stateUpdate',
      payload: { challenges },
    });
  }

  /**
   * Get all ideas
   */
  private async getIdeas(): Promise<Idea[]> {
    const result = await this.state.storage.sql.exec('SELECT * FROM ideas').toArray();
    return result.map((row) => ({
      id: row.id as number,
      userId: row.user_id as string,
      userName: row.user_name as string,
      title: row.title as string,
      description: row.description as string,
      phase: row.phase as 'silent' | 'group',
      createdAt: row.created_at as number,
    }));
  }

  /**
   * Get all messages
   */
  private async getMessages(): Promise<Message[]> {
    const result = await this.state.storage.sql
      .exec('SELECT * FROM messages ORDER BY timestamp')
      .toArray();
    return result.map((row) => ({
      id: row.id as number,
      userId: row.user_id as string,
      userName: row.user_name as string,
      content: row.content as string,
      timestamp: row.timestamp as number,
      messageType: row.message_type as 'user' | 'ai' | 'system',
    }));
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((session) => {
      try {
        session.send(messageStr);
      } catch (error) {
        console.error('Broadcast error:', error);
      }
    });
  }
}

export default HackMatchAgent;
