import { joinRoom } from './websocket.js';
import {
  submitIdea,
  sendMessage,
  saveHackathonSetup,
  nextStage,
  resetToStageR,
  scoreIdea,
  requestAIScoring,
  selectWinningIdea,
  submitPRDAnswer,
  downloadPRD,
  startOver,
  regeneratePRD
} from './handlers.js';

// Expose functions to window for onclick handlers
window.joinRoom = joinRoom;
window.submitIdea = submitIdea;
window.sendMessage = sendMessage;
window.saveHackathonSetup = saveHackathonSetup;
window.nextStage = nextStage;
window.resetToStageR = resetToStageR;
window.scoreIdea = scoreIdea;
window.requestAIScoring = requestAIScoring;
window.selectWinningIdea = selectWinningIdea;
window.submitPRDAnswer = submitPRDAnswer;
window.downloadPRD = downloadPRD;
window.startOver = startOver;
window.regeneratePRD = regeneratePRD;

console.log('HackMatch app initialized');
