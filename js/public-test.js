import { db } from '../firebase/firebase-config.js';
import { ref, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let testData = null;
let currentQIndex = 0;
let userAnswers = {};
let timerInterval = null;

const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get('testId');

document.addEventListener('DOMContentLoaded', async () => {
    if (!testId) {
        document.getElementById('lblTitle').innerText = "Тест ID табылган жок!";
        return;
    }

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `tests/${testId}`));

        if (snapshot.exists()) {
            testData = snapshot.val();
            document.getElementById('lblTitle').innerText = testData.title;
            document.getElementById('lblMeta').innerText = `${testData.subject} | ${testData.grade}-класс | Убакыт: ${testData.duration} мүнөт`;
            document.getElementById('startBtn').disabled = false;
        } else {
            document.getElementById('lblTitle').innerText = "Тест табылган жок!";
        }
    } catch (err) {
        console.error(err);
        document.getElementById('lblTitle').innerText = "Ката чыкты!";
    }

    document.getElementById('startBtn').addEventListener('click', startTest);
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
});

function startTest() {
    const name = document.getElementById('studentName').value.trim();
    const cls = document.getElementById('studentClass').value.trim();

    if (!name || !cls) {
        alert("Аты-жөнүңүздү жана классыңызды жазыңыз!");
        return;
    }

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('runningScreen').style.display = 'block';

    startTimer(testData.duration * 60);
    renderQuestion();
}

function renderQuestion() {
    const q = testData.questions[currentQIndex];
    document.getElementById('progress').innerText = `Суроо ${currentQIndex + 1} / ${testData.questions.length}`;

    // PISA контекстин көрсөтүү
    const pisaBox = document.getElementById('pisaBox');
    if (q.type === 'pisa' && q.context) {
        pisaBox.innerHTML = `<strong>Контекст:</strong><br>${q.context}`;
        pisaBox.style.display = 'block';
    } else {
        pisaBox.style.display = 'none';
    }

    document.getElementById('qText').innerHTML = q.text;

    // Сүрөттү көрсөтүү
    const imgContainer = document.getElementById('imgContainer');
    if (q.imageUrl) {
        imgContainer.innerHTML = `<img src="${q.imageUrl}" class="test-image">`;
    } else {
        imgContainer.innerHTML = '';
    }

    // Варианттарды рендерлөө
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    if (q.type === 'matching') {
        // Дал келтирүү форматы
        const rightOptions = [...q.options.map(o => o.right)].sort(() => Math.random() - 0.5);
        
        q.options.forEach((pair, idx) => {
            const row = document.createElement('div');
            row.className = 'matching-row';
            row.innerHTML = `
                <div>${pair.left}</div>
                <select data-idx="${idx}">
                    <option value="">-- Тандаңыз --</option>
                    ${rightOptions.map(r => `<option value="${r}">${r}</option>`).join('')}
                </select>
            `;
            optionsContainer.appendChild(row);
        });
    } else {
        // Бир же көп туура варианттуу
        const isMultiple = q.type === 'multiple';
        const inputType = isMultiple ? 'checkbox' : 'radio';

        q.options.forEach((opt, idx) => {
            const optText = typeof opt === 'object' ? opt.text : opt;
            const label = document.createElement('label');
            label.className = 'q-option';
            label.innerHTML = `
                <input type="${inputType}" name="q_opt" value="${idx}">
                <span>${optText}</span>
            `;
            optionsContainer.appendChild(label);
        });
    }

    // MathJax формулаларын рендерлөө
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}

function nextQuestion() {
    saveAnswer();

    currentQIndex++;
    if (currentQIndex < testData.questions.length) {
        renderQuestion();
        if (currentQIndex === testData.questions.length - 1) {
            document.getElementById('nextBtn').innerText = "Тестти аяктоо 🏁";
        }
    } else {
        finishTest();
    }
}

function saveAnswer() {
    const q = testData.questions[currentQIndex];

    if (q.type === 'matching') {
        const selects = document.querySelectorAll('#optionsContainer select');
        const ans = {};
        selects.forEach(s => {
            ans[s.getAttribute('data-idx')] = s.value;
        });
        userAnswers[currentQIndex] = ans;
    } else {
        const selected = document.querySelectorAll('input[name="q_opt"]:checked');
        userAnswers[currentQIndex] = Array.from(selected).map(i => parseInt(i.value));
    }
}

function startTimer(seconds) {
    let timer = seconds;
    const timerEl = document.getElementById('timer');

    timerInterval = setInterval(() => {
        const m = Math.floor(timer / 60);
        const s = timer % 60;
        timerEl.innerHTML = `<i class="fa-solid fa-clock"></i> ${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;

        if (--timer < 0) {
            clearInterval(timerInterval);
            alert("Убакыт бүттү!");
            finishTest();
        }
    }, 1000);
}

function finishTest() {
    clearInterval(timerInterval);
    
    let score = 0;
    testData.questions.forEach((q, idx) => {
        const userAns = userAnswers[idx];
        if (!userAns) return;

        if (q.type === 'matching') {
            let correctCount = 0;
            q.options.forEach((pair, pIdx) => {
                if (userAns[pIdx] === pair.right) correctCount++;
            });
            if (correctCount === q.options.length) score++;
        } else {
            const correctIndices = q.options
                .map((o, i) => (typeof o === 'object' && o.isCorrect) ? i : null)
                .filter(i => i !== null);

            if (JSON.stringify(correctIndices.sort()) === JSON.stringify(userAns.sort())) {
                score++;
            }
        }
    });

    const percent = Math.round((score / testData.questions.length) * 100);
    
    document.getElementById('runningScreen').innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <h2 style="color:#00f0ff; margin-bottom:15px;">🎉 Тест Аяктады!</h2>
            <p style="font-size:1.2rem; margin-bottom:10px;">Сиздин жыйынтык: <strong>${score} / ${testData.questions.length}</strong> (${percent}%)</p>
            <a href="tests-center.html" class="btn-start" style="text-decoration:none; display:inline-block; width:auto; padding:10px 25px;">Башкы баракчага кайтуу</a>
        </div>
    `;
}
