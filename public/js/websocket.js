import { BACKEND_URL, WS_URL } from './config.js';
import { state } from './state.js';
import { updateStageProgress } from './ui.js';
import { updateStageUI } from './stages.js';
import { displayIdea, displayAISuggestion, displayMessage, displayAIScore, displayPRDQuestion } from './handlers.js';

export async function joinRoom() {
  const roomInput = document.getElementById('roomId').value.trim();
  const nameInput = document.getElementById('userName').value.trim();

  if (!nameInput) {
    alert('Please enter your name');
    return;
  }

  state.userName = nameInput;

  // Create room if no ID provided
  if (!roomInput) {
    const res = await fetch(`${BACKEND_URL}/api/create-room`, { method: 'POST' });
    const data = await res.json();
    state.roomId = data.roomId;
  } else {
    state.roomId = roomInput;
  }

  connectWebSocket();
}

export function connectWebSocket() {
  const wsUrl = `${WS_URL}/api/room/${state.roomId}`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    document.getElementById('status').textContent = `Connected to room: ${state.roomId}`;
    document.getElementById('status').className = 'connected';
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    updateStageUI();
  };

  state.ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log('Received message:', msg);
    handleMessage(msg);
  };

  state.ws.onclose = () => {
    document.getElementById('status').textContent = 'Disconnected';
    document.getElementById('status').className = 'disconnected';
  };

  state.ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    alert('Connection error. Please try again.');
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'initialState':
      console.log('[FRONTEND] Received initialState');
      state.currentStage = msg.payload.currentStage;

      // Store ideas globally for use in other stages
      state.currentIdeas = msg.payload.ideas || [];
      window.currentIdeas = state.currentIdeas;

      updateStageProgress();
      updateStageUI();  // Render UI first - this creates the empty divs

      // NOW append ideas and messages (after UI is rendered)
      if (msg.payload.ideas) {
        console.log('[FRONTEND] Loading', msg.payload.ideas.length, 'ideas');
        msg.payload.ideas.forEach(idea => displayIdea(idea));
      }
      if (msg.payload.messages) {
        console.log('[FRONTEND] Loading', msg.payload.messages.length, 'messages');
        msg.payload.messages.forEach(m => displayMessage(m));
      }
      break;

    case 'message':
      displayMessage(msg.payload);
      break;

    case 'idea':
      displayIdea(msg.payload);
      // Add to global ideas array so it persists across stages
      if (!state.currentIdeas.find(i => i.id === msg.payload.id)) {
        state.currentIdeas.push(msg.payload);
        window.currentIdeas = state.currentIdeas;
        console.log('[FRONTEND] Added idea to currentIdeas. Total:', state.currentIdeas.length);
      }
      break;

    case 'aiSuggestion':
      displayAISuggestion(msg.payload);
      break;

    case 'stateUpdate':
      console.log('[FRONTEND] Received stateUpdate:', msg.payload);
      if (msg.payload.currentStage) {
        console.log('[FRONTEND] Updating stage from', state.currentStage, 'to', msg.payload.currentStage);

        // Re-enable the button if it exists (from previous stage)
        const btn = document.getElementById('startBrainstormBtn');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Start Brainstorming →';
        }

        state.currentStage = msg.payload.currentStage;

        // Update ideas if included in payload (important for Stage P and beyond)
        if (msg.payload.ideas) {
          console.log('[FRONTEND] Updating ideas from stateUpdate:', msg.payload.ideas.length, 'ideas');
          state.currentIdeas = msg.payload.ideas;
          window.currentIdeas = state.currentIdeas;
        }

        updateStageProgress();
        updateStageUI();

        console.log('[FRONTEND] Stage transition complete, now at:', state.currentStage);
      }
      break;

    case 'setupSaved':
      console.log('[FRONTEND] Hackathon setup saved');
      // Auto-transition to Stage A handled by backend
      break;

    case 'aiScore':
      console.log('[FRONTEND] Received AI score for idea', msg.payload.ideaId);
      displayAIScore(msg.payload.ideaId, msg.payload.data);
      break;

    case 'prdQuestion':
      console.log('[FRONTEND] Received PRD question');
      displayPRDQuestion(msg.payload);
      break;

    case 'prdAnswerReceived':
      console.log('[FRONTEND] PRD answer received');
      // Question UI will be updated when next question arrives
      break;

    case 'prdComplete':
      console.log('[FRONTEND] PRD generation complete');
      console.log('[FRONTEND] PRD Document:', msg.payload.prdDocument);
      state.currentPRD = msg.payload.prdDocument;
      window.currentPRD = state.currentPRD;

      // Update to Stage D
      if (msg.payload.currentStage === 'D') {
        console.log('[FRONTEND] Updating to Stage D to display PRD');
        state.currentStage = 'D';
        updateStageProgress();
        updateStageUI();
      }
      break;

    case 'error':
      console.error('Server error:', msg.payload);
      alert(`Error: ${msg.payload.message}\n\nDetails: ${msg.payload.details || 'No details available'}`);
      break;
  }
}
