import { createAssistant, createSmartappDebugger, createAssistantClient } from '@salutejs/client';
import { mathFacts } from './questions.js';

// variables
let time = 10;
let timerId;
let score = 0;
let currentQuestionIndex = 0; 
let currentLevel = 'easy';
let questionCount = 0;
const maxQuestions = 10;
let highScore = localStorage.getItem('mathQuizHighScore') || 0;
let correctAnswers = 0;
let totalTimeUsed = 0;
let speedBonuses = 0;
let usedFacts = []; // для отслеживания использованных mathFacts
let client;


const startMenu = document.getElementById('startMenu');
const quizContainer = document.getElementById('quizContainer');
const resultsContainer = document.getElementById('resultsContainer');
const startBtn = document.getElementById('startBtn');
const backBtn = document.getElementById('backBtn');
const backBtnDifficulty = document.getElementById('backBtnDifficulty');
const backBtnResults = document.getElementById('backBtnResults');
const restartBtn = document.getElementById('restartBtn');
const questionEl = document.getElementById('question');
const answersEl = document.getElementById('answers');
const timeEl = document.getElementById('time');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const levelDisplay = document.getElementById('levelDisplay');
const difficultyBtns = document.querySelectorAll('.difficulty_btn');
const difficultyMenu = document.getElementById('difficultyMenu');
const currentQuestionEl = document.getElementById('currentQuestion');
const totalQuestionsEl = document.getElementById('totalQuestions');
const progressBar = document.getElementById('progressBar');
const finalScoreEl = document.getElementById('finalScore');
const correctAnswersEl = document.getElementById('correctAnswers');
const totalAnswersEl = document.getElementById('totalAnswers');
const avgTimeEl = document.getElementById('avgTime');
const speedBonusEl = document.getElementById('speedBonus');
const ratingStarsEl = document.getElementById('ratingStars');

const urlParams = new URLSearchParams(window.location.search);
const isDevMode = urlParams.get('devel') === 'true';


// Difficulty levels
const levels = {
  easy: {
    name: 'Легкий',
    time: 30,
    operations: ['+', '-', '*', '/', '√', '²', '%', 'mixed'],
    range: [10, 100],
    color: '#2E7D32'
  },
  medium: {
    name: 'Средний',
    time: 40,
    operations: [], // удалены арифметические операции
    range: [5, 15],
    color: '#FF8F00'
  },
  hard: {
    name: 'Сложный',
    time: 60,
    operations: [], // удалены арифметические операции
    range: [10, 20],
    color: '#7B1FA2'
  }
};

const initializeAssistant = (getState, getRecoveryState) => {
  try {
    const token = import.meta.env.VITE_TOKEN ?? '';
    const smartapp = import.meta.env.VITE_SMARTAPP;

    if (process.env.NODE_ENV === 'development') {
      console.info('Starting in DEV mode');
      return createSmartappDebugger({
        token,
        initPhrase: `Открой ${smartapp}`,
        getState,
        nativePanel: {
          defaultText: '',
          screenshotMode: false,
          tabIndex: -1,
        },
      });
    } else {
      console.info('Starting in PRODUCTION mode');
      return createAssistant({ getState });
    }
  } catch (e) {
    console.error('Assistant initialization error:', e);
    return null;
  }
};


// Получение текущего состояния для ассистента
function getCurrentState() {
  const state = {
    screen: getCurrentScreen(),
    items: [],
    score: score ?? 0,
    questionIndex: currentQuestionIndex ?? 0,
    difficulty: currentLevel ?? 'easy'
  };

  // Handle different screens
  switch (state.screen) {
    case 'startMenu':
      state.items = [
        {
          title: 'Начать игру',
          number: 1,
          aliases: ['начать игру', 'играть', 'старт'],
          action: { type: 'start_game' }
        },
        {
          title: 'Выбор сложности',
          number: 2,
          aliases: ['выбор сложности', 'сложность'],
          action: { type: 'show_difficulty_menu' }
        }
      ];
      break;

    case 'difficultyMenu':
      state.items = Array.from(difficultyBtns).map(btn => ({
        title: btn.querySelector('.difficulty-name').textContent,
        number: btn.dataset.level === 'easy' ? 1 : btn.dataset.level === 'medium' ? 2 : 3,
        aliases: [btn.dataset.voiceCommand],
        action: { type: 'select_difficulty', payload: { level: btn.dataset.level } }
      }));
      break;

    case 'quiz':
      const answerButtons = answersEl.querySelectorAll('button');
      state.items = Array.from(answerButtons).map((btn, index) => ({
        title: btn.textContent,
        number: index + 1,
        aliases: [`вариант ${index + 1}`, `ответ ${index + 1}`],
        action: { type: 'answer', payload: { answer: btn.textContent } }
      }));
      break;

    case 'results':
      state.items = [
        {
          title: 'Играть снова',
          number: 1,
          aliases: ['играть снова', 'ещё раз'],
          action: { type: 'restart_game' }
        },
        {
          title: 'В главное меню',
          number: 2,
          aliases: ['главное меню', 'меню'],
          action: { type: 'back_to_menu' }
        }
      ];
      break;
  }

  return state;
}
// Получение текущего экрана
function getCurrentScreen() {
  if (infoModal && infoModal.style.display === 'flex') return 'InfoModal';
  if (!startMenu.classList.contains('hidden')) return 'startMenu';
  if (!difficultyMenu.classList.contains('hidden')) return 'difficultyMenu';
  if (!quizContainer.classList.contains('hidden')) return 'quiz';
  if (!resultsContainer.classList.contains('hidden')) return 'results';
  return 'startMenu';
}

// Обработка команд от ассистента
function handleAssistantCommand(command) {
  if (!command || !command.smart_app_data) return;

  const { type, payload } = command.smart_app_data;
  console.log('Assistant command:', type, payload);

  switch (type) {
    case 'start_game':
      startBtn.click();
      break;
    case 'select_difficulty':
      currentLevel = payload.level;
      startGame();
      break;
    case 'answer':
      handleAnswerCommand(payload);
      break;
    case 'help':
      openModal();
      break;
    case 'restart_game':
      restartBtn.click();
      break;
  }
}

function handleAnswerCommand(payload) {
  console.log('Handling answer command:', payload);
  
  setTimeout(() => {
    const buttons = Array.from(answersEl.querySelectorAll('button'));
    if (!buttons || buttons.length === 0) {
      console.error('No answer buttons found');
      return;
    }

    console.log('Available buttons:', buttons.map((btn, i) => `${i + 1}: ${btn.textContent.trim()}`));

    // 1. Попытка распознать как номер варианта (1-4)
    if (typeof payload.answer === 'number' || !isNaN(parseInt(payload.answer, 10))) {
      const answerNum = parseInt(payload.answer, 10);
      if (answerNum >= 1 && answerNum <= buttons.length) {
        const index = answerNum - 1;
        const button = buttons[index];
        console.log(`Clicking button ${answerNum} (text: "${button.textContent.trim()}")`);
        button.click();
        return;
      }
    }

    // 2. Попытка распознать как текст ответа
    const normalizedInput = payload.answer !== null && typeof payload.answer !== 'undefined'
      ? payload.answer.toString().trim().toLowerCase()
      : '';

    // Поиск точного совпадения
    const exactMatch = buttons.find(btn => 
      btn.textContent.trim().toLowerCase() === normalizedInput
    );
    
    if (exactMatch) {
      console.log(`Clicking exact match: "${exactMatch.textContent.trim()}"`);
      exactMatch.click();
      return;
    }

    // Поиск частичного совпадения
    const partialMatch = buttons.find(btn => {
      const btnText = btn.textContent.trim().toLowerCase();
      return (
        btnText.includes(normalizedInput) || 
        normalizedInput.includes(btnText)
      );
    });

    if (partialMatch) {
      console.log(`Clicking partial match: "${partialMatch.textContent.trim()}"`);
      partialMatch.click();
      return;
    }

    console.error('No matching button found for:', payload.answer);
  }, 100);
}
// Initialize
highScoreEl.textContent = highScore;
totalQuestionsEl.textContent = maxQuestions;

// Инициализация ассистента при загрузке
document.addEventListener('DOMContentLoaded', () => {
  client = initializeAssistant(() => getCurrentState());
  setInitialFocus();

  if (client) {
    client.on('data', handleAssistantCommand);
    client.on('start', (event) => {
      console.log('Assistant is ready');
    });
  }
});

// Event listeners
startBtn.addEventListener('click', () => {
  startMenu.classList.add('hidden');
  setTimeout(() => {
    difficultyMenu.style.display = 'flex';
    difficultyMenu.classList.remove('hidden');
  }, 300);
});

backBtn.addEventListener('click', () => {
  console.log('Back button clicked');
  backToMenu();
});
backBtnDifficulty.addEventListener('click', backToStartMenu);
backBtnResults.addEventListener('click', backToStartMenu);
restartBtn.addEventListener('click', restartGame);

difficultyBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentLevel = btn.dataset.level;
    startGame();
  });
});


const infoModal = document.getElementById('infoModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// Открыть модалку
function openModal() {
  if (!infoModal) return;
  
  infoModal.style.display = 'flex';
  infoModal.addEventListener('keydown', handleModalKeyDown);
  
  // Добавляем небольшую задержку для гарантированного отображения модального окна
  setTimeout(() => {
    closeModalBtn.focus();
    // Добавляем модальное окно в список доступных для навигации
    infoModal.setAttribute('aria-modal', 'true');
    infoModal.setAttribute('role', 'dialog');
  }, 50);
}

function closeModal() {
  if (!infoModal) return;
  
  infoModal.style.display = 'none';
  infoModal.removeEventListener('keydown', handleModalKeyDown);
  
  // Удаляем атрибуты модального окна
  infoModal.removeAttribute('aria-modal');
  infoModal.removeAttribute('role');
  
  // Возвращаем фокус на предыдущий активный элемент
  setInitialFocus();
}


// Закрыть при клике вне окна
window.addEventListener('click', (event) => {
  if (event.target === infoModal) {
    infoModal.style.display = 'none';
  }
});

function handleModalKeyDown(event) {
  if (event.key === 'Enter') {
    event.preventDefault(); // Предотвращаем возможное дублирование действия
    closeModal();
  }
}

// Close modal with button
closeModalBtn.addEventListener('click', closeModal);

// Close when clicking outside
window.addEventListener('click', (event) => {
  if (event.target === infoModal) {
    closeModal();
  }
});

/* пультик */
function setInitialFocus() {
  const currentScreen = getCurrentScreen();
  switch (currentScreen) {
    case 'startMenu':
      startBtn.focus();
      break;
    case 'difficultyMenu':
      difficultyBtns[0].focus();
      break;
    case 'quiz':
      const firstAnswerBtn = answersEl.querySelector('button');
      if (firstAnswerBtn) firstAnswerBtn.focus();
      break;
    case 'results':
      restartBtn.focus();
      break;
    case 'InfoModal':
      closeModalBtn.focus();
      break;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
      e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    handleNavigation(e.key);
  } else if (e.key === 'Enter') {
    const activeEl = document.activeElement;

    if (getCurrentScreen() === 'InfoModal' && activeEl === closeModalBtn) {
      e.preventDefault(); // Предотвращаем всплытие события
      closeModal();
      return;
    }
    

    if (activeEl && activeEl.click) {
      activeEl.click();
    }
    // Закрытие модального окна при нажатии Enter, если оно открыто
    if (getCurrentScreen() === 'InfoModal') {
      closeModal();
    }
  }
});

function handleNavigation(key) {
  const activeElement = document.activeElement;
  const currentScreen = getCurrentScreen();
  
  let focusableElements;
  
  switch(currentScreen) {
    case 'startMenu':
      focusableElements = [startBtn];
      break;
    case 'difficultyMenu':
      focusableElements = Array.from(difficultyBtns);
      focusableElements.push(backBtnDifficulty);
      break;
    case 'quiz':
      // Получаем все кнопки ответов и добавляем кнопку "Назад"
      const answerButtons = Array.from(answersEl.querySelectorAll('button'));
      focusableElements = [...answerButtons, backBtn];
      
      // Упрощенная логика навигации для quiz экрана
      const currentIndex = focusableElements.indexOf(activeElement);
      
      if (currentIndex === -1) {
        focusableElements[0].focus();
        return;
      }
      
      switch(key) {
        case 'ArrowUp':
          if (currentIndex < 2) {
            // Если в верхнем ряду - ничего не делаем
            return;
          } else if (currentIndex < 4) {
            // Перемещаемся из среднего ряда в верхний
            focusableElements[currentIndex - 2].focus();
          } else if (currentIndex === 4) {
            // Кнопка "Назад" - переходим в средний ряд (центральную кнопку)
            focusableElements[2].focus();
          }
          return;
        case 'ArrowDown':
          if (currentIndex < 2) {
            // Из верхнего ряда в средний
            focusableElements[currentIndex + 2].focus();
          } else if (currentIndex < 4) {
            // Из среднего ряда в "Назад"
            focusableElements[4].focus();
          }
          // Если уже на кнопке "Назад" - ничего не делаем
          return;
        case 'ArrowLeft':
          if (currentIndex < 4) {
            // Навигация между кнопками ответов
            const nextIndex = Math.max(currentIndex - 1, 0);
            focusableElements[nextIndex].focus();
          }
          // Для кнопки "Назад" left не делает ничего
          return;
        case 'ArrowRight':
          if (currentIndex < 4) {
            // Навигация между кнопками ответов
            const nextIndex = Math.min(currentIndex + 1, 3);
            focusableElements[nextIndex].focus();
          }
          // Для кнопки "Назад" right не делает ничего
          return;
      }
      break;
    case 'results':
      focusableElements = [restartBtn, backBtnResults];
      break; 
    case 'InfoModal':
      focusableElements = [closeModalBtn];
      if (activeElement !== closeModalBtn) {
        closeModalBtn.focus();
        return;
      }
      break;
    default:
      focusableElements = [];
  }
  
  // Стандартная линейная навигация для других случаев
  if (!focusableElements.length) return;
  
  const currentIndex = focusableElements.indexOf(activeElement);
  let nextIndex = 0;
  
  if (currentIndex === -1) {
    focusableElements[0].focus();
    return;
  }
  
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    nextIndex = Math.min(currentIndex + 1, focusableElements.length - 1);
  } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
    nextIndex = Math.max(currentIndex - 1, 0);
  }
  
  focusableElements[nextIndex].focus();
}
function startGame() {
  difficultyMenu.classList.add('hidden');
  setTimeout(() => {
    quizContainer.style.display = 'block';
    quizContainer.classList.remove('hidden');
    setInitialFocus();

}, 300);

  levelDisplay.textContent = levels[currentLevel].name;
  score = 0;
  questionCount = 0;
  correctAnswers = 0;
  totalTimeUsed = 0;
  speedBonuses = 0;
  usedFacts = []; // сброс использованных вопросов
  updateScore();
  generateQuestion();

}


function backToStartMenu() {
  difficultyMenu.classList.add('hidden');
  resultsContainer.classList.add('hidden');
  setTimeout(() => {
    startMenu.style.display = 'flex';
    startMenu.classList.remove('hidden');
    setInitialFocus();
  }, 300);
  clearInterval(timerId);
}

function backToMenu() {
  quizContainer.classList.add('hidden');
  setTimeout(() => {
    startMenu.style.display = 'flex';
    startMenu.classList.remove('hidden');
  }, 300);
  clearInterval(timerId);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateHardMathQuestion() {
  const { range } = levels[currentLevel];
  const [min, max] = range;
  const questionType = Math.floor(Math.random() * 8);

  let a, b, c, correct, questionText;

  switch (questionType) {
    case 0: // Комбинированные операции
      a = getRandomInt(15, 50);
      b = getRandomInt(10, 30);
      c = getRandomInt(5, 20);
      correct = a + b * c;
      questionText = `${a} + ${b} × ${c} = ?`;
      break;

    case 1: // Степени
      a = getRandomInt(2, 5);
      b = 2;
      correct = Math.pow(a, b);
      questionText = `${a}² = ?`;
      break;

    case 2: // Корни
      a = getRandomInt(2, 10);
      correct = a;
      questionText = `√${a * a} = ?`;
      break;

    case 3: // Проценты
      a = getRandomInt(10, 50);
      b = getRandomInt(100, 500);
      correct = Math.round(b * (a / 100));
      questionText = `${a}% от ${b} = ?`;
      break;

    case 4: // Дроби
      const denom = getRandomInt(2, 5);
      a = getRandomInt(1, denom - 1);
      b = getRandomInt(1, denom - 1);
      correct = a + b;
      questionText = `${a}/${denom} + ${b}/${denom} = ?/${denom}`;
      break;

    case 5: // Уравнения
      a = getRandomInt(5, 20);
      b = getRandomInt(5, 20);
      correct = b - a;
      questionText = `x + ${a} = ${b}, x = ?`;
      break;

    case 6: // Со скобками
      a = getRandomInt(5, 15);
      b = getRandomInt(5, 15);
      c = getRandomInt(2, 5);
      correct = (a + b) * c;
      questionText = `(${a} + ${b}) × ${c} = ?`;
      break;

    case 7: // Комплексный пример
      a = getRandomInt(10, 30);
      b = getRandomInt(5, 15);
      c = getRandomInt(2, 10);
      correct = a * b - c;
      questionText = `${a} × ${b} - ${c} = ?`;
      break;
  }

  const options = generateSmartOptions(correct, range);
  return { questionText, correct, options };
}

function generateSmartOptions(correct, range) {
  const options = [correct];
  const [min, max] = range;

  while (options.length < 4) {
    let wrong;
    const errorType = Math.floor(Math.random() * 3);

    switch (errorType) {
      case 0: // Ошибка в знаке
        wrong = -correct;
        break;
      case 1: // Ошибка в 1-2 единицы
        wrong = correct + (Math.random() > 0.5 ? 1 : -1) *
          Math.max(1, Math.floor(Math.random() * 3));
        break;
      case 2: // Случайное число
        wrong = getRandomInt(
          Math.max(min, correct - 10),
          Math.min(max, correct + 10)
        );
        break;
    }

    if (!options.includes(wrong) && wrong !== correct) {
      options.push(wrong);
    }
  }

  return options.sort(() => Math.random() - 0.5);
}


function generateQuestion() {
  if (questionCount >= maxQuestions) {
    endGame();
    return;
  }

  questionCount++;
  currentQuestionEl.textContent = questionCount;

  const { operations, range } = levels[currentLevel];
  const [min, max] = range;

  if (currentLevel === 'easy') {
    const useMathFact = mathFacts && mathFacts.some(f => f.level === 'easy' && !usedFacts.includes(f.question)) && Math.random() > 0.5;

    if (useMathFact) {
      const facts = mathFacts.filter(f => f.level === 'easy' && !usedFacts.includes(f.question));
      if (facts.length > 0) {
        const randomFact = facts[Math.floor(Math.random() * facts.length)];
        usedFacts.push(randomFact.question); // запоминаем
        showQuestion(randomFact.question, randomFact.answer, randomFact.options);
        return;
      }
    }

    const { questionText, correct, options } = generateHardMathQuestion();
    showQuestion(questionText, correct, options);
    return;
  }


  // medium / hard уровни: тоже проверим mathFacts
  const useMathFact = mathFacts && mathFacts.some(fact => fact.level === currentLevel && !usedFacts.includes(fact.question)) && Math.random() > 0.5;


  if (useMathFact) {
    const facts = mathFacts.filter(fact => fact.level === currentLevel);
    if (facts.length > 0) {
      const randomFact = facts[Math.floor(Math.random() * facts.length)];
      usedFacts.push(randomFact.question);
      showQuestion(randomFact.question, randomFact.answer, randomFact.options);
      return;
    }
  }

  if (operations.length === 0) {
    questionCount--; // отменяем инкремент, т.к. вопрос не сгенерирован
    generateQuestion(); // Рекурсивный вызов, пока не найдет подходящий факт
    return;
  }


  let a, b, correct, questionText;
  const operation = operations[Math.floor(Math.random() * operations.length)];

  switch (operation) {
    case '+':
      a = getRandomInt(min, max);
      b = getRandomInt(min, max);
      correct = a + b;
      questionText = `${a} + ${b} = ?`;
      break;
    case '-':
      a = getRandomInt(min, max);
      b = getRandomInt(min, a);
      correct = a - b;
      questionText = `${a} - ${b} = ?`;
      break;
    case '*':
      a = getRandomInt(min, Math.floor(max / 2));
      b = getRandomInt(min, Math.floor(max / 2));
      correct = a * b;
      questionText = `${a} × ${b} = ?`;
      break;
    case '/':
      b = getRandomInt(min, Math.floor(max / 2));
      correct = getRandomInt(min, Math.floor(max / 2));
      a = b * correct;
      questionText = `${a} ÷ ${b} = ?`;
      break;
  }

  const options = generateOptions(correct, range);
  showQuestion(questionText, correct, options);
}



function generateOptions(correct, range) {
  const options = [correct];
  const [min, max] = range;

  while (options.length < 4) {
    let wrong;
    if (Math.random() > 0.5) {
      wrong = correct + (Math.random() > 0.5 ? 1 : -1) *
        Math.max(1, Math.floor(Math.random() * 5));
    } else {
      wrong = getRandomInt(min, max);
    }

    if (!options.includes(wrong)) {
      options.push(wrong);
    }
  }

  return options.sort(() => Math.random() - 0.5);
}

function showQuestion(question, correct, options) {
  questionEl.classList.remove('new');
  questionEl.textContent = question;
  void questionEl.offsetWidth;
  questionEl.classList.add('new');

  answersEl.innerHTML = '';
  options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.textContent = option;

    // Добавляем атрибут для текстовых ответов
    if (typeof correct === 'string' || isNaN(Number(option))) {
      btn.setAttribute('data-text', 'true');
      btn.style.whiteSpace = 'normal';
    }

    btn.onclick = () => checkAnswer(option, correct);
    answersEl.appendChild(btn);
  });

  resetTimer();
}


function checkAnswer(selected, correct) {
  const answerTime = levels[currentLevel].time - time;
  totalTimeUsed += answerTime;

  clearInterval(timerId);

  // Нормализуем значения перед использованием
  const normalizedCorrect = typeof correct === 'string' ? correct.trim() : correct;
  const normalizedSelected = selected !== null && typeof selected === 'string' 
    ? selected.trim() 
    : selected;

  const buttons = answersEl.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.disabled = true;
    const btnValue = btn.textContent;
    const normalizedBtnValue = typeof btnValue === 'string' ? btnValue.trim() : btnValue;

    const isCorrect = !isNaN(normalizedCorrect)
      ? parseFloat(normalizedBtnValue) === parseFloat(normalizedCorrect)
      : normalizedBtnValue === normalizedCorrect;

    const isSelectedWrong = selected !== null 
      ? (!isNaN(normalizedSelected)
          ? parseFloat(normalizedSelected) === parseFloat(normalizedBtnValue) && !isCorrect
          : normalizedSelected === normalizedBtnValue && !isCorrect)
      : false;

    requestAnimationFrame(() => {
      if (isCorrect) {
        btn.classList.add('correct');
      } else if (isSelectedWrong) {
        btn.classList.add('incorrect');
      }
    });
  });

  setTimeout(() => {
    // Проверка правильности ответа
    const isAnswerCorrect = selected !== null
      ? (!isNaN(normalizedCorrect)
          ? parseFloat(selected) === parseFloat(normalizedCorrect)
          : normalizedSelected === normalizedCorrect)
      : false;

    if (selected === null) {
      score = Math.max(0, score - 5);
    } else if (isAnswerCorrect) {
      correctAnswers++;
      let points = levels[currentLevel].time;
      const speedBonus = Math.floor((time / levels[currentLevel].time) * 5);
      points += speedBonus;
      speedBonuses += speedBonus;
      score += points;
    } else {
      score = Math.max(0, score - 5);
    }

    updateScore();
    generateQuestion();
  }, 1000);
}


function resetTimer() {
  time = levels[currentLevel].time;
  timeEl.textContent = time;

  progressBar.innerHTML = `<div class="progress-bar-inner" style="width:100%; background:${levels[currentLevel].color}"></div>`;
  const progressBarInner = progressBar.querySelector('.progress-bar-inner');
  progressBarInner.style.transition = 'width 1s linear, background 0.3s ease';


  clearInterval(timerId);
  timerId = setInterval(() => {
    time--;
    timeEl.textContent = time;

    const percent = (time / levels[currentLevel].time) * 100;
    progressBarInner.style.width = `${percent}%`;

    if (percent < 30) {
      progressBarInner.style.background = '#F44336';
    } else if (percent < 60) {
      progressBarInner.style.background = '#FFC107';
    }

    if (time === 0) {
      clearInterval(timerId);
      checkAnswer(null, null);
    }
  }, 1000);
}

function updateScore() {
  scoreEl.textContent = score;
}

function endGame() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('mathQuizHighScore', highScore);
    highScoreEl.textContent = highScore;
  }

  const rating = Math.min(5, Math.max(1, Math.floor(correctAnswers / 2)));

  quizContainer.classList.add('hidden');
  setTimeout(() => {
    resultsContainer.style.display = 'flex';
    resultsContainer.classList.remove('hidden');
    setInitialFocus();

    finalScoreEl.textContent = score;
    correctAnswersEl.textContent = correctAnswers;
    totalAnswersEl.textContent = maxQuestions;
    avgTimeEl.textContent = (totalTimeUsed / maxQuestions).toFixed(1);
    speedBonusEl.textContent = speedBonuses;

    ratingStarsEl.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('div');
      star.className = i <= rating ? 'star' : 'star empty';
      star.innerHTML = '★';
      ratingStarsEl.appendChild(star);
    }

  }, 300);

}

function restartGame() {
  resultsContainer.classList.add('hidden');
  setTimeout(() => {
    startGame();
  }, 300);
}