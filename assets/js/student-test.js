/**
 * Bilimal.org - Окуучунун коопсуз тест тапшыруу катмары жана Anti-Cheat системасы
 */

let activeTest = null;
let studentIdentity = { name: '', studentClass: '' };
let cheatCount = 0;
let timerInterval = null;
let secondsLeft = 0;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('testId');

    if (!testId) {
        alert('Ката: Тесттин ID шилтемеси табылган жок!');
        return;
    }

    // Базадан тестти издөө
    const allTests = BilimalStorage.get(StorageKeys.TESTS) || [];
    activeTest = allTests.find(t => t.id === testId);

    if (!activeTest) {
        alert('Ката: Мындай тест базада жок же өчүрүлгөн!');
        return;
    }

    document.getElementById('btn-start-exam').addEventListener('click', startExamWorkflow);
});

function startExamWorkflow() {
    const nameInput = document.getElementById('student-name-input').value.trim();
    const classInput = document.getElementById('student-class-input').value.trim();

    if (!nameInput) {
        alert('Сураныч, аты-жөнүңүздү толук жазыңыз!');
        return;
    }

    studentIdentity.name = nameInput;
    studentIdentity.studentClass = classInput || 'Аныкталган эмес';

    // Интерфейстерди алмаштыруу
    document.getElementById('auth-screen').classList.add('hidden');
    
    const activeContainer = document.getElementById('active-test-container');
    activeContainer.classList.remove('hidden');
    activeContainer.classList.add('test-started'); // Жарнама бөгөттөөчү классты кошуу

    // Тест учурунда жарнаманы дароо өчүрүү (Коопсуздук үчүн)
    if (window.AdManager) {
        window.AdManager.destroyAdsForExamMode();
    }

    renderExam();
    startExamTimer(activeTest.duration);
    
    // ANTI-CHEAT СИСТЕМАСЫН ИШКЕ КИРГИЗҮҮ
    if (activeTest.security && activeTest.security.antiCheat) {
        activateAntiCheatEngine();
    }
}

// ANTI-CHEAT ЭНДЖИН: Башка терезеге өтүүнү кармоо
function activateAntiCheatEngine() {
    document.body.classList.add('anticheat-active');
    
    // 1. Вкладка алмашканда (Page Visibility API)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            registerCheatInfraction();
        }
    });

    // 2. Терезе фокусун жоготкондо (мисалы, башка программаны ачканда)
    window.addEventListener('blur', () => {
        registerCheatInfraction();
    });

    // 3. Контексттик менюну (оң баскычты) бөгөттөө (Көчүрүп албаш үчүн)
    document.addEventListener('contextmenu', (e) => e.preventDefault());
}

function registerCheatInfraction() {
    // Эгер тест аяктап калган болсо, лог жазылбайт
    if (document.getElementById('active-test-container').classList.contains('hidden')) return;

    cheatCount++;
    
    // Экранга эскертүү чыгаруу
    const warningBar = document.getElementById('anticheat-warning-bar');
    if (warningBar) {
        warningBar.classList.remove('hidden');
        // 5 секунддан кийин эскертүүнү коопсуз жашыруу
        setTimeout(() => {
            warningBar.classList.add('hidden');
        }, 6000);
    }

    // Мугалим көрө турган борбордук базалык логго жазуу
    BilimalStorage.logActivity(
        studentIdentity.name, 
        'CHEAT_DETECTED', 
        `Окуучу башка терезеге өттү! Классы: ${studentIdentity.studentClass}, Тест: ${activeTest.title}, Убакыт: ${new Date().toLocaleTimeString()}`
    );
}

function renderExam() {
    document.getElementById('display-test-title').innerText = activeTest.title;
    document.getElementById('display-student-info').innerText = `Окуучу: ${studentIdentity.name} (${studentIdentity.studentClass})`;

    const questionsArea = document.getElementById('dynamic-questions-area');
    questionsArea.innerHTML = '';

    let questionsList = [...activeTest.questions];
    
    // Эгер суроолорду аралаштыруу жөндөөсү иштеп жатса
    if (activeTest.security && activeTest.security.shuffle) {
        questionsList.sort(() => Math.random() - 0.5);
    }

    questionsList.forEach((q, index) => {
        const qCard = document.createElement('div');
        qCard.className = 'student-question-card';
        
        // Варианттарды окуучу үчүн аралаштыруу
        let optionsHtml = '';
        let optionsArray = [...q.options];
        optionsArray.sort(() => Math.random() - 0.5);

        optionsArray.forEach(opt => {
            optionsHtml += `
                <label class="student-option-label">
                    <input type="radio" name="q-ans-${index}" value="${opt.replace(/"/g, '&quot;')}">
                    <span>${opt}</span>
                </label>
            `;
        });

        qCard.innerHTML = `
            <p class="question-title-text"><strong>${index + 1}.</strong> ${q.question}</p>
            <div class="options-vertical-list">
                ${optionsHtml}
            </div>
        `;
        questionsArea.appendChild(qCard);
    });

    const submitBtn = document.getElementById('btn-submit-test');
    submitBtn.classList.remove('hidden');
    submitBtn.onclick = () => calculateAndSubmitResults(questionsList);
}

function startExamTimer(minutes) {
    secondsLeft = minutes * 60;
    const clockDisplay = document.getElementById('test-timer-clock');

    timerInterval = setInterval(() => {
        let mins = Math.floor(secondsLeft / 60);
        let secs = secondsLeft % 60;

        clockDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (secondsLeft <= 60) {
            clockDisplay.style.color = '#ef4444'; // Акыркы мүнөттө кызыл түскө өтөт
        }

        if (secondsLeft <= 0) {
            clearInterval(timerInterval);
            alert('Убакыт бүттү! Сиздин тест автоматтык түрдө жыйынтыкталат.');
            document.getElementById('btn-submit-test').click();
        }
        secondsLeft--;
    }, 1000);
}

function calculateAndSubmitResults(compiledQuestions) {
    clearInterval(timerInterval);
    let correctCount = 0;

    compiledQuestions.forEach((q, index) => {
        const selectedRadio = document.querySelector(`input[name="q-ans-${index}"]:checked`);
        if (selectedRadio && selectedRadio.value === q.correctAnswer) {
            correctCount++;
        }
    });

    const percent = Math.round((correctCount / compiledQuestions.length) * 100);

    // Жыйынтыкты базага сактоо
    const finalResultObject = {
        testId: activeTest.id,
        testTitle: activeTest.title,
        studentName: studentIdentity.name,
        studentClass: studentIdentity.studentClass,
        correctAnswers: correctCount,
        totalQuestions: compiledQuestions.length,
        percentage: percent,
        cheatsCount: cheatCount,
        submittedAt: new Date().toISOString()
    };

    BilimalStorage.saveItem(StorageKeys.RESULTS, finalResultObject);
    BilimalStorage.logActivity(studentIdentity.name, 'SUBMIT_TEST', `Тестти бүтүрдү: ${percent}% жыйынтык менен.`);

    // Экрандарды алмаштыруу
    document.getElementById('active-test-container').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');

    // Жыйынтыктарды чыгаруу
    document.getElementById('score-correct').innerText = `${correctCount}/${compiledQuestions.length}`;
    document.getElementById('score-percent').innerText = `${percent}%`;
    document.getElementById('score-cheats').innerText = `${cheatCount} жолу`;

    const statusDesc = document.getElementById('cheat-final-status');
    if (cheatCount > 0) {
        statusDesc.innerText = `⚠️ Эскертүү: Сиз тест учурунда башка терезеге өткөнүңүз мугалимге билдирилди.`;
        statusDesc.style.color = '#fca5a5';
    } else {
        statusDesc.innerText = `🛡️ Куттуктайбыз! Сиз тестти эреже бузбастан таза тапшырдыңыз.`;
        statusDesc.style.color = '#a7f3d0';
    }
}
