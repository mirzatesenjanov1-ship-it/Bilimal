import { Storage, KEYS } from './storage.js';
import { Utils } from './utils.js';
import { UI } from './ui.js';

export const TestBuilderModule = {
    currentStep: 1,
    questions: [],

    init() {
        this.resetBuilderState();
        this.setupWizardNavigation();
        
        document.getElementById('btnAddQuestion').onclick = () => this.addNewQuestionBlock();
        document.getElementById('btnWizardDraft').onclick = () => this.saveMaster(true);
        document.getElementById('btnWizardPublish').onclick = () => this.saveMaster(false);
    },

    resetBuilderState() {
        this.currentStep = 1;
        this.questions = [];
        document.getElementById('questionsContainer').innerHTML = '';
        this.syncStepUI();
    },

    setupWizardNavigation() {
        document.getElementById('btnWizardNext').onclick = () => {
            if (this.currentStep === 1 && !document.getElementById('testTitle').value.trim()) {
                UI.showToast("Тесттин аталышын киргизиңиз!", "danger");
                return;
            }
            if (this.currentStep === 2 && this.questions.length === 0) {
                UI.showToast("Тестте жок дегенде бир суроо болушу шарт!", "danger");
                return;
            }
            if (this.currentStep < 5) {
                this.currentStep++;
                if (this.currentStep === 4) this.buildLivePreview();
                this.syncStepUI();
            }
        };

        document.getElementById('btnWizardPrev').onclick = () => {
            if (this.currentStep > 1) {
                this.currentStep--;
                this.syncStepUI();
            }
        };
    },

    syncStepUI() {
        document.querySelectorAll('.wizard-step').forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.step) === this.currentStep);
        });
        document.querySelectorAll('.step-panel').forEach((el, idx) => {
            el.classList.toggle('active', (idx + 1) === this.currentStep);
        });

        document.getElementById('btnWizardPrev').disabled = (this.currentStep === 1);
        
        if (this.currentStep === 5) {
            document.getElementById('btnWizardNext').style.display = 'none';
            document.getElementById('btnWizardPublish').style.display = 'inline-flex';
        } else {
            document.getElementById('btnWizardNext').style.display = 'inline-flex';
            document.getElementById('btnWizardPublish').style.display = 'none';
        }
    },

    addNewQuestionBlock() {
        const type = document.getElementById('questionTypeSelect').value;
        const qId = 'q-' + Date.now() + Math.random().toString(36).substr(2,4);
        
        const qObj = { id: qId, type, text: '', options: ['Вариант А', 'Вариант Б'], answer: '', points: 5 };
        this.questions.push(qObj);
        
        this.renderQuestionBlocks();
    },

    renderQuestionBlocks() {
        const container = document.getElementById('questionsContainer');
        container.innerHTML = '';

        this.questions.forEach((q, index) => {
            const div = document.createElement('div');
            div.className = 'card';
            div.style.borderColor = 'var(--blue-accent)';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <strong>Суроо №${index + 1} (${q.type})</strong>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="window.removeBuilderQuestion('${q.id}')"><i class="fas fa-trash"></i></button>
                </div>
                <div class="form-group">
                    <label>Суроонун тексти</label>
                    <input type="text" class="form-control" value="${Utils.escapeHTML(q.text)}" oninput="window.updateQText('${q.id}', this.value)">
                </div>
                <div class="form-group" style="margin-top:10px;">
                    <label>Туура жооп / Ачкыч</label>
                    <input type="text" class="form-control" value="${Utils.escapeHTML(q.answer)}" placeholder="Туура жооптун тексти" oninput="window.updateQAnswer('${q.id}', this.value)">
                </div>
            `;
            container.appendChild(div);
        });
    },

    buildLivePreview() {
        const sandbox = document.getElementById('studentPreviewSandbox');
        sandbox.innerHTML = `
            <div style="background:var(--bg-dark-main); padding:20px; border-radius:var(--radius-md);">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
                    <h4>${Utils.escapeHTML(document.getElementById('testTitle').value)}</h4>
                    <span style="color:var(--warning-color);"><i class="fas fa-clock"></i> Таймер: ${Utils.formatDuration(document.getElementById('settDuration').value)}</span>
                </div>
                ${this.questions.map((q, i) => `
                    <div style="margin-bottom:15px;">
                        <p><strong>№${i+1}. ${Utils.escapeHTML(q.text || 'Текст бош')}</strong></p>
                        <input type="text" class="form-control" style="margin-top:6px; max-width:400px;" placeholder="Окуучунун жообу бул жерге жазылат..." disabled>
                    </div>
                `).join('')}
            </div>
        `;
    },

    saveMaster(isDraft = true) {
        const title = document.getElementById('testTitle').value.trim();
        const subject = document.getElementById('testSubject').value.trim();
        const classSelect = document.getElementById('testClassSelect');
        const className = classSelect.options[classSelect.selectedIndex]?.text || '';
        const topic = document.getElementById('testTopic').value.trim();
        const difficulty = document.getElementById('testDifficulty').value;
        const language = document.getElementById('testLanguage').value;
        const description = document.getElementById('testDescription').value.trim();
        
        const duration = Utils.safeNumber(document.getElementById('settDuration').value);
        const attempts = Utils.safeNumber(document.getElementById('settAttempts').value, 1);
        const anticheat = document.getElementById('settAntiCheat').checked;

        const testObject = {
            id: 'test-' + Date.now(),
            title, subject, className, topic, difficulty, language, description,
            status: isDraft ? 'draft' : 'active',
            testCode: Utils.generateTestCode(),
            questions: this.questions,
            settings: { duration, attempts, anticheat },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Storage.saveTeacherData(KEYS.TESTS, testObject);
        UI.showToast(isDraft ? "Тест черновик катары сакталды." : "Тест ийгиликтүү жаарыяланды!");
        
        if(!isDraft) {
            document.getElementById('publishShareZone').style.display = 'block';
            document.getElementById('shareTestLinkInput').value = `https://bilimai.org/take-test?code=${testObject.testCode}`;
        }
        
        // Маалымат китепканада көрүнүшү үчүн рендерди чакыруу
        window.refreshAllViews();
    }
};

window.removeBuilderQuestion = (id) => {
    TestBuilderModule.questions = TestBuilderModule.questions.filter(q => q.id !== id);
    TestBuilderModule.renderQuestionBlocks();
};
window.updateQText = (id, val) => {
    const q = TestBuilderModule.questions.find(q => q.id === id);
    if(q) q.text = val;
};
window.updateQAnswer = (id, val) => {
    const q = TestBuilderModule.questions.find(q => q.id === id);
    if(q) q.answer = val;
};
