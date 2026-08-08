import { auth, db } from '/firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, push, set, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;
let editTestId = null;

// URL'ден editId параметрин текшерүү (?editId=XXXX)
const urlParams = new URLSearchParams(window.location.search);
editTestId = urlParams.get('editId');

// Auth текшерүү
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/dashboard.html";
        return;
    }
    currentUser = user;

    if (editTestId) {
        // Оңдоо режими: Базадан эски тестти жүктөө
        const editBadge = document.getElementById('editBadge');
        if (editBadge) editBadge.style.display = 'inline-block';
        
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Өзгөртүүлөрдү сактоо 💾`;

        await loadTestForEdit(editTestId);
    } else {
        // Жаңы тест түзүү режими: Биринчи бош суроону кошуу
        addQuestion();
    }
});

// Суроону кошуу функциясы
function addQuestion(qData = null) {
    const container = document.getElementById('questionsContainer');
    const qCount = container.children.length + 1;

    const qDiv = document.createElement('div');
    qDiv.className = 'q-box';
    
    // Суроонун ички структурасы
    qDiv.innerHTML = `
        <div class="q-header">
            <strong class="q-number">Суроо #${qCount}</strong>
            <button type="button" class="btn btn-danger btn-remove-q"><i class="fa-solid fa-trash"></i></button>
        </div>
        <input type="text" class="q-text" placeholder="Суроонун текстин жазыңыз..." style="width:100%; margin-bottom:12px;" required value="${qData ? qData.text : ''}">
        
        <label style="font-size:0.8rem; color:#a5b4fc;">Варианттар (Туура жооптун тушундагы радио-баскычты белгилеңиз):</label>
        <div class="opt-list">
            ${generateOptionHTML(qCount, 0, qData ? qData.options[0] : '', qData ? qData.correct === 0 : true)}
            ${generateOptionHTML(qCount, 1, qData ? qData.options[1] : '', qData ? qData.correct === 1 : false)}
            ${generateOptionHTML(qCount, 2, qData ? qData.options[2] : '', qData ? qData.correct === 2 : false)}
        </div>
    `;

    // Өчүрүү баскычына Event Listener туташтыруу
    const removeBtn = qDiv.querySelector('.btn-remove-q');
    removeBtn.addEventListener('click', () => {
        if (container.children.length <= 1) {
            alert('Тестте кеминде 1 суроо болушу керек!');
            return;
        }
        qDiv.remove();
        reindexQuestions();
    });

    container.appendChild(qDiv);
}

// Варианттардын HTML форматы
function generateOptionHTML(qIndex, optIndex, val = '', isCorrect = false) {
    return `
        <div class="opt-item">
            <input type="radio" name="correct_${qIndex}" value="${optIndex}" ${isCorrect ? 'checked' : ''} required>
            <input type="text" class="opt-text" placeholder="Вариант ${optIndex + 1}" value="${val}" required>
        </div>
    `;
}

// Өчүрүлгөндөн кийин суроолордун катар сандарын кайра тартипке келтирүү
function reindexQuestions() {
    const qBoxes = document.querySelectorAll('.q-box');
    qBoxes.forEach((box, index) => {
        const qNum = index + 1;
        box.querySelector('.q-number').innerText = `Суроо #${qNum}`;
        const radios = box.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.name = `correct_${qNum}`;
        });
    });
}

// Эски тесттин маалыматтарын формага жүктөө
async function loadTestForEdit(testId) {
    try {
        const testRef = ref(db, `tests/${testId}`);
        const snapshot = await get(testRef);

        if (!snapshot.exists()) {
            alert('Мындай тест табылган жок!');
            window.location.href = '/sections/tests.html';
            return;
        }

        const testData = snapshot.val();

        // Автордук укукту текшерүү (башка мугалим оңдой албашы керек)
        if (testData.ownerUid !== currentUser.uid) {
            alert('Сизде бул тестти оңдоого уруксат жок!');
            window.location.href = '/sections/tests.html';
            return;
        }

        // Форма талааларын толтуруу
        document.getElementById('testTitle').value = testData.title || '';
        document.getElementById('testSubject').value = testData.subject || '';
        document.getElementById('testGrade').value = testData.grade || '';
        document.getElementById('testTopic').value = testData.topic || '';
        document.getElementById('testDuration').value = testData.duration || 15;

        // Суроолорду жүктөө
        const container = document.getElementById('questionsContainer');
        container.innerHTML = ''; // Тазалоо

        if (testData.questions) {
            const questionsArray = Object.values(testData.questions);
            questionsArray.forEach(qData => {
                addQuestion(qData);
            });
        } else {
            addQuestion();
        }

    } catch (error) {
        console.error('Тестти жүктөөдө ката чыкты:', error);
        alert('Маалыматтарды жүктөөдө ката болду!');
    }
}

// "Суроо кошуу" баскычы
document.getElementById('addQuestionBtn').addEventListener('click', () => addQuestion());

// Форманы сактоо логикасы
document.getElementById('builderForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        alert('Авторизациядан өтүңүз!');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Сакталууда...`;

    try {
        const qBoxes = document.querySelectorAll('.q-box');
        if (qBoxes.length === 0) {
            alert('Кеминде 1 суроо киргизиңиз!');
            submitBtn.disabled = false;
            return;
        }

        const questions = {};

        qBoxes.forEach((box, idx) => {
            const qText = box.querySelector('.q-text').value.trim();
            const optInputs = box.querySelectorAll('.opt-text');
            const selectedRadio = box.querySelector(`input[type="radio"]:checked`);

            if (!selectedRadio) {
                throw new Error(`${idx + 1}-суроонун туура жообу белгиленген жок!`);
            }

            const correctIdx = parseInt(selectedRadio.value);
            const options = [];

            optInputs.forEach(opt => options.push(opt.value.trim()));

            questions[`q_${idx}`] = {
                text: qText,
                options: options,
                correct: correctIdx
            };
        });

        const testPayload = {
            ownerUid: currentUser.uid,
            title: document.getElementById('testTitle').value.trim(),
            subject: document.getElementById('testSubject').value.trim(),
            grade: document.getElementById('testGrade').value.trim(),
            topic: document.getElementById('testTopic').value.trim(),
            duration: parseInt(document.getElementById('testDuration').value),
            published: true, // По умолчанию жарыяланган
            updatedAt: Date.now(),
            questions: questions
        };

        if (editTestId) {
            // Мурда бар тестти жаңыртуу (Update)
            const testRef = ref(db, `tests/${editTestId}`);
            await set(testRef, testPayload);
            alert('Тест ийгиликтүү жаңыланды! 🚀');
        } else {
            // Жаңы тест сактоо (Create)
            testPayload.createdAt = Date.now();
            const newTestRef = push(ref(db, 'tests'));
            await set(newTestRef, testPayload);
            alert('Жаңы тест ийгиликтүү түзүлдү! 🚀');
        }

        window.location.href = '/sections/tests.html';

    } catch (error) {
        console.error('Тестти сактоодо ката:', error);
        alert(`Ката болду: ${error.message}`);
        submitBtn.disabled = false;
        submitBtn.innerHTML = editTestId ? `<i class="fa-solid fa-floppy-disk"></i> Өзгөртүүлөрдү сактоо 💾` : `<i class="fa-solid fa-paper-plane"></i> Сактоо жана Жарыялоо 🚀`;
    }
});
