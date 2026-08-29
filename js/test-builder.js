import { db, auth } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, child, set, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;
let editTestId = null;
let questionCounter = 0;

const urlParams = new URLSearchParams(window.location.search);
editTestId = urlParams.get('id');

// 1. MATHLIVE КЛАВИАТУРАСЫН ТУУРА ЖАНА КООЗ ИКОНКАЛАР МЕНЕН ОРНОТУУ
if (window.mathVirtualKeyboard) {
    window.mathVirtualKeyboard.layouts = [
        {
            label: 'Формулалар',
            tooltip: 'Физика жана математика куралдары',
            layers: [
                {
                    rows: [
                        [
                            { insert: '\\frac{#?}{#?}', label: 'a/b', tooltip: 'Бөлчөк' },
                            { insert: '#?_{#?}', label: 'xₙ', tooltip: 'Төмөнкү индекс' },
                            { insert: '#?^{#?}', label: 'xⁿ', tooltip: 'Даража (Жогорку индекс)' },
                            { insert: '#?_{#?}^{#?}', label: 'xₙⁿ', tooltip: 'Эки тараптуу индекс' },
                            { insert: '\\sqrt{#?}', label: '√x', tooltip: 'Квадраттык тамыр' },
                            { insert: '\\sqrt[#?]{#?}', label: 'ⁿ√x', tooltip: 'n-даражалуу тамыр' },
                            { insert: '\\left(#?\\right)', label: '(x)', tooltip: 'Кашаалар' },
                            { insert: '\\vec{#?}', label: 'x⃗', tooltip: 'Вектор' }
                        ],
                        [
                            { insert: '7', label: '7' },
                            { insert: '8', label: '8' },
                            { insert: '9', label: '9' },
                            { insert: '\\div', label: '÷' },
                            { insert: '\\times', label: '×' },
                            { insert: '+', label: '+' },
                            { insert: '-', label: '-' },
                            { insert: '=', label: '=' }
                        ],
                        [
                            { insert: '4', label: '4' },
                            { insert: '5', label: '5' },
                            { insert: '6', label: '6' },
                            { insert: '\\alpha', label: 'α' },
                            { insert: '\\beta', label: 'β' },
                            { insert: '\\gamma', label: 'γ' },
                            { insert: '\\Delta', label: 'Δ' },
                            { insert: '\\Omega', label: 'Ω' }
                        ],
                        [
                            { insert: '1', label: '1' },
                            { insert: '2', label: '2' },
                            { insert: '3', label: '3' },
                            { insert: '0', label: '0' },
                            { insert: '.', label: '.' },
                            { insert: '\\pi', label: 'π' },
                            { insert: '\\infty', label: '∞' },
                            { insert: '^\\circ C', label: '℃' }
                        ],
                        [
                            { command: ['performWithFeedback', 'deleteBackward'], label: '<i class="fa-solid fa-backspace"></i>' },
                            { command: ['performWithFeedback', 'moveToPreviousChar'], label: '❮' },
                            { command: ['performWithFeedback', 'moveToNextChar'], label: '❯' },
                            { command: ['toggleVirtualKeyboard'], label: '✖ Жабуу' }
                        ]
                    ]
                }
            ]
        },
        'numeric',
        'symbols',
        'alphabetic'
    ];
}

function attachMathEditor(parentContainer, placeholderText = '', defaultValue = '') {
    const mathField = document.createElement('math-field');
    mathField.setValue(defaultValue || '');
    mathField.placeholder = placeholderText;
    mathField.mathVirtualKeyboardPolicy = "auto";
    
    parentContainer.appendChild(mathField);
    return mathField;
}

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            if (editTestId) {
                const badge = document.getElementById('editBadge');
                if (badge) badge.style.display = 'inline-block';
                await loadExistingTest(editTestId);
            } else {
                addQuestion('single');
            }
        } else {
            alert("Тест түзүү же оңдоо үчүн системага киришиңиз керек!");
            window.location.href = '/login.html';
        }
    });

    const addBtn = document.getElementById('addQuestionBtn');
    if (addBtn) addBtn.addEventListener('click', () => addQuestion('single'));
    
    const form = document.getElementById('builderForm');
    if (form) form.addEventListener('submit', handleFormSubmit);
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
                <div class="pisa-editor-holder"></div>
            </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
            <label>Суроонун тексти / Формуласы:</label>
            <div class="q-text-holder"></div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
            <label>Сүрөт шилтемеси (URL / Сүрөт болсо):</label>
            <input type="url" class="q-img" placeholder="https://example.com/image.png" value="${data && data.imageUrl ? data.imageUrl : ''}">
        </div>

        <div class="options-body"></div>
    `;

    container.appendChild(qBox);

    const qTextHolder = qBox.querySelector('.q-text-holder');
    qBox.qMathField = attachMathEditor(qTextHolder, "Суроону же формуланы жазыңыз...", data ? data.text : '');

    const pisaHolder = qBox.querySelector('.pisa-editor-holder');
    qBox.pisaMathField = attachMathEditor(pisaHolder, "PISA контексти же окуясын жазыңыз...", data && data.context ? data.context : '');

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
        <div class="opt-math-holder" style="flex:1;"></div>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(item);

    const holder = item.querySelector('.opt-math-holder');
    item.optMathField = attachMathEditor(holder, "Варианттын текстин жазыңыз...", text);
}

function addMatchPair(container, leftVal = '', rightVal = '') {
    const pair = document.createElement('div');
    pair.className = 'match-pair';
    pair.innerHTML = `
        <div class="match-left-holder"></div>
        <div class="match-right-holder"></div>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(pair);

    pair.leftMathField = attachMathEditor(pair.querySelector('.match-left-holder'), "Сол тарабы", leftVal);
    pair.rightMathField = attachMathEditor(pair.querySelector('.match-right-holder'), "Оң тарабы", rightVal);
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
        const text = qBox.qMathField ? qBox.qMathField.getValue('latex') : '';
        const imageUrl = qBox.querySelector('.q-img').value.trim();
        const pisaContext = qBox.pisaMathField ? qBox.pisaMathField.getValue('latex') : '';

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
                const left = p.leftMathField ? p.leftMathField.getValue('latex') : '';
                const right = p.rightMathField ? p.rightMathField.getValue('latex') : '';
                if (left && right) {
                    pairs.push({ left, right });
                }
            });
            qObj.options = pairs;
        } else {
            const options = [];
            qBox.querySelectorAll('.opt-item').forEach(optItem => {
                const isCorrect = optItem.querySelector('input[type="radio"], input[type="checkbox"]').checked;
                const optText = optItem.optMathField ? optItem.optMathField.getValue('latex') : '';
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
