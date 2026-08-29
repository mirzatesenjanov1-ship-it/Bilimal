import { db } from '../firebase/firebase-config.js';
import { ref, get, child, push } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let testData = null;
let currentQIndex = 0;
let userAnswers = {};
let timerInterval = null;

// Анти-чит өзгөрмөлөрү
let warningCount = 0;
const MAX_WARNINGS = 3; // Лимит катары 3 эскертүү (кааласаңыз сан өзгөртсөңүз болот)
let isTestFinished = false;

const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get('testId') || urlParams.get('id');

document.addEventListener('DOMContentLoaded', async () => {
    enableStrictProtection();

    if (!testId) {
        document.getElementById('lblTitle').innerText = "Тест ID табылган жок!";
        return;
    }

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `tests/${testId}`));

        if (snapshot.exists()) {
            testData = snapshot.val();
            document.getElementById('lblTitle').innerText = testData.title || 'Тест';
            
            const maxAtt = testData.maxAttempts !== undefined ? testData.maxAttempts : 0;
            const attText = maxAtt === 0 ? "Чексиз" : `${maxAtt} жолу`;

            document.getElementById('lblMeta').innerText = `${testData.subject || ''} | ${testData.grade || ''}-класс | Убакыт: ${testData.duration || 15} мүнөт | Тапшыруу чеги: ${attText}`;
            document.getElementById('startBtn').disabled = false;
        } else {
            document.getElementById('lblTitle').innerText = "Тест табылган жок!";
        }
    } catch (err) {
        console.error("Тестти жүктөөдө ката:", err);
        document.getElementById('lblTitle').innerText = "Тестти жүктөөдө ката чыкты!";
    }

    document.getElementById('startBtn').addEventListener('click', startTest);
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
});

async function startTest() {
    const nameInput = document.getElementById('studentName');
    const classInput = document.getElementById('studentClass');

    const name = nameInput ? nameInput.value.trim() : '';
    const cls = classInput ? classInput.value.trim() : '';

    if (!name || !cls) {
        alert("Аты-жөнүңүздү жана классыңызды жазыңыз!");
        return;
    }

    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true;
    startBtn.innerText = "Текшерилүүдө...";

    // 1. АРАКЕТТЕР САНЫН ТЕКШЕРҮҮ (maxAttempts)
    const maxAttempts = testData.maxAttempts !== undefined ? parseInt(testData.maxAttempts) : 0;

    if (maxAttempts > 0) {
        const studentAttempts = await getStudentAttemptsCount(testId, name);
        const localKey = `bilimal_att_${testId}_${cleanName(name)}`;
        const localAttempts = parseInt(localStorage.getItem(localKey) || "0");

        const realAttempts = Math.max(studentAttempts, localAttempts);

        if (realAttempts >= maxAttempts) {
            alert(`⚠️ Кечириңиз, ${name}!\nБул тестти мугалим ${maxAttempts} жолу гана тапшырууга уруксат берген.\nСиз бул тестти буга чейин тапшыргансыз!`);
            startBtn.disabled = false;
            startBtn.innerText = "Баштоо";
            return;
        }
    }

    startBtn.disabled = false;
    startBtn.innerText = "Баштоо";

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('runningScreen').style.display = 'block';

    activateTabSwitchProtection();
    startTimer((testData.duration || 15) * 60);
    renderQuestion();
}

async function getStudentAttemptsCount(targetTestId, studentName) {
    let count = 0;
    try {
        const dbRef = ref(db);
        const snap = await get(child(dbRef, `test_results/${targetTestId}`));
        if (snap.exists()) {
            const results = snap.val();
            const cleanedInputName = cleanName(studentName);

            Object.values(results).forEach(r => {
                if (r.studentName && cleanName(r.studentName) === cleanedInputName) {
                    count++;
                }
            });
        }
    } catch (e) {
        console.warn("Аракеттер санын алууда эскертүү:", e.message);
    }
    return count;
}

function cleanName(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

function renderQuestion() {
    if (!testData || !testData.questions || !testData.questions[currentQIndex]) return;

    const q = testData.questions[currentQIndex];
    document.getElementById('progress').innerText = `Суроо ${currentQIndex + 1} / ${testData.questions.length}`;

    const pisaBox = document.getElementById('pisaBox');
    if (q.type === 'pisa' && q.context) {
        pisaBox.innerHTML = `<strong>Контекст:</strong><br>${q.context}`;
        pisaBox.style.display = 'block';
    } else {
        pisaBox.style.display = 'none';
    }

    document.getElementById('qText').innerHTML = q.text || '';

    const imgContainer = document.getElementById('imgContainer');
    if (q.imageUrl) {
        imgContainer.innerHTML = `<img src="${q.imageUrl}" class="test-image" ondragstart="return false;">`;
    } else {
        imgContainer.innerHTML = '';
    }

    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    if (q.type === 'matching' && Array.isArray(q.options)) {
        const rightOptions = [...q.options.map(o => typeof o === 'object' ? o.right : o)].sort(() => Math.random() - 0.5);
        
        q.options.forEach((pair, idx) => {
            const leftText = typeof pair === 'object' ? pair.left : pair;
            const row = document.createElement('div');
            row.className = 'matching-row';
            row.innerHTML = `
                <div>${leftText}</div>
                <select data-idx="${idx}">
                    <option value="">-- Тандаңыз --</option>
                    ${rightOptions.map(r => `<option value="${r}">${r}</option>`).join('')}
                </select>
            `;
            optionsContainer.appendChild(row);
        });
    } else if (Array.isArray(q.options)) {
        const isMultiple = q.type === 'multiple';
        const inputType = isMultiple ? 'checkbox' : 'radio';

        q.options.forEach((opt, idx) => {
            const optText = (typeof opt === 'object' && opt !== null) ? (opt.text || opt.label || '') : opt;
            const label = document.createElement('label');
            label.className = 'q-option';
            label.innerHTML = `
                <input type="${inputType}" name="q_opt" value="${idx}">
                <span>${optText}</span>
            `;
            optionsContainer.appendChild(label);
        });
    }

    if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
        MathJax.typesetPromise().catch(err => console.log('MathJax error:', err));
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
        finishTest('normal');
    }
}

function saveAnswer() {
    if (!testData || !testData.questions || !testData.questions[currentQIndex]) return;
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
        if (timerEl) {
            timerEl.innerHTML = `<i class="fa-solid fa-clock"></i> ${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }

        if (--timer < 0) {
            clearInterval(timerInterval);
            alert("Убакыт бүттү!");
            finishTest('timeout');
        }
    }, 1000);
}

async function finishTest(reason = 'normal') {
    if (isTestFinished) return;
    isTestFinished = true;

    // Overlay болсо аны алып салуу
    const overlay = document.getElementById('ai-protection-overlay');
    if (overlay) overlay.style.display = 'none';

    if (timerInterval) clearInterval(timerInterval);
    saveAnswer();

    let score = 0;
    const totalQ = (testData && testData.questions) ? testData.questions.length : 0;

    if (totalQ > 0) {
        testData.questions.forEach((q, idx) => {
            const userAns = userAnswers[idx];
            if (!userAns) return;

            if (q.type === 'matching') {
                let correctCount = 0;
                if (Array.isArray(q.options)) {
                    q.options.forEach((pair, pIdx) => {
                        const targetRight = typeof pair === 'object' ? pair.right : pair;
                        if (userAns[pIdx] === targetRight) correctCount++;
                    });
                    if (correctCount === q.options.length) score++;
                }
            } else if (Array.isArray(q.options)) {
                const correctIndices = [];
                q.options.forEach((o, i) => {
                    if (typeof o === 'object' && o !== null) {
                        if (o.isCorrect === true || o.correct === true) correctIndices.push(i);
                    } else if (q.correctAnswer !== undefined) {
                        if (q.correctAnswer === i || (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(i))) {
                            correctIndices.push(i);
                        }
                    }
                });

                if (Array.isArray(userAns) && JSON.stringify(correctIndices.sort()) === JSON.stringify(userAns.sort())) {
                    score++;
                }
            }
        });
    }

    const percent = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
    const nameInput = document.getElementById('studentName');
    const classInput = document.getElementById('studentClass');
    const name = nameInput ? nameInput.value.trim() : 'Аноним';
    const cls = classInput ? classInput.value.trim() : '-';

    // БАЗАГА САКТОО ЖАНА LOCALSTORAGE ЖАҢЫРТУУ
    try {
        const payload = {
            testId: testId,
            studentName: name,
            studentClass: cls,
            score: score,
            totalQuestions: totalQ,
            percent: percent,
            cheatedCount: warningCount,
            cheatingAttempt: reason === 'cheating',
            date: new Date().toISOString()
        };

        const resultsRef = ref(db, `test_results/${testId}`);
        await push(resultsRef, payload);

        const localKey = `bilimal_att_${testId}_${cleanName(name)}`;
        const prevLocal = parseInt(localStorage.getItem(localKey) || "0");
        localStorage.setItem(localKey, (prevLocal + 1).toString());

    } catch (e) {
        console.error("Жыйынтыкты Firebase'ке сактоодо ката чыкты:", e);
    }

    let statusHtml = '';
    if (reason === 'cheating') {
        statusHtml = `<p style="color:#ff0055; font-weight:bold; font-size:1.1rem; margin-bottom:10px;">⚠️ Тест эреже бузулгандыктан автоматтык түрдө токтотулду!</p>`;
    } else if (reason === 'timeout') {
        statusHtml = `<p style="color:#ff9900; font-weight:bold; font-size:1.1rem; margin-bottom:10px;">⏳ Тесттин убактысы бүттү!</p>`;
    }

    const runningScreen = document.getElementById('runningScreen');
    if (runningScreen) {
        runningScreen.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h2 style="color:#00f0ff; margin-bottom:15px;">🎉 Тест Аяктады!</h2>
                ${statusHtml}
                <p style="font-size:1.2rem; margin-bottom:10px;">Сиздин жыйынтык: <strong>${score} / ${totalQ}</strong> (${percent}%)</p>
                <p style="color:#a5b4fc; font-size:0.9rem; margin-bottom: 20px;">Башка баракчага чыгуу аракети: <strong>${warningCount} жолу</strong></p>
                
                <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                    <h3 style="color: #38bdf8; margin-bottom: 10px; font-size: 1.1rem;"><i class="fa-solid fa-book-open"></i> Билимиңизди андан ары тереңдетиңиз!</h3>
                    <p style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 15px; line-height: 1.5;">
                        Тестти ийгиликтүү аяктадыңыз! Каалаган темаңыз боюнча билимиңизди улантуу жана кошумча адабияттарды окуу үчүн Биздин Электрондук Китепканага өтүңүз.
                    </p>
                    <a href="/sections/ebooks1.html" class="btn-start" style="text-decoration:none; display:inline-block; width:auto; padding:12px 25px; background: linear-gradient(135deg, #00f0ff, #7000ff); color: #fff; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,240,255,0.3);">
                        <i class="fa-solid fa-graduation-cap"></i> Электрондук китепканага өтүү
                    </a>
                </div>

                <a href="tests-center.html" style="text-decoration:none; display:inline-block; color: #a5b4fc; font-size: 0.9rem; margin-top:10px;">Башкы баракчага кайтуу</a>
            </div>
        `;
    }
}

function enableStrictProtection() {
    const events = ['contextmenu', 'selectstart', 'copy', 'cut', 'paste', 'dragstart'];
    events.forEach(event => {
        document.addEventListener(event, (e) => e.preventDefault());
    });

    document.addEventListener('keydown', (e) => {
        if (
            e.keyCode === 123 ||
            (e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
            (e.ctrlKey && e.shiftKey && e.keyCode === 74) ||
            (e.ctrlKey && e.keyCode === 85) ||
            (e.ctrlKey && e.keyCode === 67) ||
            (e.ctrlKey && e.keyCode === 86) ||
            (e.ctrlKey && e.keyCode === 65)
        ) {
            e.preventDefault();
            return false;
        }
    });

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
}

// АНТИ-ЧИТ / ЭКРАНДАН ЧЫГУУ ЖАНА BLUR КОРГООСУ
function activateTabSwitchProtection() {
    const triggerViolation = () => {
        if (isTestFinished) return;

        warningCount++;

        let overlay = document.getElementById('ai-protection-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ai-protection-overlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#03030d; z-index:999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00f0ff; font-size:1.3rem; font-weight:bold; text-align:center; padding:20px; box-sizing:border-box;';
            
            overlay.addEventListener('click', function() {
                if (warningCount < MAX_WARNINGS && !isTestFinished) {
                    overlay.style.display = 'none';
                }
            });

            document.body.appendChild(overlay);
        }

        if (warningCount >= MAX_WARNINGS) {
            overlay.innerHTML = `
                <i class="fa-solid fa-ban" style="font-size:3.5rem; color:#ff0055; margin-bottom:15px;"></i>
                <div style="color:#ff0055; font-size:1.6rem; margin-bottom:10px;">ТЕСТ БӨГӨТТӨЛДҮ!</div>
                <div>Сиз башка терезеге өтүү эрежесин өтө көп буздуңуз (${warningCount}/${MAX_WARNINGS}).</div>
                <div style="font-size:1rem; color:#a5b4fc; margin-top:15px;">Тестти улантууга уруксат берилбейт. Жйынтыгыңыз мугалимге жөнөтүлдү.</div>
            `;
            overlay.style.display = 'flex';
            finishTest('cheating');
        } else {
            overlay.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation" style="font-size:3.5rem; color:#ffcc00; margin-bottom:15px;"></i>
                <div style="font-size:1.5rem; margin-bottom:10px;">ЭСКЕРТҮҮ: Башка терезеге же AI куралына өтүүгө болбойт!</div>
                <div style="background:rgba(255,0,85,0.2); border:1px solid #ff0055; color:#ff0055; padding:8px 16px; border-radius:20px; margin:15px 0; font-size:1.1rem;">
                    ⚠️ Тесттен чыгуу эрежесин бузуу: <span style="font-size:1.4rem; font-weight:bold; color:#fff;">${warningCount}</span> / ${MAX_WARNINGS}
                </div>
                <div style="font-size:1rem; color:#a5b4fc; margin-top:10px; cursor:pointer;">Тестке кайтуу үчүн ушул экранды чыкылдатыңыз.</div>
            `;
            overlay.style.display = 'flex';
        }
    };

    // 1. Вкладканы алмаштырганда (Visibilitychange)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            triggerViolation();
        }
    });

    // 2. Edge Copilot / Башка колдонмого өткөндө (Blur)
    window.addEventListener('blur', () => {
        triggerViolation();
    });
}
