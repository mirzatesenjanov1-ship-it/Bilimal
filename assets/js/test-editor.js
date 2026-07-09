// Bilimal-AI Project - Feature-Rich Interactive Test Editor Engine
(function () {
    const BF = window.BilimalFirebase;
    const BS = window.BilimalStorage;

    let activeTest = null;
    let autoSaveInterval = null;
    let activeQuestionIdForFab = null;

    function loadEditor(testId) {
        const id = testId || localStorage.getItem('bilimal_editing_test_id');
        if (!id) {
            BF.showToast("Түзөтүү үчүн тест тандалган жок", "error");
            return;
        }

        const localTests = BS.getTestsLocal();
        activeTest = localTests[id];

        if (!activeTest) {
            BF.showToast("Тест маалыматы табылган жок", "error");
            return;
        }

        renderEditorForm();
        renderQuestionsList();
        setupAutoSave();
        checkDraftOnLoad();
    }

    function renderEditorForm() {
        const formContainer = document.getElementById('editor-settings-form-container');
        if (!formContainer) return;

        formContainer.innerHTML = `
            <div class="editor-section-group">
                <h3>Негизги маалыматтар</h3>
                <label>Тесттин аталышы: <input type="text" id="edit-test-title" value="${BF.sanitizeData(activeTest.title || '')}"></label>
                <label>Предмет: <input type="text" id="edit-test-subject" value="${BF.sanitizeData(activeTest.subject || '')}"></label>
                <label>Класс: <input type="text" id="edit-test-class" value="${BF.sanitizeData(activeTest.classLevel || '')}"></label>
                <label>Тема: <input type="text" id="edit-test-topic" value="${BF.sanitizeData(activeTest.topic || '')}"></label>
                <label>Сүрөттөмө: <textarea id="edit-test-desc">${BF.sanitizeData(activeTest.description || '')}</textarea></label>
            </div>
            <div class="editor-section-group">
                <h3>Чектөөлөр жана Жөндөөлөр</h3>
                <label>Убакыт чеги (мүнөт): <input type="number" id="edit-test-time" value="${activeTest.timeLimit || 45}"></label>
                <label>Өтүү упайы (%): <input type="number" id="edit-test-passing" value="${activeTest.passingScore || 60}"></label>
                <label>Кайра тапшыруу саны: <input type="number" id="edit-test-attempts" value="${activeTest.maxAttempts || 1}"></label>
                <label>Кирүү үчүн пароль: <input type="text" id="edit-test-password" value="${BF.sanitizeData(activeTest.password || '')}"></label>
                
                <div class="checkbox-row">
                    <input type="checkbox" id="edit-mix-questions" ${activeTest.shuffleQuestions ? 'checked' : ''}> <label for="edit-mix-questions">Суроолорду аралаштыруу</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" id="edit-mix-answers" ${activeTest.shuffleAnswers ? 'checked' : ''}> <label for="edit-mix-answers">Жоопторду аралаштыруу</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" id="edit-show-results" ${activeTest.showResultsImmediately ? 'checked' : ''}> <label for="edit-show-results">Натыйжаны дароо көргөзүү</label>
                </div>
            </div>
            <div class="editor-section-group">
                <h3>Античит коопсуздук системасы</h3>
                <div class="checkbox-row">
                    <input type="checkbox" id="ac-tab" ${activeTest.antiCheatSettings?.tabTracking ? 'checked' : ''}> <label for="ac-tab">Tab алмаштырууну көзөмөлдөө</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" id="ac-copy" ${activeTest.antiCheatSettings?.preventCopyPaste ? 'checked' : ''}> <label for="ac-copy">Copy/Paste бөгөттөө</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" id="ac-fs" ${activeTest.antiCheatSettings?.forceFullscreen ? 'checked' : ''}> <label for="ac-fs">Fullscreen милдеттүү кылуу</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" id="ac-cam" ${activeTest.antiCheatSettings?.requireCamera ? 'checked' : ''}> <label for="ac-cam">Камераны талап кылуу</label>
                </div>
            </div>
        `;

        bindFormInputs();
    }

    function bindFormInputs() {
        const inputs = ['edit-test-title', 'edit-test-subject', 'edit-test-class', 'edit-test-topic', 'edit-test-desc', 'edit-test-time', 'edit-test-passing', 'edit-test-attempts', 'edit-test-password'];
        inputs.forEach(id => {
            document.getElementById(id)?.addEventListener('input', collectFormMetadata);
        });

        const checks = ['edit-mix-questions', 'edit-mix-answers', 'edit-show-results', 'ac-tab', 'ac-copy', 'ac-fs', 'ac-cam'];
        checks.forEach(id => {
            document.getElementById(id)?.addEventListener('change', collectFormMetadata);
        });
    }

    function collectFormMetadata() {
        if (!activeTest) return;
        activeTest.title = document.getElementById('edit-test-title')?.value || activeTest.title;
        activeTest.subject = document.getElementById('edit-test-subject')?.value || activeTest.subject;
        activeTest.classLevel = document.getElementById('edit-test-class')?.value || activeTest.classLevel;
        activeTest.topic = document.getElementById('edit-test-topic')?.value || activeTest.topic;
        activeTest.description = document.getElementById('edit-test-desc')?.value || activeTest.description;
        activeTest.timeLimit = parseInt(document.getElementById('edit-test-time')?.value) || 45;
        activeTest.passingScore = parseInt(document.getElementById('edit-test-passing')?.value) || 60;
        activeTest.maxAttempts = parseInt(document.getElementById('edit-test-attempts')?.value) || 1;
        activeTest.password = document.getElementById('edit-test-password')?.value || "";

        activeTest.shuffleQuestions = document.getElementById('edit-mix-questions')?.checked || false;
        activeTest.shuffleAnswers = document.getElementById('edit-mix-answers')?.checked || false;
        activeTest.showResultsImmediately = document.getElementById('edit-show-results')?.checked || false;

        activeTest.antiCheatSettings = {
            tabTracking: document.getElementById('ac-tab')?.checked || false,
            preventCopyPaste: document.getElementById('ac-copy')?.checked || false,
            forceFullscreen: document.getElementById('ac-fs')?.checked || false,
            requireCamera: document.getElementById('ac-cam')?.checked || false
        };
    }

    function renderQuestionsList() {
        const container = document.getElementById('editor-questions-list-container');
        if (!container) return;

        container.innerHTML = "";
        const qList = Object.values(activeTest.questions || {}).sort((a, b) => (a.order || 0) - (b.order || 0));

        if (qList.length === 0) {
            container.innerHTML = `<p class="no-q-alert">Суроолор кошула элек. Төмөндөгү кнопканы колдонуңуз.</p>`;
            return;
        }

        qList.forEach((q, index) => {
            const qDiv = document.createElement('div');
            qDiv.className = 'editor-question-card-item';
            qDiv.style.border = "1px solid #ccc";
            qDiv.style.padding = "15px";
            qDiv.style.margin = "15px 0";
            qDiv.style.borderRadius = "8px";
            qDiv.innerHTML = `
                <div class="q-header" style="display:flex; justify-content:space-between; font-weight:bold;">
                    <span>№${index + 1} (${translateType(q.type)})</span>
                    <div>
                        <button class="btn-q-move-up" data-id="${q.id}">↑</button>
                        <button class="btn-q-move-down" data-id="${q.id}">↓</button>
                        <button class="btn-q-duplicate" data-id="${q.id}">Көчүрүү</button>
                        <button class="btn-q-delete" data-id="${q.id}" style="color:red;">Өчүрүү</button>
                    </div>
                </div>
                <label>Суроонун тексти:
                    <input type="text" class="edit-q-text" data-id="${q.id}" value="${BF.sanitizeData(q.text || '')}" style="width:100%;">
                </label>
                <label>Балл:
                    <input type="number" class="edit-q-points" data-id="${q.id}" value="${q.points || 1}">
                </label>
                <div class="q-answers-setup-container" id="q-answers-setup-${q.id}">
                    ${renderAnswersSetupBlock(q)}
                </div>
            `;
            container.appendChild(qDiv);
        });

        bindQuestionEvents();
    }

    function translateType(type) {
        const types = { single: "Бир туура жооп", multi: "Бир нече туура жооп", boolean: "Туура/туура эмес", short: "Кыска жооп", essay: "Узун эссе" };
        return types[type] || "Жөнөкөй суроо";
    }

    function renderAnswersSetupBlock(q) {
        if (q.type === 'single' || q.type === 'multi') {
            let html = '<div><strong>Жооп варианттары:</strong></div>';
            const options = q.options || ['А', 'Б', 'В', 'Г'];
            options.forEach((opt, idx) => {
                html += `
                    <div style="margin:5px 0;">
                        <input type="${q.type === 'single' ? 'radio' : 'checkbox'}" name="correct-${q.id}" value="${idx}" ${q.correctAnswers?.includes(idx.toString()) ? 'checked' : ''} class="correct-indicator" data-id="${q.id}">
                        <input type="text" class="edit-q-option" data-id="${q.id}" data-idx="${idx}" value="${BF.sanitizeData(opt)}" style="width:80%;">
                    </div>
                `;
            });
            return html;
        }
        if (q.type === 'boolean') {
            return `
                <div>
                    <input type="radio" name="boolean-${q.id}" value="true" ${q.correctAnswers?.includes('true') ? 'checked' : ''} class="correct-indicator" data-id="${q.id}"> Туура
                    <input type="radio" name="boolean-${q.id}" value="false" ${q.correctAnswers?.includes('false') ? 'checked' : ''} class="correct-indicator" data-id="${q.id}"> Туура эмес
                </div>
            `;
        }
        return `<input type="text" class="edit-q-exact-answer" data-id="${q.id}" value="${BF.sanitizeData(q.correctAnswers?.[0] || '')}" placeholder="Так жоопту жазыңыз">`;
    }

    function addNewQuestion(type = "single", targetAfterId = null) {
        if (!activeTest) return;
        if (!activeTest.questions) activeTest.questions = {};

        const qId = BF.generateId('q');
        const currentCount = Object.keys(activeTest.questions).length;

        const newQ = {
            id: qId,
            type: type,
            text: "Жаңы суроо суроо тексти",
            points: 2,
            order: currentCount + 1,
            options: ["А варианты", "Б варианты", "В варианты", "Г варианты"],
            correctAnswers: ["0"]
        };

        activeTest.questions[qId] = newQ;
        BF.showToast("Жаңы суроо кошулду", "success");
        renderQuestionsList();
    }

    function bindQuestionEvents() {
        document.querySelectorAll('.edit-q-text').forEach(el => el.addEventListener('input', (e) => {
            const id = e.target.getAttribute('data-id');
            activeTest.questions[id].text = e.target.value;
        }));

        document.querySelectorAll('.edit-q-points').forEach(el => el.addEventListener('input', (e) => {
            const id = e.target.getAttribute('data-id');
            activeTest.questions[id].points = parseInt(e.target.value) || 1;
        }));

        document.querySelectorAll('.edit-q-option').forEach(el => el.addEventListener('input', (e) => {
            const id = e.target.getAttribute('data-id');
            const idx = parseInt(e.target.getAttribute('data-idx'));
            activeTest.questions[id].options[idx] = e.target.value;
        }));

        document.querySelectorAll('.correct-indicator').forEach(el => el.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const q = activeTest.questions[id];
            if (q.type === 'single' || q.type === 'boolean') {
                q.correctAnswers = [e.target.value];
            } else if (q.type === 'multi') {
                const checked = [];
                document.querySelectorAll(`.correct-indicator[data-id="${id}"]:checked`).forEach(c => checked.push(c.value));
                q.correctAnswers = checked;
            }
        }));

        document.querySelectorAll('.edit-q-exact-answer').forEach(el => el.addEventListener('input', (e) => {
            const id = e.target.getAttribute('data-id');
            activeTest.questions[id].correctAnswers = [e.target.value];
        }));

        document.querySelectorAll('.btn-q-delete').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            delete activeTest.questions[id];
            renderQuestionsList();
        }));

        document.querySelectorAll('.btn-q-duplicate').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const source = activeTest.questions[id];
            const copyId = BF.generateId('q');
            activeTest.questions[copyId] = { ...source, id: copyId, order: Object.keys(activeTest.questions).length + 1 };
            renderQuestionsList();
        }));
    }

    function saveCurrentTest() {
        if (!activeTest) return;
        BS.saveTestLocal(activeTest);
        localStorage.removeItem(`bilimal_draft_${activeTest.id}`);
        BF.showToast("Тест толугу менен сакталды", "success");
    }

    function setupAutoSave() {
        if (autoSaveInterval) clearInterval(autoSaveInterval);
        autoSaveInterval = setInterval(() => {
            if (activeTest) {
                localStorage.setItem(`bilimal_draft_${activeTest.id}`, JSON.stringify(activeTest));
                BF.showToast("Черновик автоматтык сакталды", "info");
            }
        }, 10000);
    }

    function checkDraftOnLoad() {
        if (!activeTest) return;
        const draft = localStorage.getItem(`bilimal_draft_${activeTest.id}`);
        if (draft) {
            const parsed = BF.safeJsonParse(draft, null);
            if (parsed && confirm("Сакталбай калган долбоор бар. Калыбына келтиресизби?")) {
                activeTest = parsed;
                renderEditorForm();
                renderQuestionsList();
                BF.showToast("Долбоор калыбына келтирилди", "success");
            }
        }
    }

    function bindEditorUi() {
        document.getElementById('btn-editor-save-test')?.addEventListener('click', saveCurrentTest);
        document.getElementById('fab-add-question-btn')?.addEventListener('click', () => {
            const type = document.getElementById('fab-question-type-select')?.value || 'single';
            addNewQuestion(type);
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindEditorUi();
    });

    window.BilimalEditor = {
        loadEditor,
        addNewQuestion,
        saveCurrentTest
    };
})();
