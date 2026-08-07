import { db } from '../firebase/firebase-config.js';
import { ref, get, push, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get('testId');

let testData = null;
let currentQIndex = 0;
let userAnswers = [];
let timerInterval = null;

if (!testId) {
    alert("Тест ID табылган жок!");
} else {
    loadTestInfo();
}

async function loadTestInfo() {
    const snapshot = await get(ref(db, `tests/${testId}`));
    if (!snapshot.exists() || !snapshot.val().published) {
        document.getElementById('lblTitle').innerText = "Тест табылган жок же жабылган.";
        return;
    }

    testData = snapshot.val();
    document.getElementById('lblTitle').innerText = testData.title;
    document.getElementById('lblMeta').innerText = `${testData.subject} • ${testData.grade}-класс • Убактысы: ${testData.duration} мүнөт`;
}

document.getElementById('startBtn').onclick = () => {
    const name = document.getElementById('studentName').value.trim();
    const sClass = document.getElementById('studentClass').value.trim();

    if (!name || !sClass) {
        alert("Атыңызды жана классыңызды жазыңыз!");
        return;
    }

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('runningScreen').style.display = 'block';

    startTimer(testData.duration * 60);
    renderQuestion();
};

function startTimer(seconds) {
    let left = seconds;
    const timerElem = document.getElementById('timer');

    timerInterval = setInterval(() => {
        left--;
        let m = Math.floor(left / 60);
        let s = left % 60;
        timerElem.innerText = `${m < 10 ? '0':''}${m}:${s < 10 ? '0':''}${s}`;

        if (left <= 0) {
            clearInterval(timerInterval);
            finishTest();
        }
    }, 1000);
}

function renderQuestion() {
    const qKeys = Object.keys(testData.questions);
    const qKey = qKeys[currentQIndex];
    const q = testData.questions[qKey];

    document.getElementById('progress').innerText = `Суроо ${currentQIndex + 1}/${qKeys.length}`;
    document.getElementById('qText').innerText = q.text;

    const optContainer = document.getElementById('optionsContainer');
    optContainer.innerHTML = '';

    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'q-option';
        div.innerText = opt;
        div.onclick = () => {
            document.querySelectorAll('.q-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            userAnswers[currentQIndex] = idx;
        };
        optContainer.appendChild(div);
    });
}

document.getElementById('nextBtn').onclick = () => {
    const qKeys = Object.keys(testData.questions);
    if (userAnswers[currentQIndex] === undefined) {
        alert("Жоопту тандаңыз!");
        return;
    }

    currentQIndex++;
    if (currentQIndex < qKeys.length) {
        renderQuestion();
    } else {
        finishTest();
    }
};

async function finishTest() {
    clearInterval(timerInterval);
    const qKeys = Object.keys(testData.questions);
    let score = 0;

    qKeys.forEach((key, idx) => {
        if (userAnswers[idx] === testData.questions[key].correct) {
            score++;
        }
    });

    const total = qKeys.length;
    const percentage = Math.round((score / total) * 100);

    const resultData = {
        teacherUid: testData.ownerUid,
        studentName: document.getElementById('studentName').value,
        studentClass: document.getElementById('studentClass').value,
        score: score,
        total: total,
        percentage: percentage,
        submittedAt: Date.now()
    };

    const newResRef = push(ref(db, `results/${testId}`));
    await set(newResRef, resultData);

    localStorage.setItem('lastResult', JSON.stringify(resultData));
    window.location.href = 'test-result.html';
}
