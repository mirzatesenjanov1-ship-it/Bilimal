// Bilimal/js/test-builder.js файлынан Bilimal/js/firebase/firebase-config.js файлын туура туташтыруу
import { db, auth } from './firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, child, set, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;
let editTestId = null;
let questionCounter = 0;

// Баракчадагы акыркы активдүү фокустагы текстовый инпутту эстеп калуучу өзгөрмө
let activeInputTarget = null;

const urlParams = new URLSearchParams(window.location.search);
editTestId = urlParams.get('id');

document.addEventListener('DOMContentLoaded', () => {
    // Каалаган текст кутучасы фокуска келгенде шилтемени сактап калуу
    document.addEventListener('focusin', (e) => {
        if (e.target && (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type === 'text'))) {
            activeInputTarget = e.target;
        }
    });

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
            window.location.href = '../login.html';
        }
    });

    const addQBtn = document.getElementById('addQuestionBtn');
    if (addQBtn) {
        addQBtn.addEventListener('click', () => addQuestion('single'));
    }

    const builderForm = document.getElementById('builderForm');
    if (builderForm) {
        builderForm.addEventListener('submit', handleFormSubmit);
    }
});

function triggerMathJaxRender(targetElement = null) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        const elements = targetElement ? [targetElement] : undefined;
        window.MathJax.typesetPromise(elements).catch(err => console.error("MathJax Render Error:", err));
    }
}

/**
 * PDF жана Word файлдарынан көчүрүлгөндө бузулган Unicode жана атайын шрифтик кутучаларды (☐)
 * физикалык жана математикалык символикага нормалдаштыруучу Deep Sanitizer Engine.
 */
function cleanAndFixMathSymbols(text) {
    if (!text) return '';

    return text
        // 1. Белгисиз PUA аймактарын жана контролдук Unicode ариптерин тазалоо
        .replace(/[\uDB40\uDC00-\uDB40\uDC7F]/g, '') 
        .replace(/[\uE000-\uF8FF]/g, '')
        .replace(/\u00A0/g, ' ')

        // 2. Word/PDF'тен бузулуп түшкөн ро (ρ) жана индекс 0 (ρ₀) кутучаларын нормалдаштыруу
        .replace(/o\s*[\u25A0-\u25FF\u2500-\u257F\uFFFD\u25A1\u25A0]/g, 'ρ₀')
        .replace(/o\s*[\u25A0-\u25FF\uFFFD]{1,2}/g, 'ρ₀')
        
        // Жөнөкөй кутуча же бузулган глиф -> ρ
        .replace(/[\u25A0\u25A1\u25FE\u25FD\uFFFD\u25AF]/g, 'ρ')
        
        // 3. Латынча p_0, po, p0 учурларын физикалык ро (ρ₀) символуна тууралоо
        .replace(/p_o/gi, 'ρ₀')
        .replace(/p_0/gi, 'ρ₀')
        .replace(/po/gi, 'ρ₀')
        .replace(/p₀/gi, 'ρ₀')
        
        // 4. Даражаларды нормалдаштыруу (a3 -> a³, a2 -> a²)
        .replace(/a3\(/g, 'a³(')
        .replace(/a2\(/g, 'a²(')
        .replace(/a3/g, 'a³')
        .replace(/a2/g, 'a²')

        // 5. Жалгыз 'p' тамгасын физикалык өзгөрмө катары ρ менен оңдоо
        .replace(/(\b)p(\b)/g, '$1ρ$2')

        // 6. Стандарттык Unicode NFC Каноникалык нормализациясы
        .normalize('NFC');
}

/**
 * Көчүрүлгөндө (Paste) же Текст киргизилгенде заматта тазалап, Превьюну көрсөтүүчү адаптер
 */
function setupLiveFormulaPreview(inputElem, previewElem) {
    if (!inputElem || !previewElem) return;

    const updatePreview = () => {
        const rawText = inputElem.value;
        const cleanedText = cleanAndFixMathSymbols(rawText);

        if (rawText !== cleanedText) {
            const start = inputElem.selectionStart;
            const end = inputElem.selectionEnd;
            inputElem.value = cleanedText;
            try { inputElem.setSelectionRange(start, end); } catch (e) {}
        }

        if (cleanedText) {
            if ((cleanedText.includes('\\') || cleanedText.includes('^') || cleanedText.includes('_')) && !cleanedText.includes('$')) {
                previewElem.innerHTML = `$${cleanedText}$`;
            } else {
                previewElem.innerHTML = cleanedText;
            }
        } else {
            previewElem.innerHTML = '<span style="color:#64748b; font-size:12px;">Алдын ала көрүү (Preview)...</span>';
        }
        
        triggerMathJaxRender(previewElem);
    };

    inputElem.addEventListener('input', updatePreview);
    
    // Paste (көчүрүп чаптоо) окуясын тосуу
    inputElem.addEventListener('paste', (e) => {
        e.preventDefault();
        let pastedText = (e.clipboardData || window.clipboardData).getData('text/plain');
        
        pastedText = cleanAndFixMathSymbols(pastedText);

        const start = inputElem.selectionStart || 0;
        const end = inputElem.selectionEnd || 0;
        const currentText = inputElem.value;
        
        inputElem.value = currentText.substring(0, start) + pastedText + currentText.substring(end);
        
        const newCursorPos = start + pastedText.length;
        try { inputElem.setSelectionRange(newCursorPos, newCursorPos); } catch (e) {}
        
        updatePreview();
    });

    if (inputElem.value) {
        updatePreview();
    }
}

/**
 * Глобалдык Тообардан тандалган символду дал учурда фокуста турган Инпутка киргизүү
 */
window.insertSymbolToActive = function(symbol) {
    let targetInput = activeInputTarget;

    if (!targetInput || !document.body.contains(targetInput)) {
        targetInput = document.querySelector('.q-text');
    }

    if (!targetInput) return;

    const start = targetInput.selectionStart || 0;
    const end = targetInput.selectionEnd || 0;
    const currentText = targetInput.value;

    targetInput.value = currentText.substring(0, start) + symbol + currentText.substring(end);
    
    const newPos = start + symbol.length;
    targetInput.focus();
    try { targetInput.setSelectionRange(newPos, newPos); } catch (e) {}

    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
};

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
            <strong style="color:#38bdf8; font-size:16px;">Суроо #${questionCounter}</strong>
            <div style="display:flex; gap:10px; align-items:center;">
                <select class="q-type-select">
                    <option value="single" ${type === 'single' ? 'selected' : ''}>Бир туура варианттуу</option>
                    <option value="multiple" ${type === 'multiple' ? 'selected' : ''}>Көп туура варианттуу</option>
                    <option value="pisa" ${type === 'pisa' ? 'selected' : ''}>PISA (Контексттүү)</option>
                    <option value="matching" ${type === 'matching' ? 'selected' : ''}>Шайкештик (Matching)</option>
                </select>
                <button type="button" class="btn btn-danger btn-sm remove-q-btn"><i class="fa-solid fa-trash"></i> Өчүрүү</button>
            </div>
        </div>

        <div class="pisa-area" style="display: ${type === 'pisa' ? 'block' : 'none'};">
            <div class="pisa-context" style="margin-bottom:14px;">
                <label style="color:#cbd5e1; font-weight:600; display:block; margin-bottom:4px;">PISA Контекст / Текст:</label>
                <textarea class="q-pisa-context" rows="3" placeholder="Метрикалык контекстти жазыңыз...">${data && data.context ? data.context : ''}</textarea>
                <div class="formula-preview pisa-preview"></div>
            </div>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
            <label style="color:#cbd5e1; font-weight:600; display:block; margin-bottom:6px;">Суроонун тексти жана Формула панели:</label>
            
            <div class="symbol-toolbar">
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('ρ')">ρ</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('ρ₀')">ρ₀</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('a³')">a³</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('a²')">a²</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('F = a³(ρ - ρ₀)gh')">Формула</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('\\frac{a}{b}')">Бөлчөк (Fraction)</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('α')">α</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('β')">β</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('Ω')">Ω</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('λ')">λ</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('℃')">℃</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('√')">√</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('π')">π</button>
                <button type="button" class="symbol-btn" onclick="window.insertSymbolToActive('θ')">θ</button>
            </div>
            
            <textarea class="q-text" rows="3" required placeholder="Суроонун текстин жазыңыз...">${data ? data.text : ''}</textarea>
            <div class="formula-preview q-preview"></div>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
            <label style="color:#94a3b8; font-size:13px; display:block; margin-bottom:4px;">Сүрөт шилтемеси (URL / Сүрөт болсо):</label>
            <input type="url" class="q-img" placeholder="https://example.com/image.png" value="${data && data.imageUrl ? data.imageUrl : ''}">
        </div>

        <div class="options-body"></div>
    `;

    container.appendChild(qBox);

    const typeSelect = qBox.querySelector('.q-type-select');
    typeSelect.addEventListener('change', (e) => {
        const newType = e.target.value;
        const pisaArea = qBox.querySelector('.pisa-area');
        pisaArea.style.display = newType === 'pisa' ? 'block' : 'none';
        renderOptions(qId, newType, null);
    });

    const removeBtn = qBox.querySelector('.remove-q-btn');
    removeBtn.addEventListener('click', () => {
        qBox.remove();
    });

    const qTextElem = qBox.querySelector('.q-text');
    const qPreviewElem = qBox.querySelector('.q-preview');
    setupLiveFormulaPreview(qTextElem, qPreviewElem);

    const pisaContextElem = qBox.querySelector('.q-pisa-context');
    const pisaPreviewElem = qBox.querySelector('.pisa-preview');
    setupLiveFormulaPreview(pisaContextElem, pisaPreviewElem);

    renderOptions(qId, type, data ? data.options : null);
}

function renderOptions(qId, type, existingOptions = null) {
    const qBox = document.getElementById(qId);
    if (!qBox) return;

    const optionsBody = qBox.querySelector('.options-body');
    optionsBody.innerHTML = '';

    if (type === 'matching') {
        const container = document.createElement('div');
        container.innerHTML = `<label style="color:#a5b4fc; margin-bottom:8px; display:block; font-weight:600;">Дал келтирүү жуптары:</label>`;

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
            <button type="button" class="btn btn-danger btn-sm remove-opt-btn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="formula-preview opt-preview"></div>
    `;
    container.appendChild(itemWrapper);

    const removeBtn = itemWrapper.querySelector('.remove-opt-btn');
    removeBtn.addEventListener('click', () => itemWrapper.remove());

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
            <button type="button" class="btn btn-danger btn-sm remove-pair-btn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:6px;">
            <div class="formula-preview left-preview"></div>
            <div class="formula-preview right-preview"></div>
        </div>
    `;
    container.appendChild(pairWrapper);

    const removeBtn = pairWrapper.querySelector('.remove-pair-btn');
    removeBtn.addEventListener('click', () => pairWrapper.remove());

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
        const pisaContextElem = qBox.querySelector('.q-pisa-context');
        const pisaContext = pisaContextElem ? cleanAndFixMathSymbols(pisaContextElem.value.trim()) : '';

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
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сактоо жана Жарыялоо 🚀';
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
        window.location.href = '../sections/tests.html';
    } catch (err) {
        console.error("Сактоо катасы:", err);
        alert("Сактоодо ката чыкты: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сактоо жана Жарыялоо 🚀';
    }
}
