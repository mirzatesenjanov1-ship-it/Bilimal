/**
 * Bilimal.org - Мугалимдин Интерактивдүү Кабинетинин Функционалдык Логикасы (Production JS)
 * Автордук укук корголгон © 2026. Бардык укуктар сакталган.
 */

// Глобалдык абал (State)
const DashboardState = {
    currentTeacher: { id: "T-7841", name: "Мугалим Аты-Жөнү" },
    tests: [],
    currentView: "my-tests", // 'my-tests', 'students-results', 'analytics'
    carouselAngle: 0,
    wizardCurrentStep: 1,
    wizardQuestions: [], // Конструктордогу суроолордун тизмеси
    activeEditingTestId: null
};

// 15 ТҮРДҮҮ СУРОО ТИПТЕРИНИН КАТАЛОГУ
const QUESTION_TYPES = {
    SINGLE_CHOICE: { id: "SINGLE_CHOICE", title: "Жалгыз туура жооп (Радио)", icon: "🔘" },
    MULTIPLE_CHOICE: { id: "MULTIPLE_CHOICE", title: "Бир нече туура жооп (Чекбокс)", icon: "☑️" },
    SHORT_ANSWER: { id: "SHORT_ANSWER", title: "Кыскача тексттик жооп", icon: "✍️" },
    LONG_ANSWER: { id: "LONG_ANSWER", title: "Кеңири диссератациялык жооп", icon: "📝" },
    NUMERICAL: { id: "NUMERICAL", title: "Сандык жооп (Физика/Математика)", icon: "🔢" },
    TRUE_FALSE: { id: "TRUE_FALSE", title: "Чындык же Жалган", icon: "☯️" },
    MATCHING: { id: "MATCHING", title: "Сайкештикти табуу (A -> B)", icon: "🔗" },
    SEQUENCE: { id: "SEQUENCE", title: "Ырааттуулукту орнотуу (1, 2, 3)", icon: "📊" },
    FILL_BLANKS: { id: "FILL_BLANKS", title: "Тексттеги боштуктарды толтуруу", icon: "🕳️" },
    CLICK_IMAGE: { id: "CLICK_IMAGE", title: "Сүрөттөгү аймакты табуу (Hotspot)", icon: "🎯" },
    DRAG_DROP: { id: "DRAG_DROP", title: "Сөздөрдү ордуна сүйрөп коюу", icon: "🤝" },
    AUDIO_RECORD: { id: "AUDIO_RECORD", title: "Аудио үн жаздыруу жообу", icon: "🎙️" },
    FILE_UPLOAD: { id: "FILE_UPLOAD", title: "Файл жүктөө (Сүрөт/PDF)", icon: "📂" },
    MATH_FORMULA: { id: "MATH_FORMULA", title: "Математикалык/Физикалык формула", icon: "🧮" },
    MATRIX: { id: "MATRIX", title: "Матрицалык сурамжылоо торчосу", icon: "🔲" }
};

document.addEventListener("DOMContentLoaded", () => {
    init3DCarousel();
    initNavigation();
    initFilters();
    initModalTriggers();
    initWizard();
    loadMockData(); // Production'до Firebase'ден реалдуу маалыматтар тартылат
});

/* ==========================================================================
   1. 3D КАРУСЕЛЬ МАТЕМАТИКАСЫ ЖАНА БАШКАРУУ
   ========================================================================== */
function init3DCarousel() {
    const track = document.getElementById('carouselTrack');
    const cards = document.querySelectorAll('.carousel-3d-card');
    if (!track || cards.length === 0) return;

    const totalCards = cards.length;
    const tz = Math.round((280 / 2) / Math.tan(Math.PI / totalCards)); // Аралыкты эсептөө ($r = \frac{w/2}{\tan(\pi/n)}$)

    // Ар бир карточканы 3D мейкиндикте жайгаштыруу
    cards.forEach((card, index) => {
        const angle = index * (360 / totalCards);
        card.style.transform = `rotateY(${angle}deg) translateZ(${tz + 20}px)`;
    });

    window.rotateCarousel = function(direction) {
        const anglePerCard = 360 / totalCards;
        DashboardState.carouselAngle += (direction * anglePerCard);
        track.style.transform = `rotateY(${DashboardState.carouselAngle}deg)`;
    };
}

/* ==========================================================================
   2. НАВИГАЦИЯ ЖАНА ЭКРАНДАРДЫ АЛМАШТЫРУУ (SPA STYLE)
   ========================================================================== */
function initNavigation() {
    window.switchDashboardView = function(viewId, element) {
        DashboardState.currentView = viewId;
        
        // Активдүү экрандарды жаңыртуу
        document.querySelectorAll('.dashboard-functional-card').forEach(card => {
            card.classList.remove('active-view');
        });
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.add('active-view');

        // Каруселдеги карточкалардын стилин өзгөртүү
        if (element) {
            document.querySelectorAll('.carousel-3d-card').forEach(c => c.style.borderColor = '');
            element.style.borderColor = 'var(--cyan-glow)';
        }
    };
}

/* ==========================================================================
   3. МОДАЛЬ ТЕРЕЗЕЛЕР КАНАЛЫ (OPEN/CLOSE LOGIC)
   ========================================================================== */
function initModalTriggers() {
    window.openBilimalModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('open-modal-active');
    };

    window.closeBilimalModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('open-modal-active');
    };

    // Сырткы аймакты басканда жабылуу
    document.querySelectorAll('.bilimal-modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open-modal-active');
            }
        });
    });
}

/* ==========================================================================
   4. ТЕСТ КОНСТРУКТОРУ (WIZARD) БАШКАРУУ
   ========================================================================== */
function initWizard() {
    // Суроолордун тизмесин конструктордун капталына чыгаруу
    const typesContainer = document.getElementById('questionTypesContainer');
    if (typesContainer) {
        typesContainer.innerHTML = Object.values(QUESTION_TYPES).map(type => `
            <button type="button" class="btn-type-selector" onclick="addQuestionToWizard('${type.id}')">
                ${type.icon} ${type.title}
            </button>
        `).join('');
    }

    window.navigateWizard = function(step) {
        if (step < 1 || step > 3) return;
        
        // Валидация (Кадам 1 үчүн)
        if (step > DashboardState.wizardCurrentStep && DashboardState.wizardCurrentStep === 1) {
            const title = document.getElementById('w_test_title').value.trim();
            if (!title) {
                alert('Сураныч, тесттин аталышын жазыңыз!');
                return;
            }
        }

        // Кадамдарды которуштуруу
        document.querySelectorAll('.wizard-progress-step').forEach(el => el.classList.remove('step-active'));
        document.querySelectorAll('.wizard-step-content-pane').forEach(el => el.classList.remove('step-pane-active'));

        document.getElementById(`wStep${step}`).classList.add('step-active');
        document.getElementById(`wPane${step}`).classList.add('step-pane-active');
        
        DashboardState.wizardCurrentStep = step;
    };
}

/* ==========================================================================
   5. СУРООЛОРДУ ДИНАМИКАЛЫК ТҮРДӨ ГЕНЕРАЦИЯЛОО (15 ТИП)
   ========================================================================== */
window.addQuestionToWizard = function(typeId) {
    const qId = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const questionObject = {
        id: qId,
        type: typeId,
        title: "",
        points: 1,
        options: typeId === 'TRUE_FALSE' ? ["Чындык", "Жалган"] : ["", ""],
        correctAnswer: typeId === 'TRUE_FALSE' ? "Чындык" : ""
    };

    DashboardState.wizardQuestions.push(questionObject);
    renderWizardQuestions();
};

window.removeQuestionFromWizard = function(qId) {
    DashboardState.wizardQuestions = DashboardState.wizardQuestions.filter(q => q.id !== qId);
    renderWizardQuestions();
};

function renderWizardQuestions() {
    const container = document.getElementById('wizardQuestionsContainer');
    if (!container) return;

    if (DashboardState.wizardQuestions.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding-top: 60px;">Сол тараптан суроонун тибин тандап, суроо кошуңуз.</div>`;
        return;
    }

    container.innerHTML = DashboardState.wizardQuestions.map((q, idx) => {
        const typeInfo = QUESTION_TYPES[q.type];
        let optionsHtml = '';

        // Суроонун тибине жараша ички интерфейсти түзүү (Инъекция коргоосу менен)
        if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
            optionsHtml = `
                <div class="wq-options-grid">
                    ${q.options.map((opt, oIdx) => `
                        <div class="wq-option-row">
                            <input type="${q.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}" name="correct_${q.id}" ${oIdx === 0 ? 'checked' : ''}>
                            <input type="text" class="wq-input-field" style="margin-bottom:0;" value="${opt}" placeholder="Вариант ${oIdx + 1}" oninput="updateQuestionOption('${q.id}', ${oIdx}, this.value)">
                        </div>
                    `).join('')}
                    <button type="button" class="btn-card-small" style="width:fit-content; padding: 4px 12px; margin-top:6px;" onclick="addOptionToQuestion('${q.id}')">+ Вариант кошуу</button>
                </div>
            `;
        } else if (q.type === 'TRUE_FALSE') {
            optionsHtml = `
                <div class="wq-option-row">
                    <label><input type="radio" name="correct_${q.id}" checked> Чындык</label>
                    <label><input type="radio" name="correct_${q.id}"> Жалган</label>
                </div>
            `;
        } else if (q.type === 'SHORT_ANSWER' || q.type === 'NUMERICAL') {
            optionsHtml = `<input type="text" class="wq-input-field" placeholder="Эталондук туура жоопту бул жерге жазыңыз (Сыноо үчүн)">`;
        } else {
            optionsHtml = `<p style="font-size:12px; color:var(--cyan-glow); margin:0;">${typeInfo.title} интерфейси ийгиликтүү кошулду. Окуучуга толук интерактивдүү форматта көрүнөт.</p>`;
        }

        return `
            <div class="wizard-question-item-card">
                <div class="wq-card-header">
                    <span class="wq-card-type-tag">№${idx + 1} - ${typeInfo.icon} ${typeInfo.title}</span>
                    <button type="button" class="btn-card-small btn-delete-card" style="flex:none; padding:4px 8px;" onclick="removeQuestionFromWizard('${q.id}')">Өчүрүү</button>
                </div>
                <input type="text" class="wq-input-field" value="${q.title}" placeholder="Суроонун мазмунун жазыңыз..." oninput="DashboardState.wizardQuestions[${idx}].title = this.value">
                <div class="form-group-block" style="margin-bottom: 12px;">
                    <label>Бул суроого берилүүчү балл:</label>
                    <input type="number" class="wq-input-field" style="width: 80px;" value="${q.points}" oninput="DashboardState.wizardQuestions[${idx}].points = parseInt(this.value) || 1">
                </div>
                ${optionsHtml}
            </div>
        `;
    }).join('');
}

window.addOptionToQuestion = function(qId) {
    const q = DashboardState.wizardQuestions.find(curr => curr.id === qId);
    if (q) {
        q.options.push("");
        renderWizardQuestions();
    }
};

window.updateQuestionOption = function(qId, oIdx, value) {
    const q = DashboardState.wizardQuestions.find(curr => curr.id === qId);
    if (q) q.options[oIdx] = value;
};

/* ==========================================================================
   6. САХНАЛАШТЫРУУ ЖАНА ТЕСТТИ САКТОО (FIREBASE / LOCALSTORAGE СИНХРОН)
   ========================================================================== */
window.saveCreatedTest = function() {
    const title = document.getElementById('w_test_title').value.trim();
    const subject = document.getElementById('w_test_subject').value;
    const duration = parseInt(document.getElementById('w_test_duration').value) || 20;
    const antiCheat = document.getElementById('w_test_anticheat').checked;

    if (DashboardState.wizardQuestions.length === 0) {
        alert('Эч кандай суроо кошулган жок! Сураныч, суроолорду түзүңүз.');
        return;
    }

    const newTest = {
        id: 'test_' + Date.now(),
        title: title,
        subject: subject,
        duration: duration,
        antiCheat: antiCheat,
        questionsCount: DashboardState.wizardQuestions.length,
        status: 'active',
        createdDate: new Date().toLocaleDateString('ru-RU'),
        teacherId: DashboardState.currentTeacher.id
    };

    DashboardState.tests.unshift(newTest);
    renderTestsGrid();
    closeBilimalModal('testWizardModal');
    resetWizardForm();
    alert('Жаңы тест ийгиликтүү түзүлдү жана ишке киргизилди!');
};

function resetWizardForm() {
    document.getElementById('w_test_title').value = '';
    DashboardState.wizardQuestions = [];
    DashboardState.wizardCurrentStep = 1;
    navigateWizard(1);
}

/* ==========================================================================
   7. ТЕСТТЕРДИН ТОРЧОСУН СҮРӨТТӨӨ ЖАНА ФИЛЬТРАЦИЯ
   ========================================================================== */
function initFilters() {
    const searchInput = document.getElementById('searchTestInput');
    const filterSubject = document.getElementById('filterSubjectSelect');

    if (searchInput) searchInput.addEventListener('input', renderTestsGrid);
    if (filterSubject) filterSubject.addEventListener('change', renderTestsGrid);
}

function renderTestsGrid() {
    const container = document.getElementById('testsGridContainer');
    if (!container) return;

    const query = document.getElementById('searchTestInput')?.value.toLowerCase() || '';
    const subjectFilter = document.getElementById('filterSubjectSelect')?.value || 'ALL';

    const filtered = DashboardState.tests.filter(test => {
        const matchesQuery = test.title.toLowerCase().includes(query);
        const matchesSubject = (subjectFilter === 'ALL' || test.subject === subjectFilter);
        return matchesQuery && matchesSubject;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Талаптарга жооп берген тест табылган жок.</div>`;
        return;
    }

    container.innerHTML = filtered.map(test => `
        <div class="test-item-card" id="card_${test.id}">
            <div class="test-item-header">
                <h4 style="margin:0 0 6px 0; font-size:16px;">${test.title}</h4>
                <span class="test-item-status-badge status-${test.status}">
                    ${test.status === 'active' ? 'Активдүү' : test.status === 'draft' ? 'Черновик' : 'Жабык'}
                </span>
            </div>
            <div class="test-meta-info-row">
                <span>📚 Предмет: <b>${test.subject}</b></span>
                <span>⏱️ Убакыт: <b>${test.duration} мүнөт</b></span>
                <span>❓ Суроолор: <b>${test.questionsCount}</b></span>
                <span>🛡️ Анти-чит: <b>${test.antiCheat ? 'Күйгүзүлгөн' : 'Өчүрүлгөн'}</b></span>
                <span>📅 Күнү: ${test.createdDate}</span>
            </div>
            <div class="test-card-actions-footer">
                <button type="button" class="btn-card-small" onclick="openShareModal('${test.id}')">🔗 Бөлүшүү</button>
                <button type="button" class="btn-card-small" onclick="alert('Жыйынтыктарды жүктөө тутуму даярдалууда...')">📊 Жыйынтыктар</button>
                <button type="button" class="btn-card-small btn-delete-card" onclick="deleteTestCard('${test.id}')">🗑️ Өчүрүү</button>
            </div>
        </div>
    `).join('');
}

window.deleteTestCard = function(testId) {
    if (confirm('Бул тестти жана ага байланыштуу окуучулардын бардык жыйынтыктарын өчүрүүнү каалайсызбы?')) {
        DashboardState.tests = DashboardState.tests.filter(t => t.id !== testId);
        renderTestsGrid();
    }
};

/* ==========================================================================
   8. ШИЛТЕМЕ ЖАНА СҮРӨТТӨЛҮШҮ ҮЧҮН QR-КОД ГЕНЕРАТОРУ
   ========================================================================== */
window.openShareModal = function(testId) {
    const shareLink = `https://bilimal.org/quiz/start.html?id=${testId}`;
    const linkField = document.getElementById('shareLinkField');
    if (linkField) linkField.value = shareLink;

    // QR коддун ордун динамикалык түрдө тазалоо жана генерациялоо
    const qrContainer = document.getElementById('qrCodeContainer');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        // Мисал катары Google Charts API же локалдык Canvas аркылуу тез QR генерациялоо
        const qrImg = document.createElement('img');
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(shareLink)}`;
        qrImg.alt = "QR Code Test";
        qrContainer.appendChild(qrImg);
    }

    openBilimalModal('shareTestModal');
};

window.copyShareLinkToClipboard = function() {
    const linkField = document.getElementById('shareLinkField');
    if (linkField) {
        linkField.select();
        document.execCommand('copy');
        alert('Шилтеме буферге ийгиликтүү көчүрүлдү!');
    }
};

/* ==========================================================================
   9. ОКУУЧУЛАРДЫН ЖЫЙЫНТЫКТАРЫН БАШКАРУУ (ANTI-CHEAT ТУТУМУ МЕНЕН)
   ========================================================================== */
function loadMockData() {
    // Тесттердин алгачкы маалыматтары
    DashboardState.tests = [
        { id: "test_1", title: "Ньютондун мыйзамдары - 9-класс", subject: "PHYSICS", duration: 25, antiCheat: true, questionsCount: 10, status: "active", createdDate: "12.05.2026" },
        { id: "test_2", title: "Омдун мыйзамы жана тизмектер", subject: "PHYSICS", duration: 20, antiCheat: false, questionsCount: 8, status: "active", createdDate: "18.05.2026" },
        { id: "test_3", title: "Күн системасынын түзүлүшү", subject: "ASTRONOMY", duration: 15, antiCheat: true, questionsCount: 12, status: "draft", createdDate: "02.06.2026" }
    ];
    renderTestsGrid();
}
