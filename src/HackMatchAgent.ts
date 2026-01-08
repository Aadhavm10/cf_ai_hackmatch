import type { AIBinding } from './ai/client.js';
import { WorkersAIClient } from './ai/client.js';
import {
  feasibilityPrompt,
  techStackPrompt,
  mvpPrioritizationPrompt,
  trackValidationPrompt,
  roleAllocationPrompt,
  prdQuestionPrompt,
  prdGenerationPrompt,
} from './ai/prompts.js';
import type {
  RAPIDStage,
  Idea,
  Message,
  Challenge,
  TechStack,
  AIFeasibilityScore,
  TeamMember,
  HackathonSetup,
  PRDQuestion,
  PRDDocument,
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
        current_stage TEXT NOT NULL CHECK (current_stage IN ('R', 'A', 'P', 'PRD', 'D')),
        selected_challenges TEXT,
        winning_idea_id INTEGER,
        tech_stack TEXT,
        setup_phase TEXT DEFAULT 'hackathon_info' CHECK (setup_phase IN ('hackathon_info', 'team_profiles', 'track_validation', 'complete')),
        prd_question_count INTEGER DEFAULT 0,
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
      `CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        user_name TEXT NOT NULL,
        skills TEXT NOT NULL,
        experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
        preferred_role TEXT,
        assigned_role TEXT,
        joined_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)`,
      `CREATE TABLE IF NOT EXISTS hackathon_setup (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        team_size INTEGER,
        rules_text TEXT,
        time_hours INTEGER DEFAULT 24,
        sponsor_name TEXT,
        sponsor_details TEXT,
        primary_track TEXT,
        selected_tracks TEXT,
        track_validation TEXT,
        profiles_complete INTEGER DEFAULT 0,
        setup_complete INTEGER DEFAULT 0,
        created_at INTEGER
      )`,
      `INSERT OR IGNORE INTO hackathon_setup (id) VALUES (1)`,
      `CREATE TABLE IF NOT EXISTS prd_qa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_key TEXT NOT NULL,
        question_text TEXT NOT NULL,
        answer_text TEXT,
        sort_order INTEGER NOT NULL,
        answered INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_prd_qa_order ON prd_qa(sort_order)`,
      `CREATE TABLE IF NOT EXISTS prd_document (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        winning_idea_id INTEGER NOT NULL,
        problem_statement TEXT,
        solution_overview TEXT,
        target_users TEXT,
        core_features TEXT,
        tech_stack TEXT,
        timeline TEXT,
        success_criteria TEXT,
        constraints TEXT,
        generated_at INTEGER,
        prd_complete INTEGER DEFAULT 0
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
  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket with Durable Objects runtime
    this.state.acceptWebSocket(server);

    console.log('[BACKEND] WebSocket accepted');
    console.log('[BACKEND] Total active WebSockets:', this.state.getWebSockets().length);

    // Send initial state immediately (synchronously after acceptance)
    // This must happen before returning the response to ensure the client receives it
    const state = await this.getRoomState();
    const ideas = await this.getIdeas();
    const messages = await this.getMessages();

    console.log('[BACKEND] Sending initialState to new client');
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

        case 'requestAIScore':
          console.log('[BACKEND] Received requestAIScore for idea', data.payload.ideaId);
          await this.scoreIdeaWithAI(data.payload.ideaId);
          break;

        case 'transitionStage':
          console.log('[BACKEND] ===== RECEIVED transitionStage MESSAGE =====');
          console.log('[BACKEND] Active WebSockets:', this.state.getWebSockets().length);
          await this.transitionStage();
          console.log('[BACKEND] ===== transitionStage COMPLETED =====');
          break;

        case 'updateChallenges':
          await this.updateChallenges(data.payload.challenges);
          break;

        case 'submitProfile':
          await this.submitProfile(
            data.payload.userId,
            data.payload.userName,
            data.payload.skills,
            data.payload.experienceLevel,
            data.payload.preferredRole
          );
          break;

        case 'updateHackathonSetup':
          await this.updateHackathonSetup(
            data.payload.rulesText,
            data.payload.timeHours,
            data.payload.selectedTracks
          );
          break;

        case 'requestTrackValidation':
          await this.validateTracks();
          break;

        case 'requestRoleAllocation':
          await this.allocateRoles(data.payload.winningIdeaId);
          break;

        case 'updateRoleAssignment':
          await this.updateRoleAssignment(
            data.payload.userId,
            data.payload.assignedRole
          );
          break;

        case 'completeSetup':
          await this.completeSetupPhase();
          break;

        case 'resetToStageR':
          await this.resetToStageR();
          break;

        case 'saveHackathonSetup':
          await this.saveHackathonSetup(
            data.payload.teamSize,
            data.payload.timeHours,
            data.payload.rulesText,
            data.payload.sponsorName,
            data.payload.sponsorDetails,
            data.payload.primaryTrack
          );
          break;

        case 'selectWinningIdea':
          await this.selectWinningIdeaAndProceed(data.payload.ideaId);
          break;

        case 'answerPRDQuestion':
          await this.answerPRDQuestion(
            data.payload.questionId,
            data.payload.answerText
          );
          break;

        case 'regeneratePRD':
          await this.generateFinalPRD();
          break;

        case 'requestAIScoring':
          console.log('[BACKEND] ========== Manual AI scoring requested ==========');
          try {
            await this.autoScoreAllIdeas();
            console.log('[BACKEND] ========== AI scoring completed successfully ==========');
          } catch (error) {
            console.error('[BACKEND] ========== AI scoring FAILED ==========', error);
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid message';
      ws.send(JSON.stringify({
        type: 'error',
        payload: {
          message: errorMessage,
          details: error instanceof Error ? error.stack : String(error)
        }
      }));
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    console.log('[BACKEND] WebSocket closed. Code:', code, 'Reason:', reason, 'Clean:', wasClean);
    console.log('[BACKEND] Remaining active WebSockets:', this.state.getWebSockets().length);
    // Durable Objects runtime handles cleanup automatically
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
    console.log(`[BACKEND] ===== Starting scoreIdeaWithAI for idea ${ideaId} =====`);

    const ideaResult = await this.state.storage.sql
      .exec('SELECT * FROM ideas WHERE id = ?', ideaId)
      .toArray();

    console.log(`[BACKEND] Query result for idea ${ideaId}:`, ideaResult.length > 0 ? 'found' : 'NOT FOUND');

    if (ideaResult.length === 0) {
      console.log(`[BACKEND] Idea ${ideaId} not found in database, returning early`);
      return;
    }

    const idea: Idea = {
      id: ideaResult[0].id as number,
      userId: ideaResult[0].user_id as string,
      userName: ideaResult[0].user_name as string,
      title: ideaResult[0].title as string,
      description: ideaResult[0].description as string,
      phase: ideaResult[0].phase as 'silent' | 'group',
      createdAt: ideaResult[0].created_at as number,
    };

    console.log(`[BACKEND] Scoring idea: "${idea.title}" by ${idea.userName}`);

    try {
      // Get hackathon setup for team size and time
      console.log(`[BACKEND] Fetching hackathon setup...`);
      const setup = await this.state.storage.sql
        .exec('SELECT * FROM hackathon_setup WHERE id = 1')
        .toArray();

      const teamSize = setup.length > 0 && setup[0].team_size ? (setup[0].team_size as number) : 3;
      const timeHours = setup.length > 0 && setup[0].time_hours ? (setup[0].time_hours as number) : 24;

      console.log(`[BACKEND] Using teamSize=${teamSize}, timeHours=${timeHours}`);

      console.log(`[BACKEND] Generating feasibility prompt...`);
      const prompt = feasibilityPrompt(idea, teamSize, timeHours);

      console.log(`[BACKEND] Calling AI generateJSON for idea ${ideaId}...`);
      const aiScore = await this.aiClient.generateJSON<AIFeasibilityScore>(prompt);

      console.log(`[BACKEND] ✅ AI returned score for idea ${ideaId}:`, aiScore);

      console.log(`[BACKEND] Saving AI score to database...`);
      await this.state.storage.sql.exec(
        `INSERT INTO ai_suggestions (suggestion_type, content, metadata, created_at)
         VALUES ('feasibility_score', ?, ?, ?)`,
        JSON.stringify(aiScore),
        JSON.stringify({ ideaId }),
        Date.now()
      );

      console.log(`[BACKEND] Broadcasting AI score for idea ${ideaId} to all clients...`);
      // Broadcast AI score to all clients
      this.broadcast({
        type: 'aiScore',
        payload: {
          ideaId,
          data: aiScore,
        },
      });

      console.log(`[BACKEND] ✅ Successfully broadcast aiScore for idea ${ideaId}`);
    } catch (error) {
      console.error(`[BACKEND] ❌ AI scoring failed for idea ${ideaId}:`, error);
      console.error(`[BACKEND] Error details:`, {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
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
    console.log('[BACKEND] transitionStage method called');
    const state = await this.getRoomState();
    console.log('[BACKEND] Room state retrieved:', state);

    if (!state) {
      console.error('[BACKEND] ERROR: No state found, returning');
      return;
    }

    const stages: RAPIDStage[] = ['R', 'A', 'P', 'PRD', 'D'];
    const currentIndex = stages.indexOf(state.currentStage as RAPIDStage);
    console.log('[BACKEND] Current stage:', state.currentStage, 'Index:', currentIndex);

    // If already at final stage, just return without error
    if (currentIndex === stages.length - 1) {
      console.log('[BACKEND] Already at final stage D, not transitioning');
      return;
    }

    const nextStage = stages[currentIndex + 1];
    console.log('[BACKEND] Will transition from', state.currentStage, 'to', nextStage);

    // Update database
    console.log('[BACKEND] Updating database...');
    await this.state.storage.sql.exec(
      `UPDATE room_state SET current_stage = ?, updated_at = ? WHERE id = 1`,
      nextStage,
      Date.now()
    );
    console.log('[BACKEND] Database updated successfully');

    // Get ideas to include in state update (needed for Stage P and beyond)
    const ideas = await this.getIdeas();
    console.log('[BACKEND] Fetched', ideas.length, 'ideas for state update');

    // Broadcast to all WebSocket clients
    console.log('[BACKEND] Broadcasting stateUpdate to all clients');
    this.broadcast({
      type: 'stateUpdate',
      payload: {
        currentStage: nextStage,
        ideas: ideas  // Include ideas so frontend has them in all stages
      },
    });
    console.log('[BACKEND] Broadcast complete');
    console.log('[BACKEND] transitionStage method complete');
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
      // Get team members for experience-aware recommendations
      const teamMembers = (await this.state.storage.sql
        .exec('SELECT * FROM team_members')
        .toArray()) as any[];

      // Get hackathon setup for team size and time
      const setup = await this.state.storage.sql
        .exec('SELECT * FROM hackathon_setup WHERE id = 1')
        .toArray();

      const teamSize = setup.length > 0 && setup[0].team_size ? (setup[0].team_size as number) : 3;
      const timeHours = setup.length > 0 && setup[0].time_hours ? (setup[0].time_hours as number) : 24;

      const mvpPrompt = mvpPrioritizationPrompt(idea, teamSize, timeHours, teamMembers);
      const mvpSuggestion = await this.aiClient.generateJSON<{
        mustHave: string[];
        niceToHave: string[];
        outOfScope: string[];
        reasoning: string;
      }>(mvpPrompt);

      const techPrompt = techStackPrompt(idea, teamSize, timeHours, teamMembers);
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
    console.log('[BACKEND] ===== BROADCASTING =====');
    console.log('[BACKEND] Message type:', message.type);
    console.log('[BACKEND] Message payload:', JSON.stringify(message.payload));

    // Use Durable Objects' managed WebSockets instead of manual tracking
    const webSockets = this.state.getWebSockets();
    console.log('[BACKEND] Active WebSockets from DO runtime:', webSockets.length);

    let successCount = 0;
    let errorCount = 0;

    webSockets.forEach((ws, index) => {
      try {
        console.log(`[BACKEND] Sending to WebSocket ${index + 1}/${webSockets.length}`);
        ws.send(messageStr);
        successCount++;
        console.log(`[BACKEND] Successfully sent to WebSocket ${index + 1}`);
      } catch (error) {
        console.error(`[BACKEND] ERROR sending to WebSocket ${index + 1}:`, error);
        errorCount++;
      }
    });

    console.log('[BACKEND] ===== BROADCAST COMPLETE =====');
    console.log(`[BACKEND] Success: ${successCount}, Errors: ${errorCount}`);
  }

  /**
   * Submit team member profile
   */
  private async submitProfile(
    userId: string,
    userName: string,
    skills: string[],
    experienceLevel: string,
    preferredRole?: string
  ) {
    const joinedAt = Date.now();

    await this.state.storage.sql.exec(
      `INSERT OR REPLACE INTO team_members
       (user_id, user_name, skills, experience_level, preferred_role, joined_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      userId,
      userName,
      JSON.stringify(skills),
      experienceLevel,
      preferredRole || null,
      joinedAt
    );

    // Broadcast profile to all users
    this.broadcast({
      type: 'profileSubmitted',
      payload: { userId, userName, skills, experienceLevel, preferredRole },
    });

    // Check if all profiles are complete
    await this.checkProfileCompletion();
  }

  /**
   * Update hackathon setup information
   */
  private async updateHackathonSetup(
    rulesText: string,
    timeHours: number,
    selectedTracks: string[]
  ) {
    await this.state.storage.sql.exec(
      `INSERT OR REPLACE INTO hackathon_setup (id, rules_text, time_hours, selected_tracks)
       VALUES (1, ?, ?, ?)`,
      rulesText,
      timeHours,
      JSON.stringify(selectedTracks)
    );

    // Update room_state setup phase
    await this.state.storage.sql.exec(
      `UPDATE room_state SET setup_phase = 'team_profiles' WHERE id = 1`
    );

    this.broadcast({
      type: 'setupUpdated',
      payload: { rulesText, timeHours, selectedTracks },
    });
  }

  /**
   * Validate track selections with AI
   */
  private async validateTracks() {
    // Get team members and setup
    const members = (await this.state.storage.sql
      .exec('SELECT * FROM team_members')
      .toArray()) as any[];

    const setup = await this.state.storage.sql
      .exec('SELECT * FROM hackathon_setup WHERE id = 1')
      .toArray();

    if (setup.length === 0 || members.length === 0) {
      return;
    }

    const rulesText = setup[0].rules_text as string;
    const selectedTracksJson = setup[0].selected_tracks as string;
    const tracks = JSON.parse(selectedTracksJson);

    // Call AI for validation
    const aiClient = new WorkersAIClient(this.env.AI);
    const prompt = trackValidationPrompt(tracks, members, rulesText);

    try {
      const validation = await aiClient.generateJSON<{
        overallFit: string;
        trackAnalysis: Array<{
          trackName: string;
          fitScore: number;
          reasoning: string;
          requiredSkills: string[];
          teamCoverage: string;
        }>;
        recommendations: string;
        alternativeTracks: string[];
      }>(prompt);

      // Store validation results
      await this.state.storage.sql.exec(
        `UPDATE hackathon_setup SET track_validation = ? WHERE id = 1`,
        JSON.stringify(validation)
      );

      // Update room_state phase
      await this.state.storage.sql.exec(
        `UPDATE room_state SET setup_phase = 'complete' WHERE id = 1`
      );

      this.broadcast({
        type: 'trackValidation',
        payload: validation,
      });
    } catch (error) {
      console.error('Track validation failed:', error);
    }
  }

  /**
   * Allocate roles using AI
   */
  private async allocateRoles(winningIdeaId?: number) {
    const members = (await this.state.storage.sql
      .exec('SELECT * FROM team_members')
      .toArray()) as any[];

    if (members.length === 0) return;

    // Get winning idea if provided
    let idea: Idea | undefined;
    if (winningIdeaId) {
      const ideas = await this.state.storage.sql
        .exec('SELECT * FROM ideas WHERE id = ?', winningIdeaId)
        .toArray();
      if (ideas.length > 0) {
        const row = ideas[0];
        idea = {
          id: row.id as number,
          userId: row.user_id as string,
          userName: row.user_name as string,
          title: row.title as string,
          description: row.description as string,
          phase: row.phase as 'silent' | 'group',
          createdAt: row.created_at as number,
        };
      }
    }

    // Call AI for role allocation
    const aiClient = new WorkersAIClient(this.env.AI);
    const prompt = roleAllocationPrompt(members, idea);

    try {
      const allocation = await aiClient.generateJSON<{
        assignments: Array<{
          userId: string;
          userName: string;
          assignedRole: string;
          reasoning: string;
          matchesPreference: boolean;
        }>;
        teamBalance: string;
        suggestions: string;
      }>(prompt);

      // Update assigned roles in database
      for (const assignment of allocation.assignments) {
        await this.state.storage.sql.exec(
          `UPDATE team_members SET assigned_role = ? WHERE user_id = ?`,
          assignment.assignedRole,
          assignment.userId
        );
      }

      this.broadcast({
        type: 'roleAllocation',
        payload: allocation,
      });
    } catch (error) {
      console.error('Role allocation failed:', error);
    }
  }

  /**
   * Update a member's role assignment (manual override)
   */
  private async updateRoleAssignment(userId: string, assignedRole: string) {
    await this.state.storage.sql.exec(
      `UPDATE team_members SET assigned_role = ? WHERE user_id = ?`,
      assignedRole,
      userId
    );

    this.broadcast({
      type: 'roleUpdated',
      payload: { userId, assignedRole },
    });
  }

  /**
   * Check if all team members have submitted profiles
   */
  private async checkProfileCompletion() {
    const members = await this.state.storage.sql
      .exec('SELECT COUNT(*) as count FROM team_members')
      .toArray();

    const memberCount = members[0].count as number;

    // Update profiles_complete flag
    await this.state.storage.sql.exec(
      `UPDATE hackathon_setup SET profiles_complete = 1, team_size = ? WHERE id = 1`,
      memberCount
    );

    this.broadcast({
      type: 'profilesComplete',
      payload: { teamSize: memberCount },
    });
  }

  /**
   * Complete setup phase and allow transition to Stage A
   */
  private async completeSetupPhase() {
    await this.state.storage.sql.exec(
      `UPDATE hackathon_setup SET setup_complete = 1 WHERE id = 1`
    );

    await this.state.storage.sql.exec(
      `UPDATE room_state SET setup_phase = 'complete' WHERE id = 1`
    );

    this.broadcast({
      type: 'setupComplete',
      payload: { canProceed: true },
    });
  }

  /**
   * Save hackathon setup from structured form in Stage R
   */
  private async saveHackathonSetup(
    teamSize: number,
    timeHours: number,
    rulesText: string,
    sponsorName: string,
    sponsorDetails: string,
    primaryTrack: string
  ) {
    console.log('[BACKEND] Saving hackathon setup');

    const createdAt = Date.now();

    await this.state.storage.sql.exec(
      `UPDATE hackathon_setup SET
       team_size = ?,
       time_hours = ?,
       rules_text = ?,
       sponsor_name = ?,
       sponsor_details = ?,
       primary_track = ?,
       setup_complete = 1,
       created_at = ?
       WHERE id = 1`,
      teamSize,
      timeHours,
      rulesText || null,
      sponsorName || null,
      sponsorDetails || null,
      primaryTrack,
      createdAt
    );

    this.broadcast({
      type: 'setupSaved',
      payload: { teamSize, timeHours, primaryTrack },
    });

    console.log('[BACKEND] Hackathon setup saved successfully');
  }

  /**
   * Auto-score all ideas when entering Stage P
   */
  private async autoScoreAllIdeas() {
    console.log('[BACKEND] Auto-scoring all ideas for Stage P');

    const ideasResult = await this.state.storage.sql
      .exec('SELECT * FROM ideas ORDER BY created_at ASC')
      .toArray();

    console.log(`[BACKEND] Found ${ideasResult.length} ideas to score`);

    if (ideasResult.length === 0) {
      console.log('[BACKEND] No ideas to score');
      return;
    }

    // Map SQL results to Idea type
    const ideas: Idea[] = ideasResult.map((row) => ({
      id: row.id as number,
      userId: row.user_id as string,
      userName: row.user_name as string,
      title: row.title as string,
      description: row.description as string,
      phase: row.phase as 'silent' | 'group',
      createdAt: row.created_at as number,
    }));

    console.log(`[BACKEND] Mapped ideas:`, ideas.map(i => ({ id: i.id, title: i.title })));

    // Score ideas sequentially with delay to avoid rate limits
    console.log(`[BACKEND] Starting to score ${ideas.length} ideas sequentially (to avoid rate limits)`);
    for (let i = 0; i < ideas.length; i++) {
      const idea = ideas[i];
      console.log(`[BACKEND] Scoring idea ${i + 1}/${ideas.length}: "${idea.title}" (ID: ${idea.id})`);

      try {
        await this.scoreIdeaWithAI(idea.id);
        console.log(`[BACKEND] ✓ Successfully scored idea ${idea.id}`);

        // Add delay between ideas to avoid rate limiting (except for last idea)
        if (i < ideas.length - 1) {
          const delayMs = 2000; // 2 second delay between ideas
          console.log(`[BACKEND] Waiting ${delayMs}ms before next idea...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`[BACKEND] ❌ Failed to score idea ${idea.id}:`, error);
        // Continue with next idea even if one fails
      }
    }

    console.log('[BACKEND] Finished auto-scoring all ideas');
  }

  /**
   * Select winning idea and transition to PRD stage
   */
  private async selectWinningIdeaAndProceed(ideaId: number) {
    console.log(`[BACKEND] Selecting winning idea ${ideaId} and starting PRD flow`);

    // Store winning idea in room_state
    await this.state.storage.sql.exec(
      `UPDATE room_state SET winning_idea_id = ?, current_stage = 'PRD', prd_question_count = 0 WHERE id = 1`,
      ideaId
    );

    // Initialize PRD document
    await this.state.storage.sql.exec(
      `INSERT OR REPLACE INTO prd_document (id, winning_idea_id, prd_complete) VALUES (1, ?, 0)`,
      ideaId
    );

    // Clear any existing PRD Q&A
    await this.state.storage.sql.exec(`DELETE FROM prd_qa`);

    // Broadcast stage transition
    this.broadcast({
      type: 'stateUpdate',
      payload: {
        currentStage: 'PRD',
        winningIdeaId: ideaId,
      },
    });

    // Start PRD questionnaire
    await this.askNextPRDQuestion();
  }

  /**
   * Ask the next PRD question using AI
   */
  private async askNextPRDQuestion() {
    console.log('[BACKEND] Asking next PRD question');

    // Get current state
    const state = await this.state.storage.sql
      .exec('SELECT * FROM room_state WHERE id = 1')
      .toArray();

    if (state.length === 0 || !state[0].winning_idea_id) {
      console.error('[BACKEND] No winning idea selected');
      return;
    }

    const winningIdeaId = state[0].winning_idea_id as number;
    const currentQuestionCount = (state[0].prd_question_count as number) || 0;

    // Check if we've asked all 6 questions
    if (currentQuestionCount >= 6) {
      console.log('[BACKEND] All PRD questions answered, generating final PRD');
      await this.generateFinalPRD();
      return;
    }

    // Get winning idea
    const ideasResult = await this.state.storage.sql
      .exec('SELECT * FROM ideas WHERE id = ?', winningIdeaId)
      .toArray();

    if (ideasResult.length === 0) {
      console.error('[BACKEND] Winning idea not found');
      return;
    }

    const row = ideasResult[0];
    const winningIdea: Idea = {
      id: row.id as number,
      userId: row.user_id as string,
      userName: row.user_name as string,
      title: row.title as string,
      description: row.description as string,
      phase: row.phase as 'silent' | 'group',
      createdAt: row.created_at as number,
    };

    // Get hackathon setup
    const setup = await this.state.storage.sql
      .exec('SELECT * FROM hackathon_setup WHERE id = 1')
      .toArray();

    const hackathonSetup = {
      teamSize: setup.length > 0 && setup[0].team_size ? (setup[0].team_size as number) : 3,
      timeHours: setup.length > 0 && setup[0].time_hours ? (setup[0].time_hours as number) : 24,
      rulesText: setup.length > 0 ? (setup[0].rules_text as string | undefined) : undefined,
      primaryTrack: setup.length > 0 && setup[0].primary_track ? (setup[0].primary_track as string) : 'General',
    };

    // Get previous Q&A
    const previousQA = (await this.state.storage.sql
      .exec('SELECT question_text, answer_text FROM prd_qa WHERE answered = 1 ORDER BY sort_order ASC')
      .toArray()) as Array<{ question_text: string; answer_text: string }>;

    const previousAnswers = previousQA.map((qa) => ({
      question: qa.question_text,
      answer: qa.answer_text,
    }));

    // Generate next question with AI
    const aiClient = new WorkersAIClient(this.env.AI);
    const prompt = prdQuestionPrompt(
      winningIdea,
      currentQuestionCount + 1,
      previousAnswers,
      hackathonSetup
    );

    try {
      const questionData = await aiClient.generateJSON<{
        questionKey: string;
        questionText: string;
        reasoning: string;
      }>(prompt);

      // Store question in database
      const createdAt = Date.now();
      await this.state.storage.sql.exec(
        `INSERT INTO prd_qa (question_key, question_text, sort_order, answered, created_at)
         VALUES (?, ?, ?, 0, ?)`,
        questionData.questionKey,
        questionData.questionText,
        currentQuestionCount + 1,
        createdAt
      );

      // Get the inserted question ID
      const newQuestionResult = await this.state.storage.sql
        .exec('SELECT * FROM prd_qa WHERE sort_order = ?', currentQuestionCount + 1)
        .toArray();

      const newQuestionRow = newQuestionResult[0];
      const newQuestion: PRDQuestion = {
        id: newQuestionRow.id as number,
        questionKey: newQuestionRow.question_key as string,
        questionText: newQuestionRow.question_text as string,
        answerText: newQuestionRow.answer_text as string | undefined,
        sortOrder: newQuestionRow.sort_order as number,
        answered: newQuestionRow.answered as number,
        createdAt: newQuestionRow.created_at as number,
      };

      // Update question count
      await this.state.storage.sql.exec(
        `UPDATE room_state SET prd_question_count = ? WHERE id = 1`,
        currentQuestionCount + 1
      );

      // Broadcast question
      this.broadcast({
        type: 'prdQuestion',
        payload: {
          id: newQuestion.id,
          questionKey: newQuestion.questionKey,
          questionText: newQuestion.questionText,
          sortOrder: newQuestion.sortOrder,
        },
      });

      console.log(`[BACKEND] Asked PRD question ${currentQuestionCount + 1}/6`);
    } catch (error) {
      console.error('[BACKEND] Failed to generate PRD question:', error);
    }
  }

  /**
   * Answer a PRD question and ask the next one
   */
  private async answerPRDQuestion(questionId: number, answerText: string) {
    console.log(`[BACKEND] Answering PRD question ${questionId}`);

    // Update question as answered
    await this.state.storage.sql.exec(
      `UPDATE prd_qa SET answer_text = ?, answered = 1 WHERE id = ?`,
      answerText,
      questionId
    );

    // Broadcast answer confirmation
    this.broadcast({
      type: 'prdAnswerReceived',
      payload: { questionId, answerText },
    });

    // Ask next question
    await this.askNextPRDQuestion();
  }

  /**
   * Generate final PRD document from all Q&A
   */
  private async generateFinalPRD() {
    console.log('[BACKEND] Generating final PRD document');

    // Get winning idea
    const state = await this.state.storage.sql
      .exec('SELECT * FROM room_state WHERE id = 1')
      .toArray();

    const winningIdeaId = state[0].winning_idea_id as number;

    const ideasResult = await this.state.storage.sql
      .exec('SELECT * FROM ideas WHERE id = ?', winningIdeaId)
      .toArray();

    const ideaRow = ideasResult[0];
    const winningIdea: Idea = {
      id: ideaRow.id as number,
      userId: ideaRow.user_id as string,
      userName: ideaRow.user_name as string,
      title: ideaRow.title as string,
      description: ideaRow.description as string,
      phase: ideaRow.phase as 'silent' | 'group',
      createdAt: ideaRow.created_at as number,
    };

    // Get all Q&A
    const qaResult = await this.state.storage.sql
      .exec('SELECT * FROM prd_qa ORDER BY sort_order ASC')
      .toArray();

    const qaList: PRDQuestion[] = qaResult.map((row) => ({
      id: row.id as number,
      questionKey: row.question_key as string,
      questionText: row.question_text as string,
      answerText: row.answer_text as string | undefined,
      sortOrder: row.sort_order as number,
      answered: row.answered as number,
      createdAt: row.created_at as number,
    }));

    const formattedQA = qaList.map((qa) => ({
      questionKey: qa.questionKey,
      questionText: qa.questionText,
      answerText: qa.answerText || '',
    }));

    // Get hackathon setup
    const setup = await this.state.storage.sql
      .exec('SELECT * FROM hackathon_setup WHERE id = 1')
      .toArray();

    const hackathonSetup = {
      teamSize: setup.length > 0 && setup[0].team_size ? (setup[0].team_size as number) : 3,
      timeHours: setup.length > 0 && setup[0].time_hours ? (setup[0].time_hours as number) : 24,
      rulesText: setup.length > 0 ? (setup[0].rules_text as string | undefined) : undefined,
      primaryTrack: setup.length > 0 && setup[0].primary_track ? (setup[0].primary_track as string) : 'General',
    };

    // Generate PRD with AI
    const aiClient = new WorkersAIClient(this.env.AI);
    const prompt = prdGenerationPrompt(winningIdea, formattedQA, hackathonSetup);

    try {
      const prd = await aiClient.generateJSON<{
        problemStatement: string;
        solutionOverview: string;
        targetUsers: string;
        coreFeatures: string[];
        techStack: any;
        timeline: any;
        successCriteria: string[];
        constraints: string;
      }>(prompt);

      // Store PRD in database
      const generatedAt = Date.now();
      await this.state.storage.sql.exec(
        `UPDATE prd_document SET
         problem_statement = ?,
         solution_overview = ?,
         target_users = ?,
         core_features = ?,
         tech_stack = ?,
         timeline = ?,
         success_criteria = ?,
         constraints = ?,
         generated_at = ?,
         prd_complete = 1
         WHERE id = 1`,
        prd.problemStatement,
        prd.solutionOverview,
        prd.targetUsers,
        JSON.stringify(prd.coreFeatures),
        JSON.stringify(prd.techStack),
        JSON.stringify(prd.timeline),
        JSON.stringify(prd.successCriteria),
        prd.constraints,
        generatedAt
      );

      // Transition to Stage D (Export)
      await this.state.storage.sql.exec(
        `UPDATE room_state SET current_stage = 'D' WHERE id = 1`
      );

      // Broadcast PRD complete with the document
      const prdDocument = {
        problem_statement: prd.problemStatement,
        solution_overview: prd.solutionOverview,
        target_users: prd.targetUsers,
        core_features: JSON.stringify(prd.coreFeatures),
        tech_stack: JSON.stringify(prd.techStack),
        timeline: JSON.stringify(prd.timeline),
        success_criteria: JSON.stringify(prd.successCriteria),
        constraints: prd.constraints,
      };

      console.log('[BACKEND] Broadcasting PRD complete with document');
      this.broadcast({
        type: 'prdComplete',
        payload: {
          prdDocument,
          currentStage: 'D',
        },
      });

      // Also send a stateUpdate for consistency
      this.broadcast({
        type: 'stateUpdate',
        payload: {
          currentStage: 'D',
        },
      });

      console.log('[BACKEND] PRD generation complete, transitioned to Stage D');
    } catch (error) {
      console.error('[BACKEND] PRD generation failed:', error);
    }
  }

  /**
   * Reset room to Stage R (Review)
   */
  private async resetToStageR() {
    await this.state.storage.sql.exec(
      `UPDATE room_state SET current_stage = 'R', updated_at = ? WHERE id = 1`,
      Date.now()
    );

    this.broadcast({
      type: 'stateUpdate',
      payload: { currentStage: 'R' },
    });
  }
}

export default HackMatchAgent;
