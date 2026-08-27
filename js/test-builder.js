import { db, auth } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, child, set, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;
let editTestId = null;
let questionCounter = 0;

const urlParams = new URLSearchParams(window.location.search);
editTestId = urlParams.get('id');

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

// MathJax рендерлөө
function triggerMathJaxRender(targetElement = null) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        const elements = targetElement ? [targetElement] : undefined;
        window.MathJax.typesetPromise(elements).catch(err => console.error("MathJax Render Error:", err));
    }
}

// PDF/Word'дон көчүрүлгөндө бузулган математикалык символдорду тууралоочу алгоритм
function cleanAndFixMathSymbols(text) {
    if (!text) return '';

    return text
        // 1. PDF'теги сынык/бузулган квадраттарды жана шрифттерди туура грек тамгаларына алмаштыруу
        .replace(/[\uDB40\uDC00-\uDB40\uDC7F]/g, '') // Көрүнбөгөн зыян тамгаларды тазалоо
        .replace(/o\s*[\u25A0-\u25FF\u2500-\u257F\uFFFD\u25A1\u25A0]/g, 'ρ₀') // o жана кутуча кошулуп калса -> ρ₀
        .replace(/[\u25A0\u25A1\u25FE\u25FD\uFFFD]/g, 'ρ') // Жөнөкөй квадраттарды ро (ρ) тамгасына алмаштыруу
        
        // 2. Индекс жана Даражаларды тазалоо
        .replace(/a3\(/g, 'a³(')
        .replace(/a2\(/g, 'a²(')
        .replace(/p_o/g, 'ρ₀')
        .replace(/p_0/g, 'ρ₀')
        .replace(/po/g, 'ρ₀')
        .replace(/(\b)p(\b)/g, '$1ρ$2') // Жалгыз p тамгасы болсо -> ρ
        
        // 3. Стандарттык математикалык Unicode белгилерин нормалдаштыруу
        .normalize('NFC');
}

// Талаага киргизилген же көчүрүлгөн маалыматты Live Preview катары рендерлөө
function setupLiveFormulaPreview(inputElem, previewElem) {
    if (!inputElem || !previewElem) return;

    const updatePreview = () => {
        // Тазалоо функциясын иштетүү
        let text = cleanAndFixMathSymbols(inputElem.value);
        if (inputElem.value !== text) {
            inputElem.value = text; // Инпуттун ичин да туура калыбына келтирет
        }

        if (text && (text.includes('\\') || text.includes('^') || text.includes('_')) && !text.includes('$')) {
            previewElem.innerHTML = `$${text}$`;
        } else {
            previewElem.innerHTML = text;
        }
        triggerMathJaxRender(previewElem);
    };

    inputElem.addEventListener('input', updatePreview);
    
    // КӨЧҮРҮП КЕЛГЕНДЕ (PASTE EVENT) БУЗУЛГАН КВАДРАТТАРДЫ ЗАМАТТА ОҢДОО
    inputElem.addEventListener('paste', (e) => {
        e.preventDefault();
        let pastedText = (e.clipboardData || window.clipboardData).getData('text/plain');
        
        // Алдын ала тазалоо
        pastedText = cleanAndFixMathSymbols(pastedText);

        const start = inputElem.selectionStart;
        const end = inputElem.selectionEnd;
        const currentText = inputElem.value;
        
        inputElem.value = currentText.substring(0, start) + pastedText + currentText.substring(end);
        inputElem.selectionStart = inputElem.selectionEnd = start + pastedText.length;
        
        updatePreview();
    });

    if (inputElem.value) {
        updatePreview();
    }
}

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
                <textarea class="q-pisa-context" rows="3" placeholder="Метрикалык контекстти жазыңыз...">${data && data.context ? data.context : ''}</textarea>
                <div class="formula-preview pisa-preview"></div>
            </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
            <div class="symbol-toolbar">
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', 'ρ')">ρ</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', 'ρ₀')">ρ₀</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', 'a³')">a³</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', 'a²')">a²</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', '$E=mc^2$')">Formula</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', '\\frac{a}{b}')">Fraction</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', 'α')">α</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', 'β')">β</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', 'Ω')">Ω</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', 'λ')">λ</button>
                <button type="button" class="symbol-btn" onclick="insertSymbol('${qId}', '℃')">℃</button>
            </div>
            <textarea class="q-text" rows="2" required placeholder="Суроонун текстин жазыңыз...">${data ? data.text : ''}</textarea>
            <div class="formula-preview q-preview"></div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
            <label>Сүрөт шилтемеси (URL / Сүрөт болсо):</label>
            <input type="url" class="q-img" placeholder="https://example.com/image.png" value="${data && data.imageUrl ? data.imageUrl : ''}">
        </div>

        <div class="options-body"></div>
    `;

    container.appendChild(qBox);

    const qTextElem = qBox.querySelector('.q-text');
    const qPreviewElem = qBox.querySelector('.q-preview');
    setupLiveFormulaPreview(qTextElem, qPreviewElem);

    const pisaContextElem = qBox.querySelector('.q-pisa-context');
    const pisaPreviewElem = qBox.querySelector('.pisa-preview');
    setupLiveFormulaPreview(pisaContextElem, pisaPreviewElem);

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

window.insertSymbol = function(qId, symbol) {
    const qBox = document.getElementById(qId);
    const textarea = qBox.querySelector('.q-text');
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + symbol + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + symbol.length;
    textarea.focus();

    textarea.dispatchEvent(new Event('input'));
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
    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'opt-item-wrapper';
    const inputType = isMultiple ? 'checkbox' : 'radio';

    itemWrapper.innerHTML = `
        <div class="opt-item">
            <input type="${inputType}" name="correct_${qId}" ${isCorrect ? 'checked' : ''}>
            <input type="text" class="opt-text" required placeholder="Варианттын текстин жазыңыз" value="${text}">
            <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.opt-item-wrapper').remove()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="formula-preview opt-preview"></div>
    `;
    container.appendChild(itemWrapper);

    const inputElem = itemWrapper.querySelector('.opt-text');
    const previewElem = itemWrapper.querySelector('.opt-preview');
    setupLiveFormulaPreview(inputElem, previewElem);
}

function addMatchPair(container, leftVal = '', rightVal = '') {
    const pairWrapper = document.createElement('div');
    pairWrapper.className = 'match-pair-wrapper';
    pairWrapper.innerHTML = `
        <div class="match-pair">
            <input type="text" class="match-left" placeholder="Сол тарабы" value="${leftVal}" required>
            <input type="text" class="match-right" placeholder="Оң тарабы" value="${rightVal}" required>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.match-pair-wrapper').remove()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="formula-preview left-preview"></div>
            <div class="formula-preview right-preview"></div>
        </div>
    `;
    container.appendChild(pairWrapper);

    const leftInput = pairWrapper.querySelector('.match-left');
    const leftPreview = pairWrapper.querySelector('.left-preview');
    setupLiveFormulaPreview(leftInput, leftPreview);

    const rightInput = pairWrapper.querySelector('.match-right');
    const rightPreview = pairWrapper.querySelector('.right-preview');
    setupLiveFormulaPreview(rightInput, rightPreview);
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
            triggerMathJaxRender();
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
        const text = cleanAndFixMathSymbols(qBox.querySelector('.q-text').value.trim());
        const imageUrl = qBox.querySelector('.q-img').value.trim();
        const pisaContext = qBox.querySelector('.q-pisa-context') ? cleanAndFixMathSymbols(qBox.querySelector('.q-pisa-context').value.trim()) : '';

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
            qBox.querySelectorAll('.match-pair-wrapper').forEach(p => {
                const left = cleanAndFixMathSymbols(p.querySelector('.match-left').value.trim());
                const right = cleanAndFixMathSymbols(p.querySelector('.match-right').value.trim());
                if (left && right) {
                    pairs.push({ left, right });
                }
            });
            qObj.options = pairs;
        } else {
            const options = [];
            qBox.querySelectorAll('.opt-item-wrapper').forEach(optWrapper => {
                const isCorrect = optWrapper.querySelector('input[type="radio"], input[type="checkbox"]').checked;
                const optText = cleanAndFixMathSymbols(optWrapper.querySelector('.opt-text').value.trim());
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
