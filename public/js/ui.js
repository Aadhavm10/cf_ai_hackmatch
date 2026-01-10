import { state } from './state.js';

export function updateStageProgress() {
  const stages = document.querySelectorAll('.stage');
  const stageOrder = ['R', 'A', 'P', 'PRD', 'D'];
  const currentIndex = stageOrder.indexOf(state.currentStage);

  stages.forEach((stage, index) => {
    stage.classList.remove('active', 'completed');
    if (index < currentIndex) {
      stage.classList.add('completed');
    } else if (index === currentIndex) {
      stage.classList.add('active');
    }
  });
}
