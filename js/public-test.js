// js/public-test.js - Толук иштеген жана катасыз код

import { db } from '../firebase/firebase-config.js';
import { ref, get, child, push } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let testData = null;
let currentQIndex = 0;
let userAnswers = {};
let questionTimes = {};
let questionStartTime = Date.now();
let timerInterval = null;

let warningCount = 0;
const MAX_WARNINGS = 3;
let isTestFinished = false;
let isViolationActive = false;
let visibilityHandler = null;
let blurHandler = null;

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

function prepareMathText(text) {
    if (!text) return '';
    let str = String(text);
    
    if ((str.includes('\\text') || str.includes('\\frac') || str.includes('^')) && !str.includes('$')) {
        return `$${str}$`;
    }
    return str;
}

function renderQuestion() {
    if (!testData || !testData.questions || !testData.questions[currentQIndex]) return;

    questionStartTime = Date.now();

    const q = testData.questions[currentQIndex];
    document.getElementById('progress').innerText = `Суроо ${currentQIndex + 1} / ${testData.questions.length}`;

    const pisaBox = document.getElementById('pisaBox');
    if (q.type === 'pisa' && q.context) {
        pisaBox.innerHTML = `<strong>Контекст:</strong><br>${prepareMathText(q.context)}`;
        pisaBox.style.display = 'block';
    } else {
        pisaBox.style.display = 'none';
    }

    document.getElementById('qText').innerHTML = prepareMathText(q.text || '');

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
                <div>${prepareMathText(leftText)}</div>
                <select data-idx="${idx}">
                    <option value="">-- Тандаңыз --</option>
                    ${rightOptions.map(r => `<option value="${r}">${prepareMathText(r)}</option>`).join('')}
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
                <span>${prepareMathText(optText)}</span>
            `;
            optionsContainer.appendChild(label);
        });
    }

    if (window.MathJax) {
        if (typeof MathJax.typesetClear === 'function') {
            MathJax.typesetClear();
        }
        if (typeof MathJax.typesetPromise === 'function') {
            MathJax.typesetPromise([
                document.getElementById('qText'),
                document.getElementById('optionsContainer'),
                document.getElementById('pisaBox')
            ]).catch(err => console.error('MathJax катасы:', err));
        }
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

    const timeSpentSeconds = Math.round((Date.now() - questionStartTime) / 1000);
    questionTimes[currentQIndex] = timeSpentSeconds;

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

function stopAntiCheat() {
    isTestFinished = true;
    isViolationActive = false;

    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
    }
    if (blurHandler) {
        window.removeEventListener('blur', blurHandler);
    }

    const overlay = document.getElementById('ai-protection-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.remove();
    }
}

async function finishTest(reason = 'normal') {
    if (isTestFinished && reason !== 'cheating') return;
    
    stopAntiCheat();

    if (timerInterval) clearInterval(timerInterval);
    saveAnswer();

    let score = 0;
    const totalQ = (testData && testData.questions) ? testData.questions.length : 0;
    const reviewList = [];

    if (totalQ > 0) {
        testData.questions.forEach((q, idx) => {
            const userAns = userAnswers[idx];
            const options = q.options || [];
            let isCorrect = false;
            let correctDesc = "";
            let userDesc = "Жооп берилген жок";

            if (q.type === 'matching') {
                let correctCount = 0;
                let userAnsObj = userAns || {};
                let correctPairsStr = [];
                let userPairsStr = [];

                if (Array.isArray(options)) {
                    options.forEach((pair, pIdx) => {
                        const leftText = typeof pair === 'object' ? pair.left : pair;
                        const targetRight = typeof pair === 'object' ? pair.right : pair;
                        correctPairsStr.push(`${leftText} ➔ ${targetRight}`);
                        userPairsStr.push(`${leftText} ➔ ${userAnsObj[pIdx] || 'Жок'}`);

                        if (userAnsObj[pIdx] === targetRight) correctCount++;
                    });
                }
                isCorrect = (correctCount === options.length);
                correctDesc = correctPairsStr.join('; ');
                userDesc = userPairsStr.join('; ');
            } else if (Array.isArray(options)) {
                const correctIndices = [];
                options.forEach((o, i) => {
                    if (typeof o === 'object' && o !== null) {
                        if (o.isCorrect === true || o.correct === true) correctIndices.push(i);
                    } else if (q.correctAnswer !== undefined) {
                        if (q.correctAnswer === i || (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(i))) {
                            correctIndices.push(i);
                        }
                    }
                });

                if (Array.isArray(userAns) && JSON.stringify(correctIndices.sort()) === JSON.stringify(userAns.sort())) {
                    isCorrect = true;
                }

                correctDesc = correctIndices.map(i => {
                    const opt = options[i];
                    return (typeof opt === 'object' && opt !== null) ? (opt.text || opt.label || '') : opt;
                }).join(', ');

                userDesc = Array.isArray(userAns) ? userAns.map(i => {
                    const opt = options[i];
                    return (typeof opt === 'object' && opt !== null) ? (opt.text || opt.label || '') : opt;
                }).join(', ') : "Жооп берилген жок";
            }

            if (isCorrect) score++;

            reviewList.push({
                questionText: q.text || '',
                studentAnswer: userDesc,
                correctAnswer: correctDesc,
                isCorrect: isCorrect,
                timeSpent: questionTimes[idx] || 0
            });
        });
    }

    const percent = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
    const nameInput = document.getElementById('studentName');
    const classInput = document.getElementById('studentClass');
    const name = nameInput ? nameInput.value.trim() : 'Аноним';
    const cls = classInput ? classInput.value.trim() : '-';

    const allowReview = testData.allowReview === true;

    if (allowReview) {
        localStorage.setItem('student_test_review', JSON.stringify(reviewList));
    } else {
        localStorage.removeItem('student_test_review');
    }

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
            date: new Date().toISOString(),
            reviewList: reviewList,
            userAnswers: userAnswers
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
            <div class="result-card">
                <div class="result-score-circle" style="--progress-deg: ${percent * 3.6}deg;">
                    <div class="result-score-inner">
                        <span class="result-score-value">${percent}%</span>
                        <span style="font-size:0.75rem; color:#94a3b8;">Ийгилик</span>
                    </div>
                </div>

                <h2 style="color:#00f0ff; margin-bottom:10px;">🎉 Тест Аяктады!</h2>
                ${statusHtml}
                <p style="font-size: 1.1rem; color: #e2e8f0; margin-bottom: 10px;">
                    Сиздин жыйынтык: <strong>${score} / ${totalQ} (${percent}%)</strong>
                </p>
                <p style="color:#a5b4fc; font-size:0.9rem; margin-bottom: 15px;">Башка баракчага чыгуу аракети: <strong>${warningCount} жолу</strong></p>
                
                ${allowReview ? `
                    <div style="background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 16px; margin: 15px 0; text-align: center;">
                        <p style="color: #38bdf8; font-weight: 600; font-size: 0.95rem; margin-bottom: 12px;">
                            <i class="fa-solid fa-circle-info"></i> Мугалим каталарыңызды көрүүгө уруксат берди. Кетирген каталарыңызды жана туура жоопторду толук талдап чыгыңыз!
                        </p>
                        <button type="button" class="btn-start" onclick="window.location.href='test-review.html'" style="background: linear-gradient(135deg, #00c6ff 0%, #0072ff 100%); width: 100%; margin-top:5px;">
                            <i class="fa-solid fa-magnifying-glass-chart"></i> КАТАЛАРДЫ ЖАНА ТУУРА ЖООПТОРДУ КӨРҮҮ ➔
                        </button>
                    </div>
                ` : `
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 14px; margin: 15px 0; text-align: center;">
                        <p style="color: #fca5a5; font-size: 0.9rem;">
                            <i class="fa-solid fa-lock"></i> Каталарды көрүү бул тест үчүн мугалим тарабынан чектелген.
                        </p>
                    </div>
                `}

                <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 18px; margin: 15px 0; text-align: center;">
                    <h3 style="color: #38bdf8; margin-bottom: 8px; font-size: 1.05rem;"><i class="fa-solid fa-book-open"></i> Билимиңизди андан ары тереңдетиңиз!</h3>
                    <p style="color: #cbd5e1; font-size: 0.9rem; margin-bottom: 12px; line-height: 1.4;">
                        Тестти ийгиликтүү аяктадыңыз! Кошумча адабияттарды окуу үчүн Электрондук Китепканага өтүңүз.
                    </p>
                    <a href="/sections/ebooks1.html" class="btn-start" style="text-decoration:none; display:inline-block; width:100%; padding:10px 20px; background: linear-gradient(135deg, #00f0ff, #7000ff); color: #fff; font-weight: bold; border-radius: 8px;">
                        <i class="fa-solid fa-graduation-cap"></i> Электрондук китепканага өтүү
                    </a>
                </div>

                <a href="tests-center.html" style="text-decoration:none; display:inline-block; color: #a5b4fc; font-size: 0.9rem; margin-top:5px;">Башкы баракчага кайтуу</a>
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

function activateTabSwitchProtection() {
    const triggerViolation = () => {
        if (isTestFinished || isViolationActive) return;

        isViolationActive = true;
        warningCount++;

        let overlay = document.getElementById('ai-protection-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ai-protection-overlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#03030d; z-index:999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00f0ff; font-size:1.3rem; font-weight:bold; text-align:center; padding:20px; box-sizing:border-box;';
            
            overlay.addEventListener('click', function() {
                if (warningCount < MAX_WARNINGS && !isTestFinished) {
                    overlay.style.display = 'none';
                    isViolationActive = false;
                }
            });

            document.body.appendChild(overlay);
        }

        if (warningCount >= MAX_WARNINGS) {
            overlay.innerHTML = `
                <i class="fa-solid fa-ban" style="font-size:3.5rem; color:#ff0055; margin-bottom:15px;"></i>
                <div style="color:#ff0055; font-size:1.6rem; margin-bottom:10px;">ТЕСТ БӨГӨТТӨЛДҮ!</div>
                <div>Сиз башка терезеге өтүү эрежесин өтө көп буздуңуз (${warningCount}/${MAX_WARNINGS}).</div>
                <div style="font-size:1rem; color:#a5b4fc; margin-top:15px;">Тестти улантууга уруксат берилбейт. Жыйынтыгыңыз мугалимге жөнөтүлдү.</div>
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

    visibilityHandler = () => {
        if (document.hidden) {
            triggerViolation();
        }
    };

    blurHandler = () => {
        triggerViolation();
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('blur', blurHandler);
}
