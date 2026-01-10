import { state } from './state.js';
import { loadIdeasWithAIScores, loadPRDDocument } from './handlers.js';

export function updateStageUI() {
  const content = document.getElementById('stageContent');
  const titles = {
    'R': 'Review - Hackathon Setup',
    'A': 'All Ideas Welcome',
    'P': 'Prioritize with AI',
    'PRD': 'Build Your PRD',
    'D': 'Download PRD'
  };

  document.getElementById('stageTitle').textContent = titles[state.currentStage];

  if (state.currentStage === 'R') {
    content.innerHTML = `
      <h3>Welcome to HackMatch PRD Generator!</h3>
      <p>Let's gather your hackathon details to generate a comprehensive PRD.</p>

      <div class="stage-setup-workflow">
        <h4>New Workflow:</h4>
        <ul>
          <li>Review - Enter hackathon details</li>
          <li>All Ideas - Team brainstorms ideas</li>
          <li>Prioritize - AI rates all ideas, team picks winner</li>
          <li>Build PRD - AI asks 6 questions to create comprehensive PRD</li>
          <li>Download - Get your PRD as Markdown file</li>
        </ul>
      </div>

      <div class="stage-setup-info">
        <h4>Hackathon Setup</h4>

        <div class="stage-setup-grid">
          <div class="stage-setup-field">
            <label>Team Size</label>
            <input type="number" id="teamSize" value="4" min="1" max="10" />
          </div>
          <div class="stage-setup-field">
            <label>Time Available (hours)</label>
            <input type="number" id="timeHours" value="24" min="1" max="72" />
          </div>
        </div>

        <div class="stage-setup-field">
          <label>Hackathon Rules & Constraints</label>
          <textarea id="hackathonRules" placeholder="E.g., Must use specific API, submission deadline, judging criteria..." rows="3"></textarea>
        </div>

        <div class="stage-setup-field">
          <label>Sponsor Name (Optional)</label>
          <input type="text" id="sponsorName" placeholder="E.g., Cloudflare, Google, Microsoft..." />
        </div>

        <div class="stage-setup-field">
          <label>Sponsor Details (Optional)</label>
          <textarea id="sponsorDetails" placeholder="E.g., Prize amount, special requirements..." rows="2"></textarea>
        </div>

        <div class="stage-setup-field">
          <label>Primary Track/Challenge</label>
          <select id="primaryTrack">
            <option value="">Select a track...</option>
            <option value="Best Use of AI">Best Use of AI</option>
            <option value="Social Impact">Social Impact</option>
            <option value="Best Design">Best Design</option>
            <option value="Most Innovative">Most Innovative</option>
            <option value="Best Hardware Hack">Best Hardware Hack</option>
            <option value="Sustainability">Sustainability</option>
            <option value="Education">Education</option>
            <option value="Healthcare">Healthcare</option>
            <option value="FinTech">FinTech</option>
            <option value="Gaming">Gaming</option>
            <option value="Open Track">Open Track</option>
            <option value="Other">Other (specify in chat)</option>
          </select>
        </div>

        <div class="info-label">
          <span class="info-label-prefix">Tip</span>
          <span>This information will help AI tailor the PRD to your specific hackathon!</span>
        </div>
      </div>

      <button id="startBrainstormBtn" onclick="saveHackathonSetup()" class="btn btn-primary btn-lg">Save & Start Brainstorming</button>
    `;
  } else if (state.currentStage === 'A') {
    content.innerHTML = `
      <h3>Submit Your Ideas</h3>
      <div class="stage-ideas-input">
        <input type="text" id="ideaTitle" placeholder="Idea title" />
        <textarea id="ideaDescription" placeholder="Describe your idea..." rows="4"></textarea>
        <button onclick="submitIdea()" class="btn btn-primary">Submit Idea</button>
      </div>
      <h3>Team Ideas</h3>
      <div class="ideas-list" id="ideasList"></div>
      <button onclick="nextStage()" class="btn btn-success mt-4">Next: Prioritize Ideas</button>
    `;
  } else if (state.currentStage === 'P') {
    content.innerHTML = `
      <h3>Prioritize Ideas with AI</h3>
      <p>Review your team's ideas below. When ready, click the button to get AI feasibility scores, then select the winning idea!</p>

      <div class="ideas-list" id="ideasList"></div>

      <button onclick="requestAIScoring()" class="btn btn-with-prefix btn-primary btn-lg mt-6">
        <span class="btn-prefix">AI</span>
        <span>Get Feasibility Scores</span>
      </button>

      <div id="aiScoringStatus" class="ai-scoring-status hidden">
        <div class="status-indicator status-loading">
          <span class="status-dot"></span>
          <span class="status-text">AI is scoring ideas...</span>
        </div>
        <p style="margin-top: 10px; color: var(--color-gray-600);">Please wait while AI evaluates feasibility, risks, and recommendations for each idea.</p>
      </div>
    `;
    loadIdeasWithAIScores();
  } else if (state.currentStage === 'PRD') {
    content.innerHTML = `
      <h3>Building Your PRD</h3>
      <p>AI will ask 6 targeted questions to create a comprehensive Product Requirements Document.</p>

      <div id="prdProgress" class="prd-progress">
        <strong>Question <span id="currentQuestionNum">1</span> of 6</strong>
      </div>

      <div id="previousQA"></div>

      <div id="currentQuestion" class="prd-question-card">
        <div id="questionLoading" style="text-align: center; padding: 20px;">
          <div class="status-indicator status-loading">
            <span class="status-dot"></span>
            <span class="status-text">AI is preparing your first question...</span>
          </div>
        </div>
        <div id="questionContent" class="hidden">
          <h4>Question:</h4>
          <p id="questionText" class="prd-question-text"></p>
          <textarea id="answerInput" placeholder="Type your answer here..." rows="5"></textarea>
          <button onclick="submitPRDAnswer()" class="btn btn-primary mt-4">Submit Answer</button>
        </div>
      </div>

      <div id="prdComplete" class="prd-complete-notice hidden">
        <div class="status-indicator status-success mb-3">
          <span class="status-dot"></span>
          <span class="status-text">PRD Generation Complete!</span>
        </div>
        <p>All questions answered. Generating your comprehensive PRD...</p>
      </div>
    `;
  } else if (state.currentStage === 'D') {
    content.innerHTML = `
      <h3>Your Product Requirements Document</h3>
      <p>Here's your comprehensive PRD! Review it and download as Markdown.</p>

      <div id="prdPreview" class="prd-preview">
        <div style="text-align: center; padding: 40px;">
          <div class="status-indicator status-loading">
            <span class="status-dot"></span>
            <span class="status-text">Loading your PRD...</span>
          </div>
        </div>
      </div>

      <div class="prd-actions">
        <button onclick="downloadPRD()" class="btn btn-success btn-lg">
          Download PRD (Markdown)
        </button>
        <button onclick="startOver()" class="btn btn-secondary">
          Start New Session
        </button>
      </div>

      <div class="prd-regenerate-notice">
        <h4>Need to make changes?</h4>
        <p style="margin-top: 10px;">Use the team chat to discuss refinements, then click the button below to regenerate the PRD with updated answers.</p>
        <button onclick="regeneratePRD()" class="btn btn-error mt-3">
          Regenerate PRD
        </button>
      </div>
    `;
    loadPRDDocument();
  }
}
