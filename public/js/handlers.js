import { state } from './state.js';

export function submitIdea() {
  const title = document.getElementById('ideaTitle').value.trim();
  const description = document.getElementById('ideaDescription').value.trim();

  if (!title || !description) {
    alert('Please fill in both title and description');
    return;
  }

  state.ws.send(JSON.stringify({
    type: 'submitIdea',
    payload: {
      userId: state.userId,
      userName: state.userName,
      title,
      description,
      phase: 'group'
    }
  }));

  document.getElementById('ideaTitle').value = '';
  document.getElementById('ideaDescription').value = '';
}

export function displayIdea(idea) {
  const list = document.getElementById('ideasList');
  if (!list) return;

  const card = document.createElement('div');
  card.className = 'idea-card';
  card.innerHTML = `
    <strong>${idea.title}</strong>
    <p>${idea.description}</p>
    <small>by ${idea.userName}</small>
  `;
  list.appendChild(card);
}

export function displayAISuggestion(suggestion) {
  const list = document.getElementById('ideasList');
  if (!list) return;

  const card = document.createElement('div');
  card.className = 'idea-card ai-suggestion';
  card.innerHTML = `
    <strong>AI Suggestion: ${suggestion.type}</strong>
    <pre>${JSON.stringify(suggestion.data, null, 2)}</pre>
  `;
  list.appendChild(card);
}

export function scoreIdea(ideaId, score) {
  console.log('[FRONTEND] Scoring idea', ideaId, 'with score', score);

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({
      type: 'scoreIdea',
      payload: {
        userId: state.userId,
        ideaId,
        criterion: 'feasibility',
        score
      }
    }));

    // Update UI immediately
    const scoreDiv = document.getElementById(`score-${ideaId}`);
    if (scoreDiv) {
      scoreDiv.textContent = `Scored: ${score}/5`;
    }
  } else {
    alert('Not connected to server. Please refresh.');
  }
}

export function requestAIScoring() {
  console.log('[FRONTEND] Requesting AI scoring for all ideas');

  if (!state.currentIdeas || state.currentIdeas.length === 0) {
    alert('No ideas to score! Please submit ideas in Stage A first.');
    return;
  }

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to server. Please refresh.');
    return;
  }

  // Show loading status
  const statusDiv = document.getElementById('aiScoringStatus');
  if (statusDiv) {
    statusDiv.classList.remove('hidden');
  }

  // Hide the button
  const buttons = document.querySelectorAll('button');
  buttons.forEach(btn => {
    if (btn.textContent.includes('Get Feasibility Scores')) {
      btn.style.display = 'none';
    }
  });

  // Send single request to score all ideas
  console.log('[FRONTEND] Sending requestAIScoring message');
  state.ws.send(JSON.stringify({
    type: 'requestAIScoring'
  }));
}

export function sendMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();

  if (!content) return;

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    console.log('Sending message:', content);
    state.ws.send(JSON.stringify({
      type: 'sendMessage',
      payload: {
        userId: state.userId,
        userName: state.userName,
        content
      }
    }));

    input.value = '';
  } else {
    alert('Not connected to server. Please refresh.');
  }
}

export function displayMessage(msg) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;

  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `
    <strong>${msg.userName}</strong>
    <p>${msg.content}</p>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

export function saveHackathonSetup() {
  console.log('[FRONTEND] saveHackathonSetup called');

  // Get form values
  const teamSize = parseInt(document.getElementById('teamSize').value);
  const timeHours = parseInt(document.getElementById('timeHours').value);
  const rulesText = document.getElementById('hackathonRules').value.trim();
  const sponsorName = document.getElementById('sponsorName').value.trim();
  const sponsorDetails = document.getElementById('sponsorDetails').value.trim();
  const primaryTrack = document.getElementById('primaryTrack').value;

  // Validate required fields
  if (!teamSize || teamSize < 1) {
    alert('Please enter a valid team size');
    return;
  }
  if (!timeHours || timeHours < 1) {
    alert('Please enter valid time hours');
    return;
  }
  if (!primaryTrack) {
    alert('Please select a primary track');
    return;
  }

  // Disable button
  const btn = document.getElementById('startBrainstormBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  // Check WebSocket connection
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to server. Please refresh and try again.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save & Start Brainstorming';
    }
    return;
  }

  // Send hackathon setup to backend
  console.log('[FRONTEND] Sending saveHackathonSetup message');
  state.ws.send(JSON.stringify({
    type: 'saveHackathonSetup',
    payload: {
      teamSize,
      timeHours,
      rulesText,
      sponsorName,
      sponsorDetails,
      primaryTrack
    }
  }));

  // Send context as a message for team chat
  const contextMessage = `Setup: Hackathon Setup:\n• Team Size: ${teamSize}\n• Time: ${timeHours} hours\n• Track: ${primaryTrack}\n• Rules: ${rulesText || 'None specified'}\n${sponsorName ? `• Sponsor: ${sponsorName}` : ''}`;
  state.ws.send(JSON.stringify({
    type: 'sendMessage',
    payload: {
      userId: state.userId,
      userName: 'System',
      content: contextMessage
    }
  }));

  // Transition to Stage A
  console.log('[FRONTEND] Sending transitionStage message');
  state.ws.send(JSON.stringify({
    type: 'transitionStage'
  }));
}

export function nextStage() {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    console.log('Transitioning to next stage from:', state.currentStage);
    state.ws.send(JSON.stringify({
      type: 'transitionStage'
    }));
  } else {
    alert('Not connected to server. Please refresh.');
  }
}

export function resetToStageR() {
  if (confirm('Are you sure you want to reset to Stage R? This will not delete your data.')) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({
        type: 'resetToStageR'
      }));
    } else {
      alert('Not connected to server. Please refresh.');
    }
  }
}

export function startOver() {
  if (confirm('Start a new brainstorming session? This will create a new room.')) {
    window.location.reload();
  }
}

export function loadIdeasWithAIScores() {
  console.log('[FRONTEND] Loading ideas with AI scores');
  // Ideas will be displayed when AI scores arrive via WebSocket
  // Show existing ideas immediately
  if (state.currentIdeas && state.currentIdeas.length > 0) {
    const list = document.getElementById('ideasList');
    if (list) {
      list.innerHTML = '';
      state.currentIdeas.forEach(idea => {
        const card = document.createElement('div');
        card.className = 'idea-card';
        card.id = `idea-${idea.id}`;
        card.innerHTML = `
          <strong>${idea.title}</strong>
          <p>${idea.description}</p>
          <small>By ${idea.userName}</small>
          <div id="aiScore-${idea.id}" class="ai-score-section hidden">
            <p><strong>AI Feasibility Score:</strong> <span id="score-${idea.id}"></span>/5</p>
            <p id="reasoning-${idea.id}"></p>
          </div>
          <button id="selectBtn-${idea.id}" onclick="selectWinningIdea(${idea.id})" class="btn btn-success mt-3 hidden">
            Select This Idea & Build PRD
          </button>
        `;
        list.appendChild(card);
      });
    }
  }
}

export function displayAIScore(ideaId, scoreData) {
  console.log('[FRONTEND] Displaying AI score for idea', ideaId, scoreData);

  const scoreDiv = document.getElementById(`aiScore-${ideaId}`);
  const scoreSpan = document.getElementById(`score-${ideaId}`);
  const reasoningP = document.getElementById(`reasoning-${ideaId}`);
  const selectBtn = document.getElementById(`selectBtn-${ideaId}`);

  if (scoreDiv && scoreSpan && reasoningP) {
    scoreSpan.textContent = scoreData.score;
    reasoningP.textContent = scoreData.reasoning;
    scoreDiv.classList.remove('hidden');

    if (selectBtn) {
      selectBtn.classList.remove('hidden');
    }
  }

  // Check if all ideas have been scored
  const allIdeas = state.currentIdeas || [];
  const scoredIdeas = allIdeas.filter(idea => {
    const div = document.getElementById(`aiScore-${idea.id}`);
    return div && !div.classList.contains('hidden');
  });

  if (scoredIdeas.length === allIdeas.length && allIdeas.length > 0) {
    // All ideas scored - update status message
    const statusDiv = document.getElementById('aiScoringStatus');
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div class="status-indicator status-success">
          <span class="status-dot"></span>
          <span class="status-text">AI Scoring Complete!</span>
        </div>
        <p style="margin-top: 10px; color: var(--color-gray-600);">Review the scores and select your winning idea to proceed.</p>
      `;
      statusDiv.classList.add('complete');
    }
  }
}

export function selectWinningIdea(ideaId) {
  console.log('[FRONTEND] Selecting winning idea:', ideaId);

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to server. Please refresh.');
    return;
  }

  if (confirm('Select this idea and proceed to build the PRD?')) {
    state.ws.send(JSON.stringify({
      type: 'selectWinningIdea',
      payload: { ideaId }
    }));
  }
}

export function displayPRDQuestion(questionData) {
  console.log('[FRONTEND] Displaying PRD question:', questionData);

  state.currentPRDQuestionId = questionData.id;
  window.currentPRDQuestionId = questionData.id;

  const questionNum = document.getElementById('currentQuestionNum');
  const questionLoading = document.getElementById('questionLoading');
  const questionContent = document.getElementById('questionContent');
  const questionText = document.getElementById('questionText');
  const answerInput = document.getElementById('answerInput');

  if (questionNum) questionNum.textContent = questionData.sortOrder || '?';
  if (questionLoading) questionLoading.classList.add('hidden');
  if (questionContent) questionContent.classList.remove('hidden');
  if (questionText) questionText.textContent = questionData.questionText;
  if (answerInput) answerInput.value = '';

  // Store previous answers
  if (!state.prdAnswers) state.prdAnswers = [];
  if (!window.prdAnswers) window.prdAnswers = [];
}

export function submitPRDAnswer() {
  const answerInput = document.getElementById('answerInput');
  const answerText = answerInput ? answerInput.value.trim() : '';

  if (!answerText) {
    alert('Please provide an answer');
    return;
  }

  if (!state.currentPRDQuestionId) {
    alert('No active question');
    return;
  }

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to server. Please refresh.');
    return;
  }

  console.log('[FRONTEND] Submitting PRD answer');
  state.ws.send(JSON.stringify({
    type: 'answerPRDQuestion',
    payload: {
      questionId: state.currentPRDQuestionId,
      answerText
    }
  }));

  // Add to previous Q&A
  const previousQA = document.getElementById('previousQA');
  if (previousQA) {
    const qaCard = document.createElement('div');
    qaCard.className = 'prd-qa-card';
    qaCard.innerHTML = `
      <p class="prd-qa-label">Q${state.prdAnswers.length + 1}:</p>
      <p>${document.getElementById('questionText').textContent}</p>
      <p class="prd-qa-label">Your Answer:</p>
      <p style="font-style: italic;">${answerText}</p>
    `;
    previousQA.appendChild(qaCard);
  }

  // Store answer locally
  state.prdAnswers.push(answerText);
  window.prdAnswers = state.prdAnswers;

  // Show loading state
  const questionContent = document.getElementById('questionContent');
  const questionLoading = document.getElementById('questionLoading');
  if (questionContent) questionContent.classList.add('hidden');
  if (questionLoading) {
    questionLoading.classList.remove('hidden');
    questionLoading.innerHTML = `
      <div class="status-indicator status-loading">
        <span class="status-dot"></span>
        <span class="status-text">Generating next question...</span>
      </div>
    `;
  }
}

export function loadPRDDocument() {
  console.log('[FRONTEND] Loading PRD document');

  // PRD will be in state.currentPRD from the prdComplete message
  if (state.currentPRD) {
    displayPRDPreview(state.currentPRD);
  } else {
    // Try to fetch from backend if not in memory
    console.log('[FRONTEND] No PRD in memory, waiting for WebSocket...');
  }
}

function displayPRDPreview(prd) {
  console.log('[FRONTEND] Displaying PRD preview:', prd);

  const preview = document.getElementById('prdPreview');
  if (!preview) return;

  let coreFeatures = [];
  let successCriteria = [];
  let techStack = {};
  let timeline = {};

  try {
    coreFeatures = prd.core_features ? JSON.parse(prd.core_features) : [];
    successCriteria = prd.success_criteria ? JSON.parse(prd.success_criteria) : [];
    techStack = prd.tech_stack ? JSON.parse(prd.tech_stack) : {};
    timeline = prd.timeline ? JSON.parse(prd.timeline) : {};
  } catch (e) {
    console.error('Error parsing PRD JSON:', e);
  }

  preview.innerHTML = `
    <h2>Product Requirements Document</h2>

    <h3>Problem Statement</h3>
    <p>${prd.problem_statement || 'N/A'}</p>

    <h3>Solution Overview</h3>
    <p>${prd.solution_overview || 'N/A'}</p>

    <h3>Target Users</h3>
    <p>${prd.target_users || 'N/A'}</p>

    <h3>Core Features</h3>
    <ul>
      ${coreFeatures.map(f => `<li>${f}</li>`).join('')}
    </ul>

    <h3>Tech Stack</h3>
    <ul>
      <li><strong>Frontend:</strong> ${techStack.frontend || 'N/A'}</li>
      <li><strong>Backend:</strong> ${techStack.backend || 'N/A'}</li>
      <li><strong>Database:</strong> ${techStack.database || 'N/A'}</li>
      <li><strong>Deployment:</strong> ${techStack.deployment || 'N/A'}</li>
    </ul>
    <p style="margin-top: 10px; font-style: italic;">${techStack.reasoning || ''}</p>

    <h3>Timeline</h3>
    <ul>
      ${timeline.phase1 ? `<li><strong>Phase 1:</strong> ${timeline.phase1}</li>` : ''}
      ${timeline.phase2 ? `<li><strong>Phase 2:</strong> ${timeline.phase2}</li>` : ''}
      ${timeline.phase3 ? `<li><strong>Phase 3:</strong> ${timeline.phase3}</li>` : ''}
      ${timeline.buffer ? `<li><strong>Buffer:</strong> ${timeline.buffer}</li>` : ''}
    </ul>

    <h3>Success Criteria</h3>
    <ul>
      ${successCriteria.map(c => `<li>${c}</li>`).join('')}
    </ul>

    ${prd.constraints ? `
      <h3>Constraints</h3>
      <p>${prd.constraints}</p>
    ` : ''}

    <p style="margin-top: 30px; text-align: center; color: var(--color-gray-500); font-size: var(--text-sm);">
      Generated by HackMatch PRD Generator<br/>
      ${new Date().toLocaleString()}
    </p>
  `;
}

export function downloadPRD() {
  console.log('[FRONTEND] Downloading PRD');

  if (!state.currentPRD) {
    alert('No PRD available to download');
    return;
  }

  const prd = state.currentPRD;

  let coreFeatures = [];
  let successCriteria = [];
  let techStack = {};
  let timeline = {};

  try {
    coreFeatures = prd.core_features ? JSON.parse(prd.core_features) : [];
    successCriteria = prd.success_criteria ? JSON.parse(prd.success_criteria) : [];
    techStack = prd.tech_stack ? JSON.parse(prd.tech_stack) : {};
    timeline = prd.timeline ? JSON.parse(prd.timeline) : {};
  } catch (e) {
    console.error('Error parsing PRD JSON:', e);
  }

  const markdown = `# Product Requirements Document

## Problem Statement

${prd.problem_statement || 'N/A'}

## Solution Overview

${prd.solution_overview || 'N/A'}

## Target Users

${prd.target_users || 'N/A'}

## Core Features

${coreFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## Tech Stack

- **Frontend:** ${techStack.frontend || 'N/A'}
- **Backend:** ${techStack.backend || 'N/A'}
- **Database:** ${techStack.database || 'N/A'}
- **Deployment:** ${techStack.deployment || 'N/A'}

**Reasoning:** ${techStack.reasoning || 'N/A'}

## Timeline

${timeline.phase1 ? `- **Phase 1:** ${timeline.phase1}` : ''}
${timeline.phase2 ? `- **Phase 2:** ${timeline.phase2}` : ''}
${timeline.phase3 ? `- **Phase 3:** ${timeline.phase3}` : ''}
${timeline.buffer ? `- **Buffer:** ${timeline.buffer}` : ''}

## Success Criteria

${successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${prd.constraints ? `## Constraints\n\n${prd.constraints}` : ''}

---
*Generated by HackMatch PRD Generator*
*${new Date().toLocaleString()}*
`;

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PRD-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);

  console.log('[FRONTEND] PRD downloaded');
}

export function regeneratePRD() {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to server. Please refresh.');
    return;
  }

  if (confirm('Regenerate the PRD? This will use your previous answers.')) {
    console.log('[FRONTEND] Requesting PRD regeneration');
    state.ws.send(JSON.stringify({
      type: 'regeneratePRD'
    }));

    const preview = document.getElementById('prdPreview');
    if (preview) {
      preview.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div class="status-indicator status-loading">
            <span class="status-dot"></span>
            <span class="status-text">Regenerating PRD...</span>
          </div>
        </div>
      `;
    }
  }
}
