#!/usr/bin/env node

import WebSocket from 'ws';

const BACKEND_URL = 'https://cf_ai_hackmatch.aadhavmanimurugan.workers.dev';
const WS_URL = 'wss://cf_ai_hackmatch.aadhavmanimurugan.workers.dev';

let ws = null;
let roomId = '';
let userId = Math.random().toString(36).substr(2, 9);
let ideaId = null;
let aiScoreReceived = false;

function log(message, type = 'INFO') {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    INFO: '\x1b[36m',
    SUCCESS: '\x1b[32m',
    ERROR: '\x1b[31m',
    RESET: '\x1b[0m'
  };
  console.log(`${colors[type]}[${timestamp}] [${type}] ${message}${colors.RESET}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createRoom() {
  log('Creating room...');
  const res = await fetch(`${BACKEND_URL}/api/create-room`, { method: 'POST' });
  const data = await res.json();
  roomId = data.roomId;
  log(`✓ Room created: ${roomId}`, 'SUCCESS');
  return roomId;
}

async function connectWebSocket() {
  return new Promise((resolve, reject) => {
    log(`Connecting to WebSocket: ${WS_URL}/api/room/${roomId}`);
    ws = new WebSocket(`${WS_URL}/api/room/${roomId}`);

    ws.on('open', () => {
      log('✓ WebSocket connected', 'SUCCESS');
      resolve();
    });

    ws.on('error', (error) => {
      log(`✗ WebSocket error: ${error.message}`, 'ERROR');
      reject(error);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      log(`← Received message type: ${msg.type}`);

      if (msg.type === 'initialState') {
        log(`  Initial stage: ${msg.payload.currentStage}`);
        log(`  Ideas: ${msg.payload.ideas?.length || 0}`);
      }

      if (msg.type === 'idea') {
        ideaId = msg.payload.id;
        log(`  ✓ Idea created with ID: ${ideaId}`, 'SUCCESS');
      }

      if (msg.type === 'aiScore') {
        aiScoreReceived = true;
        log(`  ✓✓✓ AI SCORE RECEIVED for idea ${msg.payload.ideaId} ✓✓✓`, 'SUCCESS');
        log(`    Score: ${msg.payload.data.score}/5`, 'SUCCESS');
        log(`    Reasoning: ${msg.payload.data.reasoning}`, 'SUCCESS');
        log(`    Risks: ${JSON.stringify(msg.payload.data.risks)}`, 'SUCCESS');
        log(`    Recommendations: ${JSON.stringify(msg.payload.data.recommendations)}`, 'SUCCESS');
      }

      if (msg.type === 'error') {
        log(`  ✗ Server error: ${msg.payload.message}`, 'ERROR');
        if (msg.payload.details) {
          log(`    Details: ${msg.payload.details}`, 'ERROR');
        }
      }

      if (msg.type === 'stateUpdate') {
        log(`  Stage updated to: ${msg.payload.currentStage}`, 'SUCCESS');
      }
    });

    ws.on('close', () => {
      log('WebSocket closed');
    });

    setTimeout(() => reject(new Error('Connection timeout')), 10000);
  });
}

function sendMessage(type, payload) {
  log(`→ Sending message: ${type}`);
  ws.send(JSON.stringify({ type, payload }));
}

async function runTest() {
  log('='.repeat(60), 'INFO');
  log('STARTING HACKMATCH E2E TEST WITH AI SCORING', 'INFO');
  log('='.repeat(60), 'INFO');

  try {
    // Step 1: Create room
    log('\n[STEP 1] Creating room...');
    await createRoom();
    await sleep(500);

    // Step 2: Connect WebSocket
    log('\n[STEP 2] Connecting WebSocket...');
    await connectWebSocket();
    await sleep(2000); // Wait for initialState

    // Step 3: Save hackathon setup
    log('\n[STEP 3] Saving hackathon setup...');
    sendMessage('saveHackathonSetup', {
      teamSize: 4,
      timeHours: 24,
      rulesText: 'Test hackathon - must use Cloudflare Workers',
      sponsorName: 'Cloudflare',
      sponsorDetails: '$5000 prize',
      primaryTrack: 'Best Use of AI'
    });
    await sleep(1000);

    // Step 4: Transition to Stage A
    log('\n[STEP 4] Transitioning to Stage A (Ideas)...');
    sendMessage('transitionStage', {});
    await sleep(2000);

    // Step 5: Submit an idea
    log('\n[STEP 5] Submitting test idea...');
    sendMessage('submitIdea', {
      userId: userId,
      userName: 'E2E Test User',
      title: 'AI-Powered Code Review Assistant',
      description: 'An automated code review tool that uses AI to detect bugs, suggest improvements, and enforce coding standards. Integrates with GitHub PRs and provides real-time feedback.',
      phase: 'group'
    });
    await sleep(3000); // Wait for idea to be created

    if (!ideaId) {
      throw new Error('Idea was not created - ideaId is null');
    }

    // Step 6: Transition to Stage P
    log('\n[STEP 6] Transitioning to Stage P (Prioritize)...');
    sendMessage('transitionStage', {});
    await sleep(2000);

    // Step 7: Request AI scoring
    log('\n[STEP 7] Requesting AI scoring for all ideas...');
    log('⏳ This may take 10-30 seconds depending on AI response time...');
    sendMessage('requestAIScoring', {});

    // Wait up to 45 seconds for AI response
    const maxWaitTime = 45000;
    const checkInterval = 1000;
    let waited = 0;

    while (!aiScoreReceived && waited < maxWaitTime) {
      await sleep(checkInterval);
      waited += checkInterval;
      if (waited % 5000 === 0) {
        log(`  Still waiting... (${waited/1000}s elapsed)`);
      }
    }

    if (aiScoreReceived) {
      log('\n' + '='.repeat(60), 'SUCCESS');
      log('✓✓✓ TEST PASSED - AI SCORING WORKS! ✓✓✓', 'SUCCESS');
      log('='.repeat(60), 'SUCCESS');
    } else {
      log('\n' + '='.repeat(60), 'ERROR');
      log('✗✗✗ TEST FAILED - NO AI SCORE RECEIVED ✗✗✗', 'ERROR');
      log('='.repeat(60), 'ERROR');
      log('Possible issues:', 'ERROR');
      log('  1. AI model not available or rate limited', 'ERROR');
      log('  2. Backend error in AI processing', 'ERROR');
      log('  3. Network timeout', 'ERROR');
      log('Check Cloudflare Worker logs with: npx wrangler tail', 'ERROR');
    }

    // Cleanup
    ws.close();
    process.exit(aiScoreReceived ? 0 : 1);

  } catch (error) {
    log('\n' + '='.repeat(60), 'ERROR');
    log('✗✗✗ TEST FAILED WITH ERROR ✗✗✗', 'ERROR');
    log('='.repeat(60), 'ERROR');
    log(`Error: ${error.message}`, 'ERROR');
    console.error(error);
    if (ws) ws.close();
    process.exit(1);
  }
}

runTest();
