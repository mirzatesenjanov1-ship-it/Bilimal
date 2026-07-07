/**
 * Bilimal.org - Башкаруу панелинин жана Тест куруучу Визарддын логикасы
 */

document.addEventListener('DOMContentLoaded', () => {
    // Системада колдонуучу бар экенин текшерүү (Мок колдонуучу кошуу)
    if (!BilimalStorage.getCurrentUser()) {
        BilimalStorage.save(StorageKeys.CURRENT_USER, {
            id: 'PROF-777',
            name: 'Айбек Мугалим',
            role: 'teacher'
        });
    }

    initDashboard();
    initOrbitNavigation();
    initWizard();
    loadMyTests();
    
    // Жарнама тармагын интеграциялоо
    if (window.AdManager) {
        window.AdManager.renderAdSense('dash-top-ad-slot', 'horizontal');
    }
});

function initDashboard() {
    const user = BilimalStorage.getCurrentUser();
    if (user) {
        document.getElementById('teacher-name').innerText = user.name;
    }
}

// 3D Орбита баскычтарын басканда тиешелүү бөлүмгө өтүү
function initOrbitNavigation() {
    const orbitItems = document.querySelectorAll('.orbit-item');
    orbitItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            
            if (targetId === 'wizard-modal') {
                openWizard();
            } else {
                // Башка негизги бөлүмдөрдү алмаштыруу логикасы
                BilimalStorage.logActivity('PROF-777', 'NAVIGATE', `Бөлүмгө өттү: ${targetId}`);
                alert(`Бул багыт азыр ачылууда: ${targetId}`);
            }
        });
    });
}

// ВИЗАРД (Тест түзүү) Башкаруу Функциялары
let currentStep = 1;
const totalSteps = 3;

function initWizard() {
    const modal = document.getElementById('wizard-modal');
    const openBtn = document.getElementById('btn-open-wizard');
    const closeBtn = document.getElementById('close-wizard-btn');
    const nextBtn = document.getElementById('btn-wizard-next');
    const prevBtn = document.getElementById('btn-wizard-prev');
    const saveBtn = document.getElementById('btn-wizard-save');
    const addQuestionBtn = document.getElementById('btn-add-question');

    openBtn.addEventListener('click', openWizard);
    closeBtn.addEventListener('click', closeWizard);
    
    nextBtn.addEventListener('click', () => navigateStep(1));
    prevBtn.addEventListener('click', () => navigateStep(-1));
    
    addQuestionBtn.addEventListener('click', () => addNewQuestionBlock());
    
    saveBtn.addEventListener('click', saveCompletedTest);
}

function openWizard() {
    currentStep = 1;
    updateStepVisibility();
    document.getElementById('wizard-form').reset();
    document.getElementById('questions-builder-container').innerHTML = '';
    addNewQuestionBlock(); // Алгачкы бир суроо блогун кошуу
    document.getElementById('wizard-modal').classList.add('active');
}

function closeWizard() {
    document.getElementById('wizard-modal').classList.remove('active');
}

function navigateStep(direction) {
    // Биринчи кадамдагы валидация (Аталышы толтурулушу керек)
    if (currentStep === 1 && direction === 1) {
        const title = document.getElementById('test-title').value;
        if (!title.trim()) {
            alert('Сураныч, тесттин аталышын жазыңыз!');
            return;
        }
    }

    currentStep += direction;
    updateStepVisibility();
}

function updateStepVisibility() {
    // Бардык мазмундарды жана индикаторлорду жашыруу
    document.querySelectorAll('.wizard-step-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step-indicator').forEach(el => el.classList.remove('active'));

    // Активдүү кадамды көрсөтүү
    document.querySelector(`.wizard-step-content[data-step="${currentStep}"]`).classList.add('active');
    document.querySelector(`.step-indicator[data-step="${currentStep}"]`).classList.add('active');

    // Навигация баскычтарын жөндөө
    const prevBtn = document.getElementById('btn-wizard-prev');
    const nextBtn = document.getElementById('btn-wizard-next');
    const saveBtn = document.getElementById('btn-wizard-save');

    if (currentStep === 1) {
        prevBtn.classList.add('disabled');
        prevBtn.disabled = true;
    } else {
        prevBtn.classList.remove('disabled');
        prevBtn.disabled = false;
    }

    if (currentStep === totalSteps) {
        nextBtn.classList.add('hidden');
        saveBtn.classList.remove('hidden');
    } else {
        nextBtn.classList.remove('hidden');
        saveBtn.classList.add('hidden');
    }
}

// Суроолордун конфигурация блогун кошуу
let questionCounter = 0;
function addNewQuestionBlock() {
    questionCounter++;
    const container = document.getElementById('questions-builder-container');
    
    const qBlock = document.createElement('div');
    qBlock.className = 'question-block-card';
    qBlock.id = `q-block-${questionCounter}`;
    qBlock.innerHTML = `
        <div class="form-group">
            <label>Суроо #${questionCounter}</label>
            <input type="text" class="question-text-input" required placeholder="Физикалык суроону жазыңыз...">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Вариант А (Туура жооп) <span style="color:var(--accent-green)">✓</span></label>
                <input type="text" class="option-a" required placeholder="Туура жооп ушул жерге жазылат">
            </div>
            <div class="form-group">
                <label>Вариант Б</label>
                <input type="text" class="option-b" required placeholder="Ката жооп">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Вариант В</label>
                <input type="text" class="option-c" placeholder="Ката жооп">
            </div>
            <div class="form-group">
                <label>Вариант Г</label>
                <input type="text" class="option-d" placeholder="Ката жооп">
            </div>
        </div>
    `;
    container.appendChild(qBlock);
    container.scrollTop = container.scrollHeight;
}

// Визард маалыматтарын топтоп борбордук базага сактоо
function saveCompletedTest() {
    const title = document.getElementById('test-title').value;
    const subject = document.getElementById('test-subject').value;
    const duration = document.getElementById('test-duration').value;
    const description = document.getElementById('test-desc').value;
    
    const security = {
        antiCheat: document.getElementById('security-anticheat').checked,
        shuffle: document.getElementById('security-shuffle').checked,
        noRegistration: document.getElementById('security-no-registration').checked
    };

    // Суроолорду массивке чогултуу
    const questions = [];
    const blocks = document.querySelectorAll('.question-block-card');
    
    blocks.forEach(block => {
        const qText = block.querySelector('.question-text-input').value;
        const optA = block.querySelector('.option-a').value;
        const optB = block.querySelector('.option-b').value;
        const optC = block.querySelector('.option-c').value;
        const optD = block.querySelector('.option-d').value;

        if (qText && optA && optB) {
            questions.push({
                question: qText,
                correctAnswer: optA, // Бизде А варианты дайыма туура деп алынып, кийин окуучуга туш келди аралашып берилет
                options: [optA, optB, optC, optD].filter(o => o !== "")
            });
        }
    });

    if (questions.length === 0) {
        alert('Сураныч, жок дегенде бир суроону толук толтуруңуз!');
        return;
    }

    const testObject = {
        title,
        subject,
        duration: parseInt(duration),
        description,
        security,
        questions,
        createdAt: new Date().toISOString()
    };

    const success = BilimalStorage.saveItem(StorageKeys.TESTS, testObject);
    if (success) {
        BilimalStorage.logActivity('PROF-777', 'CREATE_TEST', `Жаңы тест түзүлдү: ${title}`);
        closeWizard();
        loadMyTests();
        if (typeof window.trackEvent === 'function') {
            window.trackEvent('create_test_success', { subject: subject, questions_count: questions.length });
        }
    }
}

// Тесттердин тизмесин базадан окуп экранга чыгаруу
function loadMyTests() {
    const grid = document.getElementById('tests-grid');
    if (!grid) return;

    const myTests = BilimalStorage.getTeacherData(StorageKeys.TESTS);
    
    if (myTests.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">
                Азырынча сизде тесттер жок. Жогорудагы "Түзүү" баскычы аркылуу алгачкы тестиңизди кошуңуз.
            </div>`;
        return;
    }

    grid.innerHTML = '';
    myTests.forEach(test => {
        const card = document.createElement('div');
        card.className = 'test-card';
        card.innerHTML = `
            <h4 style="margin: 0 0 8px 0; font-size: 18px; color: var(--cyan-glow)">${test.title}</h4>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: var(--text-muted)">${test.description || 'Түшүндүрмө жок'}</p>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px;">
                <span>Суроолор: <strong>${test.questions.length}</strong></span>
                <span>Убактысы: <strong>${test.duration} мүнөт</strong></span>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="copyTestLink('${test.id}')" style="flex:1; padding: 8px; background: rgba(6,182,212,0.1); border:1px solid var(--cyan-glow); color:white; border-radius:6px; cursor:pointer;">Шилтеме көчүрүү</button>
                <button onclick="deleteTest('${test.id}')" style="padding: 8px; background: rgba(239,68,68,0.1); border:1px solid #ef4444; color:#fca5a5; border-radius:6px; cursor:pointer;">🗑️</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function copyTestLink(testId) {
    const link = `${window.location.origin}/student-test.html?testId=${testId}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('Тесттин коопсуз шилтемеси көчүрүлдү! Аны окуучуларга жөнөтсөңүз болот.');
    });
}

function deleteTest(testId) {
    if (confirm('Бул тестти өчүрүүнү каалайсызбы? Бардык окуучулардын жыйынтыктары кошо өчөт!')) {
        BilimalStorage.deleteItem(StorageKeys.TESTS, testId);
        loadMyTests();
    }
}
/**
 * Bilimal.org - Мугалим үчүн окуучулардын жыйынтыктарын жана Anti-Cheat логдорун көрсөтүү модулу
 */

const BilimalAnalytics = {
    init() {
        // Эгер мугалимдин барагында статистика бөлүмү болсо, аны жүктөө
        this.renderStudentResults();
        this.renderSecurityLogs();
    },

    // 1. Окуучулардын алган бааларынын журналы
    renderStudentResults() {
        const resultsContainer = document.getElementById('analytics-results-table');
        if (!resultsContainer) return;

        const allResults = BilimalStorage.get(StorageKeys.RESULTS) || [];
        
        if (allResults.length === 0) {
            resultsContainer.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">Азырынча тест тапшырган окуучулар жок.</td></tr>`;
            return;
        }

        // Акыркы тапшыргандарды биринчи көрсөтүү
        allResults.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        let html = '';
        allResults.forEach(res => {
            // Эгер окуучу көп жолу эреже бузса, анын катарчасын кызыл кылып көрсөтүү
            const rowClass = res.cheatsCount > 2 ? 'row-danger' : '';
            const statusColor = res.percentage >= 80 ? '#10b981' : (res.percentage >= 50 ? '#06b6d4' : '#ef4444');

            html += `
                <tr class="${rowClass}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px; font-weight:600;">${res.studentName}</td>
                    <td style="padding:12px; color:var(--text-muted);">${res.studentClass}</td>
                    <td style="padding:12px;">${res.testTitle}</td>
                    <td style="padding:12px; font-weight:700; color:${statusColor}">${res.percentage}% (${res.correctAnswers}/${res.totalQuestions})</td>
                    <td style="padding:12px; font-weight:700; color:${res.cheatsCount > 0 ? '#ef4444' : '#10b981'}">
                        ${res.cheatsCount > 0 ? `⚠️ ${res.cheatsCount} жолу` : 'Таза (0)'}
                    </td>
                    <td style="padding:12px; font-size:12px; color:var(--text-muted);">${new Date(res.submittedAt).toLocaleTimeString()}</td>
                </tr>
            `;
        });

        resultsContainer.innerHTML = html;
    },

    // 2. Anti-Cheat реалдуу убакыттагы окуялар журналы (Логдор)
    renderSecurityLogs() {
        const logsContainer = document.getElementById('security-live-logs');
        if (!logsContainer) return;

        const allLogs = BilimalStorage.get(StorageKeys.ACTIVITY_LOG) || [];
        // Физикалык түрдө жалаң гана античит бузууларын чыпкалап алуу
        const cheatLogs = allLogs.filter(log => log.actionType === 'CHEAT_DETECTED');

        if (cheatLogs.length === 0) {
            logsContainer.innerHTML = `<p style="color:var(--accent-green); font-size:13px;">🛡️ Системага шектүү аракеттер катталган жок.</p>`;
            return;
        }

        let html = '<div class="logs-feed-wrapper" style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">';
        cheatLogs.forEach(log => {
            html += `
                <div class="log-item-alert" style="background:rgba(239,68,68,0.05); border-left:3px solid #ef4444; padding:10px; border-radius:4px; font-size:12px;">
                    <span style="color:#ef4444; font-weight:700;">[БӨГӨТТӨӨ]</span> ${log.details}
                </div>
            `;
        });
        html += '</div>';

        logsContainer.innerHTML = html;
    }
};

// Мугалимдин барагы ачылганда автоматтык түрдө иштетүү
document.addEventListener('DOMContentLoaded', () => {
    BilimalAnalytics.init();
});
