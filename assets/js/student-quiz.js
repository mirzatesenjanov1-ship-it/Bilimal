/**
 * Bilimal.org - Окуучунун Тест Логикасы Жана Anti-Cheat Мониторинги (JS)
 */

const QuizEngine = {
    testData: null,
    studentInfo: { name: "", group: "" },
    currentQuestionIndex: 0,
    studentAnswers: {}, // { questionId: selectedOptionIndex }
    cheatAttemptsCount: 0,
    timerInterval: null,
    timeRemaining: 0
};

// Тестти баштоо жана каттоону жабуу
function startStudentQuiz(event) {
    event.preventDefault();
    
    QuizEngine.studentInfo.name = document.getElementById('st-name').value.trim();
    QuizEngine.studentInfo.group = document.getElementById('st-class').value.trim();

    document.getElementById('auth-gate-screen').classList.add('hidden');
    document.getElementById('active-quiz-viewport').classList.remove('hidden');

    document.getElementById('display-student-badge').innerText = `Окуучу: ${QuizEngine.studentInfo.name} (${QuizEngine.studentInfo.group})`;

    loadActiveTest();
    initAntiCheatSystem();
}

// Тесттин мазмунун жүктөө
function loadActiveTest() {
    // Жогорудагы борбордук базадан (storage.js) акыркы тестти же дефолттук тестти алуу
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('id') || 'test_1';
    
    // Имитациялык суроолор топтому (Мугалим түзгөн базадан алынат)
    QuizEngine.testData = {
        id: testId,
        title: "Ньютондун мыйзамдары жана Динамика",
        duration: 20, // 20 мүнөт
        questions: [
            { id: "q1", type: "SINGLE_CHOICE", title: "Ньютондун экинчи мыйзамынын формуласы кандай?", options: ["F = m*a", "F = m/a", "P = m*g", "E = m*c²"], correct: 0, points: 2 },
            { id: "q2", type: "TRUE_FALSE", title: "Инерция бул — нерсеге башка нерселер аракет этпегендеги ылдамдыгын сактоо кубулушу.", options: ["Чындык", "Жалган"], correct: 0, points: 1 },
            { id: "q3", type: "SINGLE_CHOICE", title: "Нерсенин массасы эмненин ченеми болуп эсептелет?", options: ["Көлөмдүн", "Инерттүүлүктүн", "Тездиктин", "Күчтүн"], correct: 1, points: 2 }
        ]
    };

    document.getElementById('display-quiz-title').innerText = QuizEngine.testData.title;
    QuizEngine.timeRemaining = QuizEngine.testData.duration * 60;
    
    startQuizTimer();
    renderCurrentQuestion();
}

// СУРООНУ ЭКРАНГА ЧЫГАРУУ
function renderCurrentQuestion() {
    const root = document.getElementById('quiz-question-card-root');
    if (!root) return;

    const currentQuestion = QuizEngine.testData.questions[QuizEngine.currentQuestionIndex];
    const savedAnswer = QuizEngine.studentAnswers[currentQuestion.id];

    let optionsHtml = '';
    if (currentQuestion.type === 'SINGLE_CHOICE' || currentQuestion.type === 'TRUE_FALSE') {
        optionsHtml = currentQuestion.options.map((opt, idx) => `
            <label style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.02); padding: 14px; margin-bottom: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer;">
                <input type="radio" name="student_ans" value="${idx}" ${savedAnswer == idx ? 'checked' : ''} onchange="saveStudentAnswer('${currentQuestion.id}', ${idx})">
                <span>${opt}</span>
            </label>
        `).join('');
    }

    root.innerHTML = `
        <span style="color: var(--cyan-glow); font-size:12px; font-weight:bold; text-transform:uppercase;">Суроо №${QuizEngine.currentQuestionIndex + 1} (Балл: ${currentQuestion.points})</span>
        <h3 style="margin: 8px 0 20px 0; font-size: 18px; line-height: 1.5;">${currentQuestion.title}</h3>
        <div class="options-container-block">${optionsHtml}</div>
    `;

    // Навигация баскычтарынын абалы
    document.getElementById('btn-quiz-prev').disabled = (QuizEngine.currentQuestionIndex === 0);
    
    if (QuizEngine.currentQuestionIndex === QuizEngine.testData.questions.length - 1) {
        document.getElementById('btn-quiz-next').classList.add('hidden');
        document.getElementById('btn-quiz-finish').classList.remove('hidden');
    } else {
        document.getElementById('btn-quiz-next').classList.remove('hidden');
        document.getElementById('btn-quiz-finish').classList.add('hidden');
    }
}

function saveStudentAnswer(qId, optionIdx) {
    QuizEngine.studentAnswers[qId] = optionIdx;
}

function nextQuestion() {
    if (QuizEngine.currentQuestionIndex < QuizEngine.testData.questions.length - 1) {
        QuizEngine.currentQuestionIndex++;
        renderCurrentQuestion();
    }
}

function prevQuestion() {
    if (QuizEngine.currentQuestionIndex > 0) {
        QuizEngine.currentQuestionIndex--;
        renderCurrentQuestion();
    }
}

// ТАЙМЕР
function startQuizTimer() {
    const timerDisplay = document.getElementById('quiz-countdown-timer');
    QuizEngine.timerInterval = setInterval(() => {
        QuizEngine.timeRemaining--;
        
        let minutes = Math.floor(QuizEngine.timeRemaining / 60);
        let seconds = QuizEngine.timeRemaining % 60;
        
        timerDisplay.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (QuizEngine.timeRemaining <= 0) {
            clearInterval(QuizEngine.timerInterval);
            finishQuizAction();
        }
    }, 1000);
}

/* ==========================================================================
   ИНТЕЛЛЕКТУАЛДЫК ANTI-CHEAT СИСТЕМА СУБ-МОДУЛУ (VISIBILITY API)
   ========================================================================== */
function initAntiCheatSystem() {
    const alertBanner = document.getElementById('anticheat-warning-banner');

    // 1. Вкладкадан же браузерден башка жакка өткөндү аныктоо
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            registerCheatAttempt();
        }
    });

    // 2. Терезенин фокусу жоголгондо (Alt+Tab же башка программа ачылганда)
    window.addEventListener('blur', () => {
        registerCheatAttempt();
    });

    function registerCheatAttempt() {
        QuizEngine.cheatAttemptsCount++;
        if (alertBanner) {
            alertBanner.classList.remove('hidden');
            // 5 секунддан кийин эскертүүнү жумшак жашыруу
            setTimeout(() => alertBanner.classList.add('hidden'), 5000);
        }
        
        // Борбордук логдорго реалдуу убакытта кошуу (Браузердик fallback база)
        if (window.BilimalStorage) {
            BilimalStorage.logActivity(
                'STUDENT-MONITOR', 
                'ANTI-CHEAT', 
                `Окуучу ${QuizEngine.studentInfo.name} (${QuizEngine.studentInfo.group}) башка терезеге өттү! Ката саны: ${QuizEngine.cheatAttemptsCount}`
            );
        }
    }
}

// ТЕСТТИ АЯКТОО ЖАНА БААЛОО АЛГОРИТМИ
function finishQuizAction() {
    clearInterval(QuizEngine.timerInterval);
    
    let totalScore = 0;
    let earnedScore = 0;

    QuizEngine.testData.questions.forEach(q => {
        totalScore += q.points;
        if (QuizEngine.studentAnswers[q.id] !== undefined && QuizEngine.studentAnswers[q.id] === q.correct) {
            earnedScore += q.points;
        }
    });

    let percent = totalScore > 0 ? Math.round((earnedScore / totalScore) * 100) : 0;

    // Жыйынтыктар экранын көрсөтүү
    document.getElementById('active-quiz-viewport').classList.add('hidden');
    document.getElementById('quiz-result-screen').classList.remove('hidden');

    document.getElementById('res-student-score').innerText = `${earnedScore} / ${totalScore}`;
    document.getElementById('res-student-percent').innerText = `${percent}%`;
    
    const reportField = document.getElementById('res-anticheat-report');
    if (QuizEngine.cheatAttemptsCount > 0) {
        reportField.innerHTML = `⚠️ Коопсуздук эскертүүсү: Тест учурунда <b>${QuizEngine.cheatAttemptsCount} жолу</b> башка терезеге өттүңүз. Бул маалымат мугалимге жөнөтүлдү.`;
        reportField.style.color = 'var(--alert-red)';
    } else {
        reportField.innerHTML = `Коопсуздук абалы: Таза 🛡️ (Эреже бузуу катталган жок)`;
        reportField.style.style = 'color: #10b981;';
    }
}
