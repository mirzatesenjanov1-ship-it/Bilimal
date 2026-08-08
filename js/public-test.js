import { db } from '/firebase/firebase-config.js';
import { ref, get, push, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentTest = null;
let testId = null;
let questionsList = [];
let currentIndex = 0;
let userAnswers = {};
let timerInterval = null;
let timeLeftSeconds = 0;

// URL'ден testId алуу
const urlParams = new URLSearchParams(window.location.search);
testId = urlParams.get('testId');

document.addEventListener('DOMContentLoaded', async () => {
    if (!testId) {
        showError("Тесттин IDси көрсөтүлгөн жок! Туура шилтеме аркылуу кириңиз.");
        return;
    }

    await loadTest(testId);
});

// Тестти жүктөө
async function loadTest(id) {
    try {
        const testRef = ref(db, `tests/${id}`);
        const snapshot = await get(testRef);

        if (!snapshot.exists()) {
            showError("Мындай тест табылган жок же өчүрүлгөн!");
            return;
        }

        currentTest = snapshot.val();

        if (currentTest.published === false) {
            showError("Бул тест азырынча мугалим тарабынан жабык.");
            return;
        }

        questionsList = Object.values(currentTest.questions || {});

        if (questionsList.length === 0) {
            showError("Бул тестте азырынча суроолор жок!");
            return;
        }

        // Инфону көрсөтүү
        document.getElementById('lblTitle').innerText = currentTest.title || "Онлайн Тест";
        document.getElementById('lblMeta').innerText = `Предмет: ${currentTest.subject || '-'} | Класс: ${currentTest.grade || '-'} | Суроолор: ${questionsList.length} | Убактысы: ${currentTest.duration || 15} мүнөт`;
        
        const startBtn = document.getElementById('startBtn');
        startBtn.disabled = false;
        startBtn.addEventListener('click', startTest);

    } catch (error) {
        console.error("Тестти жүктөөдө ката:", error);
        showError("Интернет байланышын текшериңиз.");
    }
}

// Ката чыкканда UX жакшыртуу: Тест Борборуна багыттоо
function showError(msg) {
    const lblTitle = document.getElementById('lblTitle');
    const lblMeta = document.getElementById('lblMeta');
    const startBtn = document.getElementById('startBtn');

    if (lblTitle) {
        lblTitle.innerText = "Каталык!";
        lblTitle.style.color = "#ff0055";
    }
    if (lblMeta) {
        lblMeta.innerText = msg;
    }
    
    if (startBtn) {
        startBtn.style.display = 'block';
        startBtn.disabled = false;
        startBtn.innerText = "🎓 Тест Борборуна өтүү";
        startBtn.onclick = () => {
            window.location.href = '/tests-center.html';
        };
    }
}

// Тестти баштоо
function startTest() {
    const sName = document.getElementById('studentName').value.trim();
    const sClass = document.getElementById('studentClass').value.trim();

    if (!sName || !sClass) {
        alert("Сураныч, аты-жөнүңүздү жана классыңызды толтуруңуз!");
        return;
    }

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('runningScreen').style.display = 'block';

    // Таймерди иштетүү
    timeLeftSeconds = (currentTest.duration || 15) * 60;
    startTimer();

    // Биринчи суроону көрсөтүү
    renderQuestion();
}

// Таймер
function startTimer() {
    updateTimerUI();
    timerInterval = setInterval(() => {
        timeLeftSeconds--;
        updateTimerUI();

        if (timeLeftSeconds <= 0) {
            clearInterval(timerInterval);
            alert("Бөлүнгөн убакыт бүттү! Жыйынтыктар автоматтык эсептелип сакталууда.");
            finishTest();
        }
    }, 1000);
}

function updateTimerUI() {
    const m = Math.floor(timeLeftSeconds / 60);
    const s = timeLeftSeconds % 60;
    const timerElem = document.getElementById('timer');
    if (timerElem) {
        timerElem.innerText = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
}

// Суроону экранга чыгаруу
function renderQuestion() {
    const q = questionsList[currentIndex];
    document.getElementById('progress').innerText = `Суроо ${currentIndex + 1} / ${questionsList.length}`;
    document.getElementById('qText').innerText = q.text;

    const optContainer = document.getElementById('optionsContainer');
    optContainer.innerHTML = '';

    q.options.forEach((optText, optIdx) => {
        const div = document.createElement('div');
        div.className = `q-option ${userAnswers[currentIndex] === optIdx ? 'selected' : ''}`;
        div.innerHTML = `<i class="fa-regular ${userAnswers[currentIndex] === optIdx ? 'fa-circle-dot' : 'fa-circle'}"></i> ${escapeHtml(optText)}`;
        
        div.addEventListener('click', () => {
            userAnswers[currentIndex] = optIdx;
            renderQuestion(); // Элемент тандалганда кайра тартуу
        });

        optContainer.appendChild(div);
    });

    const nextBtn = document.getElementById('nextBtn');
    if (currentIndex === questionsList.length - 1) {
        nextBtn.innerText = "Тестти аяктоо 🏁";
        nextBtn.onclick = finishTest;
    } else {
        nextBtn.innerText = "Кийинки суроо →";
        nextBtn.onclick = () => {
            if (userAnswers[currentIndex] === undefined) {
                if (!confirm("Суроого жооп тандаган жоксуз! Ишенимдүүсүзбү?")) return;
            }
            currentIndex++;
            renderQuestion();
        };
    }
}

// Жыйынтыктоо жана Firebase'ге сактоо
async function finishTest() {
    clearInterval(timerInterval);

    const nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = true;
    nextBtn.innerText = "Жыйынтык сакталууда...";

    let score = 0;
    questionsList.forEach((q, idx) => {
        if (userAnswers[idx] !== undefined && userAnswers[idx] === q.correct) {
            score++;
        }
    });

    const percentage = Math.round((score / questionsList.length) * 100);
    const sName = document.getElementById('studentName').value.trim();
    const sClass = document.getElementById('studentClass').value.trim();

    try {
        const resultsRef = ref(db, `results/${testId}`);
        const newResultRef = push(resultsRef);
        
        const resultPayload = {
            studentName: sName,
            studentClass: sClass,
            score: score,
            totalQuestions: questionsList.length,
            percentage: percentage,
            completedAt: Date.now()
        };

        await set(newResultRef, resultPayload);

        // Жыйынтык баракчасына артка кайталбагыдай багыттоо (replace)
        const resultUrl = `/test-result.html?testId=${testId}&score=${score}&total=${questionsList.length}&perc=${percentage}&name=${encodeURIComponent(sName)}`;
        window.location.replace(resultUrl);

    } catch (error) {
        console.error("Жыйынтыкты сактоодо ката:", error);
        alert("Жыйынтыкты сактоодо ката болду, бирок жыйынтыгыңыз эсептелди.");
    }
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
