import { db, auth } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, child, set, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;
let editTestId = null;
let questionCounter = 0;

const urlParams = new URLSearchParams(window.location.search);
editTestId = urlParams.get('id');

// ТАЗА ЖАНА ТҮШҮНҮКТҮҮ ФОРМУЛА ШАБЛОНДОРУ
const TEMPLATES = [
    // Бөлчөк (Word сыяктуу)
    { label: '<span class="box-icon"></span>/<span class="box-icon"></span>', code: '$\\frac{?}{?}$', cursorOffset: 7 },
    
    // Даража жана индекс
    { label: '<span class="box-icon"></span><sup><span class="box-icon"></span></sup>', code: '$?^{?}$', cursorOffset: 4 },
    { label: '<span class="box-icon"></span><sub><span class="box-icon"></span></sub>', code: '$?_{?}$', cursorOffset: 4 },
    
    // Тамырлар
    { label: '√<span class="box-icon"></span>', code: '$\\sqrt{?}$', cursorOffset: 7 },
    { label: '<sup>n</sup>√<span class="box-icon"></span>', code: '$\\sqrt[n]{?}$', cursorOffset: 9 },

    // Жөнөкөй Интеграл жана Сумма
    { label: '∫', code: '$\\int_{?}^{?}$', cursorOffset: 7 },
    { label: '∑', code: '$\\sum_{?}^{?}$', cursorOffset: 7 },

    // Тригонометрия
    { label: 'sin', code: '$\\sin(?)$', cursorOffset: 6 },
    { label: 'cos', code: '$\\cos(?)$', cursorOffset: 6 },
    { label: 'tan', code: '$\\tan(?)$', cursorOffset: 6 },
    { label: 'cot', code: '$\\cot(?)$', cursorOffset: 6 },

    // Грек ариптери жана Символдор
    { label: 'α', code: '$\\alpha$', cursorOffset: 8 },
    { label: 'β', code: '$\\beta$', cursorOffset: 7 },
    { label: 'Ω', code: '$\\Omega$', cursorOffset: 8 },
    { label: 'λ', code: '$\\lambda$', cursorOffset: 9 },
    { label: '℃', code: '$^\\circ C$', cursorOffset: 9 },
    { label: 'v⃗', code: '$\\vec{v}$', cursorOffset: 8 },
    { label: 'Δ', code: '$\\Delta$', cursorOffset: 8 },
    { label: '∞', code: '$\\infty$', cursorOffset: 8 },
    { label: '≈', code: '$\\approx$', cursorOffset: 9 },
    { label: '±', code: '$\\pm$', cursorOffset: 5 }
];

// ГОРИЗОНТАЛДЫК СЫДЫРЫЛМА ПАНЕЛДИ ТҮЗҮҮ
function createScrollableToolbar(targetInput) {
    const toolbar = document.createElement('div');
    toolbar.className = 'symbol-toolbar-scroll';

    TEMPLATES.forEach(tpl => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tpl-btn';
        btn.innerHTML = tpl.label;
        btn.title = 'Шаблонду киргизүү';
        
        btn.onmousedown = (e) => {
            e.preventDefault(); // Фокус жоголбош үчүн
            insertTemplateAtCursor(targetInput, tpl.code, tpl.cursorOffset);
        };
        toolbar.appendChild(btn);
    });

    return toolbar;
}

// КУРСОР ТОКТОГОН ЖЕРГЕ ШАБЛОН КИРГИЗҮҮ ЖАНА КУРСОРДУ ЗУУЛАТЫП ЫҢГАЙЛУУ ЖАЙГАШТЫРУУ
function insertTemplateAtCursor(input, code, cursorOffset) {
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    const val = input.value;

    input.value = val.substring(0, start) + code + val.substring(end);
    
    input.focus();
    const newCursorPos = start + (cursorOffset || code.length);
    input.setSelectionRange(newCursorPos, newCursorPos);

    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// ТАЛААЛАРГА (INPUT/TEXTAREA) ПАНЕЛДИ ТИРКӨӨ
function attachToolbarToInput(input) {
    if (!input || input.dataset.hasToolbar) return;
    input.dataset.hasToolbar = "true";

    const toolbar = createScrollableToolbar(input);
    input.parentNode.insertBefore(toolbar, input);
}

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            if (editTestId) {
                document.getElementById('editBadge').style.display = 'inline-block';
                await loadExistingTest(editTestId);
            } else {
                addQuestion('single');
            }
        } else {
            alert("Тест түзүү же оңдоо үчүн системага киришиңиз керек!");
            window.location.href = '/login.html';
        }
    });

    document.getElementById('addQuestionBtn').addEventListener('click', () => addQuestion('single'));
    document.getElementById('builderForm').addEventListener('submit', handleFormSubmit);
});

function addQuestion(type = 'single', data = null) {
    questionCounter++;
    const qId = `q_${questionCounter}`;
    const container = document.getElementById('questionsContainer');

    const qBox = document.createElement('div');
    qBox.className = 'q-box';
    qBox.id = qId;
    qBox.setAttribute('data-qid', qId);

    qBox.innerHTML = `
        <div class="q-header">
            <strong style="color:#00f0ff;">Суроо #${questionCounter}</strong>
            <div style="display:flex; gap:10px; align-items:center;">
                <select class="q-type-select" onchange="changeQuestionType('${qId}', this.value)">
                    <option value="single" ${type === 'single' ? 'selected' : ''}>Бир туура варианттуу</option>
                    <option value="multiple" ${type === 'multiple' ? 'selected' : ''}>Көп туура варианттуу</option>
                    <option value="pisa" ${type === 'pisa' ? 'selected' : ''}>PISA (Контексттүү)</option>
                    <option value="matching" ${type === 'matching' ? 'selected' : ''}>Шайкештик (Matching)</option>
                </select>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeQuestion('${qId}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>

        <div class="pisa-area" style="display: ${type === 'pisa' ? 'block' : 'none'};">
            <div class="pisa-context">
                <label>PISA Контекст / Текст:</label>
                <textarea class="q-pisa-context" rows="3" placeholder="Метрикалык контекстти же окуяны жазыңыз...">${data && data.context ? data.context : ''}</textarea>
            </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
            <textarea class="q-text" rows="2" required placeholder="Суроонун текстин жазыңыз...">${data ? data.text : ''}</textarea>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
            <label>Сүрөт шилтемеси (URL / Сүрөт болсо):</label>
            <input type="url" class="q-img" placeholder="https://example.com/image.png" value="${data && data.imageUrl ? data.imageUrl : ''}">
        </div>

        <div class="options-body"></div>
    `;

    container.appendChild(qBox);

    // Куралдар панелин суроого жана PISA контекстине кошуу
    attachToolbarToInput(qBox.querySelector('.q-text'));
    const pisaTextarea = qBox.querySelector('.q-pisa-context');
    if (pisaTextarea) attachToolbarToInput(pisaTextarea);

    renderOptions(qId, type, data ? data.options : null);
}

window.removeQuestion = function(qId) {
    const el = document.getElementById(qId);
    if (el) el.remove();
};

window.changeQuestionType = function(qId, newType) {
    const qBox = document.getElementById(qId);
    const pisaArea = qBox.querySelector('.pisa-area');
    pisaArea.style.display = newType === 'pisa' ? 'block' : 'none';
    renderOptions(qId, newType, null);
};

function renderOptions(qId, type, existingOptions = null) {
    const qBox = document.getElementById(qId);
    const optionsBody = qBox.querySelector('.options-body');
    optionsBody.innerHTML = '';

    if (type === 'matching') {
        const container = document.createElement('div');
        container.innerHTML = `<label style="color:#a5b4fc; margin-bottom:5px; display:block;">Дал келтирүү жуптары:</label>`;

        const list = document.createElement('div');
        list.className = 'match-list';
        container.appendChild(list);

        const addPairBtn = document.createElement('button');
        addPairBtn.type = 'button';
        addPairBtn.className = 'btn btn-secondary btn-sm';
        addPairBtn.style.marginTop = '10px';
        addPairBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Жуп кошуу';
        addPairBtn.onclick = () => addMatchPair(list);

        container.appendChild(addPairBtn);
        optionsBody.appendChild(container);

        if (existingOptions && Array.isArray(existingOptions)) {
            existingOptions.forEach(pair => addMatchPair(list, pair.left, pair.right));
        } else {
            addMatchPair(list);
            addMatchPair(list);
        }
    } else {
        const list = document.createElement('div');
        list.className = 'opt-list';

        const addOptBtn = document.createElement('button');
        addOptBtn.type = 'button';
        addOptBtn.className = 'btn btn-secondary btn-sm';
        addOptBtn.style.marginTop = '10px';
        addOptBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Вариант кошуу';
        addOptBtn.onclick = () => addOptionItem(list, qId, type === 'multiple');

        optionsBody.appendChild(list);
        optionsBody.appendChild(addOptBtn);

        if (existingOptions && Array.isArray(existingOptions)) {
            existingOptions.forEach(opt => {
                const isObj = typeof opt === 'object';
                const txt = isObj ? opt.text : opt;
                const isCorr = isObj ? !!opt.isCorrect : false;
                addOptionItem(list, qId, type === 'multiple', txt, isCorr);
            });
        } else {
            addOptionItem(list, qId, type === 'multiple', '', true);
            addOptionItem(list, qId, type === 'multiple', '', false);
            addOptionItem(list, qId, type === 'multiple', '', false);
            addOptionItem(list, qId, type === 'multiple', '', false);
        }
    }
}

function addOptionItem(container, qId, isMultiple, text = '', isCorrect = false) {
    const item = document.createElement('div');
    item.className = 'opt-item';
    const inputType = isMultiple ? 'checkbox' : 'radio';

    item.innerHTML = `
        <input type="${inputType}" name="correct_${qId}" ${isCorrect ? 'checked' : ''}>
        <input type="text" class="opt-text" required placeholder="Варианттын текстин жазыңыз..." value="${text}">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(item);

    // Вариант киргизүү талаасына да куралдар панелин байлоо
    attachToolbarToInput(item.querySelector('.opt-text'));
}

function addMatchPair(container, leftVal = '', rightVal = '') {
    const pair = document.createElement('div');
    pair.className = 'match-pair';
    pair.innerHTML = `
        <input type="text" class="match-left" placeholder="Сол тарабы (мис: $F$)" value="${leftVal}" required>
        <input type="text" class="match-right" placeholder="Оң тарабы (мис: Күч)" value="${rightVal}" required>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(pair);

    // Дал келтирүү талааларына да панелди байлоо
    attachToolbarToInput(pair.querySelector('.match-left'));
    attachToolbarToInput(pair.querySelector('.match-right'));
}

async function loadExistingTest(id) {
    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `tests/${id}`));

        if (snapshot.exists()) {
            const data = snapshot.val();
            document.getElementById('testTitle').value = data.title || '';
            document.getElementById('testSubject').value = data.subject || '';
            document.getElementById('testGrade').value = data.grade || '';
            document.getElementById('testTopic').value = data.topic || '';
            document.getElementById('testDuration').value = data.duration || 15;

            document.getElementById('questionsContainer').innerHTML = '';
            questionCounter = 0;

            if (data.questions && Array.isArray(data.questions)) {
                data.questions.forEach(q => {
                    addQuestion(q.type || 'single', q);
                });
            }
        } else {
            alert("Оңдоо үчүн тест табылган жок!");
        }
    } catch (e) {
        console.error("Тестти жүктөөдө ката:", e);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
        alert("Авторизациядан өтүңүз!");
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Сакталууда...';

    const questionsArr = [];
    const qBoxes = document.querySelectorAll('.q-box');

    qBoxes.forEach(qBox => {
        const type = qBox.querySelector('.q-type-select').value;
        const text = qBox.querySelector('.q-text').value.trim();
        const imageUrl = qBox.querySelector('.q-img').value.trim();
        const pisaContext = qBox.querySelector('.q-pisa-context') ? qBox.querySelector('.q-pisa-context').value.trim() : '';

        const qObj = {
            type: type,
            text: text,
            imageUrl: imageUrl || null
        };

        if (type === 'pisa') {
            qObj.context = pisaContext;
        }

        if (type === 'matching') {
            const pairs = [];
            qBox.querySelectorAll('.match-pair').forEach(p => {
                const left = p.querySelector('.match-left').value.trim();
                const right = p.querySelector('.match-right').value.trim();
                if (left && right) {
                    pairs.push({ left, right });
                }
            });
            qObj.options = pairs;
        } else {
            const options = [];
            qBox.querySelectorAll('.opt-item').forEach(optItem => {
                const isCorrect = optItem.querySelector('input[type="radio"], input[type="checkbox"]').checked;
                const optText = optItem.querySelector('.opt-text').value.trim();
                if (optText) {
                    options.push({ text: optText, isCorrect: isCorrect });
                }
            });
            qObj.options = options;
        }

        questionsArr.push(qObj);
    });

    if (questionsArr.length === 0) {
        alert("Кем дегенде 1 суроо кошуңуз!");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Сактоо жана Жарыялоо 🚀';
        return;
    }

    const testPayload = {
        title: document.getElementById('testTitle').value.trim(),
        subject: document.getElementById('testSubject').value.trim(),
        grade: document.getElementById('testGrade').value.trim(),
        topic: document.getElementById('testTopic').value.trim(),
        duration: parseInt(document.getElementById('testDuration').value) || 15,
        ownerUid: currentUser.uid,
        updatedAt: new Date().toISOString(),
        questions: questionsArr
    };

    try {
        if (editTestId) {
            await update(ref(db, `tests/${editTestId}`), testPayload);
            alert("Тест ийгиликтүү жаңыртылды!");
        } else {
            testPayload.createdAt = new Date().toISOString();
            testPayload.hidden = false;
            const newTestRef = ref(db, `tests/${Date.now()}`);
            await set(newTestRef, testPayload);
            alert("Жаңы тест ийгиликтүү түзүлдү жана жарыяланды!");
        }
        window.location.href = 'tests.html';
    } catch (err) {
        console.error("Сактоо катасы:", err);
        alert("Сактоодо ката чыкты: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Сактоо жана Жарыялоо 🚀';
    }
}
