// Global application state
export const state = {
  ws: null,
  currentStage: 'R',
  roomId: '',
  userId: Math.random().toString(36).substr(2, 9),
  userName: '',
  currentIdeas: [],
  currentPRD: null,
  currentPRDQuestionId: null,
  prdAnswers: []
};

// Expose to window for onclick handlers (temporary)
window.currentIdeas = state.currentIdeas;
window.currentPRD = state.currentPRD;
window.currentPRDQuestionId = state.currentPRDQuestionId;
window.prdAnswers = state.prdAnswers;
