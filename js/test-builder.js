// Эски сап: import { db } from './firebase-config.js';
// ЖАҢЫ ОҢДОЛГОН САП:
import { db } from '../js/firebase-config.js'; 
import { collection, addDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let questionCount = 0;
const container = document.getElementById('questionsContainer');
const addBtn = document.getElementById('addQuestionBtn');
const form = document.getElementById('builderForm');

// URL аркылуу оңдоо режимин текшерүү
const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get('id');

if (editId) {
    const editBadge = document.getElementById('editBadge');
    if (editBadge) editBadge.style.display = 'inline-block';
    loadTestForEdit(editId);
} else {
    // Баракча ачылганда автоматтык түрдө 1-суроону чыгаруу
    addQuestion();
}

if (addBtn) {
    addBtn.addEventListener('click', () => addQuestion());
}

function addQuestion(data = null) {
    questionCount++;
    const qId = `q_${questionCount}`;
    
    const qBox = document.createElement('div');
    qBox.className = 'q-box';
    qBox.id = qId;
    
    const qType = data ? data.type : 'single';

    qBox.innerHTML = `
        <div class="q-header">
            <strong>Суроо #${questionCount}</strong>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeQuestion('${qId}')">
                <i class="fa-solid fa-trash"></i> Өчүрүү
            </button>
        </div>

        <div class="form-group" style="margin-bottom: 12px;">
            <label>Суроонун түрү</label>
            <select class="q-type" onchange="changeQuestionType('${qId}', this.value)">
                <option value="single" ${qType === 'single' ? 'selected' : ''}>1 туура варианттуу</option>
                <option value="multiple" ${qType === 'multiple' ? 'selected' : ''}>Көп туура варианттуу</option>
                <option value="pisa" ${qType === 'pisa' ? 'selected' : ''}>PISA суроосу (Контекст / Текст менен)</option>
                <option value="matching" ${qType === 'matching' ? 'selected' : ''}>Дал келтирүү (Сайкештик)</option>
            </select>
        </div>

        <div class="pisa-box pisa-context" style="display: ${qType === 'pisa' ? 'block' : 'none'};">
            <label>PISA Контекст / Окуя / Текст:</label>
            <textarea class="pisa-text" rows="3" placeholder="Бул жерге текст, окуя же графиктин сүрөттөлүшүн жазыңыз...">${data && data.context ? data.context : ''}</textarea>
        </div>

        <div class="form-group">
            <label>Суроонун тексти</label>
            <textarea class="q-text" rows="2" required placeholder="Суроону жазыңыз...">${data ? data.text : ''}</textarea>
        </div>

        <div class="options-container" style="margin-top: 15px;">
            <!-- Варианттар ушул жерге чыгат -->
        </div>
    `;

    container.appendChild(qBox);
    renderOptions(qId, qType, data ? data.options : null);
}

window.removeQuestion = function(qId) {
    const el = document.getElementById(qId);
    if (el) el.remove();
    renumberQuestions();
};

function renumberQuestions() {
    const boxes = container.querySelectorAll('.q-box');
    boxes.forEach((box, idx) => {
        box.querySelector('.q-header strong').innerText = `Суроо #${idx + 1}`;
    });
    questionCount = boxes.length;
}

window.changeQuestionType = function(qId, type) {
    const qBox = document.getElementById(qId);
    const pisaBox = qBox.querySelector('.pisa-box');
    
    if (type === 'pisa') {
        pisaBox.style.display = 'block';
    } else {
        pisaBox.style.display = 'none';
    }

    renderOptions(qId, type);
};

function renderOptions(qId, type, optionsData = null) {
    const qBox = document.getElementById(qId);
    const optContainer = qBox.querySelector('.options-container');

    if (type === 'matching') {
        optContainer.innerHTML = `
            <label>Дал келтирүү түгөйлөрү:</label>
            <div class="opt-list match-list"></div>
            <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 10px;" onclick="addMatchPair('${qId}')">
                <i class="fa-solid fa-plus"></i> Түгөй кошуу
            </button>
        `;
        
        if (optionsData && optionsData.length) {
            optionsData.forEach(pair => addMatchPair(qId, pair.left, pair.right));
        } else {
            addMatchPair(qId);
            addMatchPair(qId);
        }
    } else {
        const inputType = type === 'multiple' ? 'checkbox' : 'radio';
        optContainer.innerHTML = `
            <label>Жооп варианттары (Туура жоопту белгилеңиз):</label>
            <div class="opt-list standard-list"></div>
            <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 10px;" onclick="addOptionItem('${qId}', '${inputType}')">
                <i class="fa-solid fa-plus"></i> Вариант кошуу
            </button>
        `;
        
        if (optionsData && optionsData.length) {
            optionsData.forEach(opt => addOptionItem(qId, inputType, opt.text, opt.isCorrect));
        } else {
            addOptionItem(qId, inputType);
            addOptionItem(qId, inputType);
            addOptionItem(qId, inputType);
            addOptionItem(qId, inputType);
        }
    }
}

window.addOptionItem = function(qId, inputType, text = '', isCorrect = false) {
    const qBox = document.getElementById(qId);
    const list = qBox.querySelector('.standard-list');
    
    const item = document.createElement('div');
    item.className = 'opt-item';
    item.innerHTML = `
        <input type="${inputType}" name="correct_${qId}" ${isCorrect ? 'checked' : ''}>
        <input type="text" class="opt-text" required placeholder="Варианттын тексти" value="${text}">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding: 4px 8px;">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    list.appendChild(item);
};

window.addMatchPair = function(qId, leftText = '', rightText = '') {
    const qBox = document.getElementById(qId);
    const list = qBox.querySelector('.match-list');

    const pair = document.createElement('div');
    pair.className = 'match-pair';
    pair.innerHTML = `
        <input type="text" class="match-left" required placeholder="Сол жагы (мис: Ампер)" value="${leftText}">
        <input type="text" class="match-right" required placeholder="Оң жагы (мис: Ток күчү)" value="${rightText}">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding: 4px 8px;">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    list.appendChild(pair);
};

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('testTitle').value.trim();
        const subject = document.getElementById('testSubject').value.trim();
        const grade = document.getElementById('testGrade').value.trim();
        const topic = document.getElementById('testTopic').value.trim();
        const duration = parseInt(document.getElementById('testDuration').value);

        const questions = [];
        const qBoxes = container.querySelectorAll('.q-box');

        qBoxes.forEach((qBox) => {
            const type = qBox.querySelector('.q-type').value;
            const text = qBox.querySelector('.q-text').value.trim();
            const pisaContext = type === 'pisa' ? qBox.querySelector('.pisa-text').value.trim() : '';

            const options = [];

            if (type === 'matching') {
                const pairs = qBox.querySelectorAll('.match-pair');
                pairs.forEach(p => {
                    options.push({
                        left: p.querySelector('.match-left').value.trim(),
                        right: p.querySelector('.match-right').value.trim()
                    });
                });
            } else {
                const items = qBox.querySelectorAll('.opt-item');
                items.forEach(it => {
                    const isCorrect = it.querySelector('input[type="radio"], input[type="checkbox"]').checked;
                    const optText = it.querySelector('.opt-text').value.trim();
                    options.push({
                        text: optText,
                        isCorrect: isCorrect
                    });
                });
            }

            questions.push({
                type,
                text,
                context: pisaContext,
                options
            });
        });

        const testData = {
            title,
            subject,
            grade,
            topic,
            duration,
            questions,
            createdAt: new Date().toISOString()
        };

        try {
            if (editId) {
                await updateDoc(doc(db, "tests", editId), testData);
                alert("Тест ийгиликтүү жаңыланды!");
            } else {
                await addDoc(collection(db, "tests"), testData);
                alert("Тест ийгиликтүү түзүлдү жана жарыяланды!");
            }
            window.location.href = 'tests.html';
        } catch (err) {
            console.error("Сактоодо ката чыкты: ", err);
            alert("Ката чыкты: " + err.message);
        }
    });
}

async function loadTestForEdit(id) {
    try {
        const docRef = doc(db, "tests", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('testTitle').value = data.title || '';
            document.getElementById('testSubject').value = data.subject || '';
            document.getElementById('testGrade').value = data.grade || '';
            document.getElementById('testTopic').value = data.topic || '';
            document.getElementById('testDuration').value = data.duration || 15;

            container.innerHTML = '';
            questionCount = 0;

            if (data.questions && data.questions.length) {
                data.questions.forEach(q => addQuestion(q));
            }
        }
    } catch (err) {
        console.error("Тестти жүктөөдө ката чыкты:", err);
    }
}
