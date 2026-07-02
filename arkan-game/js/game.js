/**
 * /arkan-game/js/game.js
 * Мугалимдин тесттерин ат коюп сактоо (localStorage) жана каалаган убакта кайра жүктөө 
 * мүмкүнчүлүгү менен толукталган кош талаалуу оюн кыймылдаткычы.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.55;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Демейки базалык шаблондор (Мугалимде суроо жок болсо автоматтык түрдө 25 даана түзөт)
const testTopics = [
    { q: "Ньютондун 3-закону кандай айтылат?", a: "Аракет күчү каршы аракет күчүнө модулу боюнча барабар", w: ["Күч ылдамдыкка түз пропорциялуу", "Инерция дайыма сакталат", "Нерсе тынч абалын сактай албайт"] },
    { q: "Күчтүн СИ системасындагы бирдиги кайсы?", a: "Ньютон (Н)", w: ["Джоуль (Дж)", "Ватт (Вт)", "Паскаль (Па)"] },
    { q: "Аркан тартышууда командалар 600 Н күч жумшашса, аркандын чыңалуусу канча?", a: "600 Н", w: ["0 Н", "300 Н", "1200 Н"] },
    { q: "Бут менен жерди артка түрткөндө, бизди алдыга кайсы күч түртөт?", a: "Жердин каршы аракеттешүү сүрүлүү күчү", w: ["Оордук күчү", "Гравитациялык күч", "Центрге умтулуучу күч"] },
    { q: "Нерсенин массасынын көбөйүшү анын инерттүүлүгүнө кандай таасир этет?", a: "Инерттүүлүгү жогорулайт", w: ["Инерттүүлүгү азаят", "Өзгөрбөйт", "Ылдамдыгы автоматтык өсөт"] }
];

let defaultQuestionsText = [];
for (let i = 0; i < 25; i++) {
    const topic = testTopics[i % testTopics.length];
    defaultQuestionsText.push(`Суроо №${i+1}: ${topic.q} | ${topic.a} | ${topic.w[0]} | ${topic.w[1]} | ${topic.w[2]} | 0`);
}
document.getElementById('questionsTextArea').value = defaultQuestionsText.join('\n');

// Базалык өзгөрмөлөр
let parsedQuestions = [];
let gameActive = false;

let leftTeam = { name: "Көк Танк", index: 0, score: 0, correctCount: 0, endTime: 0, finished: false, renderedAnswers: [] };
let rightTeam = { name: "Кара Тулпар", index: 0, score: 0, correctCount: 0, endTime: 0, finished: false, renderedAnswers: [] };

let startTime = 0;
let ropeOffset = 0;
let targetRopeOffset = 0;

/**
 * МУГАЛИМДИН ТЕСТТЕРИН БАШКАРУУ (LOCALSTORAGE)
 */
function loadSavedTestsList() {
    const listContainer = document.getElementById('savedTestsList');
    listContainer.innerHTML = '';
    
    // Бардык сакталган тесттерди алуу
    let savedTests = JSON.parse(localStorage.getItem('bilimal_arkan_tests')) || {};
    
    // Эгер тест жок болсо билдирүү чыгаруу
    if (Object.keys(savedTests).length === 0) {
        listContainer.innerHTML = `<div style="color: #555; text-align: center; padding-top: 10px;">Сакталган тесттер азырынча жок.</div>`;
        return;
    }

    for (let testName in savedTests) {
        const item = document.createElement('div');
        item.className = 'test-item';
        item.innerHTML = `
            <span style="font-weight: 600; color: #fff;">📁 ${testName}</span>
            <div>
                <button class="btn-select" data-name="${testName}">Ачуу 🔓</button>
                <button class="btn-delete" data-name="${testName}">Өчүрүү 🗑️</button>
            </div>
        `;
        listContainer.appendChild(item);
    }

    // Тандоо баскычтарын угуу
    document.querySelectorAll('.btn-select').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            document.getElementById('questionsTextArea').value = savedTests[name];
            document.getElementById('testNameInput').value = name;
            alert(`"${name}" ийгиликтүү ачылды! Төмөндөн көрүп, оюнду баштасаңыз болот.`);
        });
    });

    // Өчүрүү баскычтарын угуу
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            if (confirm(`"${name}" тесттин өчүрүүнү каалайсызбы?`)) {
                delete savedTests[name];
                localStorage.setItem('bilimal_arkan_tests', JSON.stringify(savedTests));
                loadSavedTestsList();
            }
        });
    });
}

// Тестти ат коюп сактоо баскычы
document.getElementById('saveTestBtn').addEventListener('click', () => {
    const testName = document.getElementById('testNameInput').value.trim();
    const testContent = document.getElementById('questionsTextArea').value.trim();

    if (!testName) {
        alert("Сураныч, адегенде тесттин атын жазыңыз!");
        return;
    }
    if (!testContent) {
        alert("Бош тестти сактоого мүмкүн эмес!");
        return;
    }

    let savedTests = JSON.parse(localStorage.getItem('bilimal_arkan_tests')) || {};
    savedTests[testName] = testContent;
    localStorage.setItem('bilimal_arkan_tests', JSON.stringify(savedTests));
    
    alert(`"${testName}" ийгиликтүү сакталды! Ал тизмеге кошулду.`);
    loadSavedTestsList();
});

// Баракча ачылганда сакталган тесттерди автоматтык жүктөө
loadSavedTestsList();


/**
 * ОЮНДУ БАШТОО ЛОГИКАСЫ
 */
document.getElementById('startGameBtn').addEventListener('click', () => {
    const rawLeft = document.getElementById('leftTeamInput').value.trim();
    const rawRight = document.getElementById('rightTeamInput').value.trim();
    if(rawLeft) leftTeam.name = rawLeft;
    if(rawRight) rightTeam.name = rawRight;

    const textData = document.getElementById('questionsTextArea').value.trim();
    const lines = textData.split('\n');
    
    parsedQuestions = [];
    lines.forEach(line => {
        if (!line.trim()) return;
        const parts = line.split('|');
        if (parts.length >= 6) {
            parsedQuestions.push({
                question: parts[0].trim(),
                originalAnswers: [parts[1].trim(), parts[2].trim(), parts[3].trim(), parts[4].trim()],
                correctText: parts[1].trim()
            });
        }
    });

    if (parsedQuestions.length === 0) {
        alert("Тесттин форматтары туура эмес жазылган!");
        return;
    }

    document.getElementById('setup-layer').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    
    document.getElementById('leftSideName').innerText = leftTeam.name;
    document.getElementById('rightSideName').innerText = rightTeam.name;
    document.getElementById('leftTeamLabel').innerText = leftTeam.name;
    document.getElementById('rightTeamLabel').innerText = rightTeam.name;

    gameActive = true;
    startTime = performance.now();
    
    leftTeam.index = 0; leftTeam.score = 0; leftTeam.correctCount = 0; leftTeam.finished = false;
    rightTeam.index = 0; rightTeam.score = 0; rightTeam.correctCount = 0; rightTeam.finished = false;
    ropeOffset = 0; targetRopeOffset = 0;

    document.getElementById('leftWaitingOverlay').style.display = 'none';
    document.getElementById('rightWaitingOverlay').style.display = 'none';

    renderSide('left');
    renderSide('right');
    requestAnimationFrame(drawGame);
});

function renderSide(side) {
    const team = (side === 'left') ? leftTeam : rightTeam;
    const progressEl = document.getElementById(`${side}Progress`);
    const questionEl = document.getElementById(`${side}QuestionText`);
    const gridEl = document.getElementById(`${side}AnswersGrid`);

    if (team.index >= parsedQuestions.length) {
        team.finished = true;
        if (team.endTime === 0) team.endTime = performance.now();
        document.getElementById(`${side}WaitingOverlay`).style.display = 'flex';
        document.getElementById(`${side}WaitingOverlay`).innerHTML = `🏁 БАРДЫК ТЕСТ БҮТТҮ! <br><span style="font-size:0.9rem; color:#aaa; font-weight:normal; margin-top:8px; display:block;">Команданын упайы сакталды. Күтүңүз...</span>`;
        checkGameCompletion();
        return;
    }

    progressEl.innerText = `Суроо: ${team.index + 1}/${parsedQuestions.length}`;
    const currentQuiz = parsedQuestions[team.index];
    questionEl.innerText = currentQuiz.question;

    gridEl.innerHTML = '';
    const shuffledAnswers = [...currentQuiz.originalAnswers].sort(() => Math.random() - 0.5);

    shuffledAnswers.forEach((ans) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.innerText = ans;
        button.onclick = () => handleSelection(side, ans, currentQuiz.correctText);
        gridEl.appendChild(button);
    });
}

function handleSelection(side, selectedAnswer, correctText) {
    if (!gameActive) return;
    
    const team = (side === 'left') ? leftTeam : rightTeam;
    const isCorrect = (selectedAnswer === correctText);

    if (isCorrect) {
        team.score += 100;
        team.correctCount++;
        targetRopeOffset += (side === 'left') ? -50 : 50;
    } else {
        targetRopeOffset += (side === 'left') ? 30 : -30;
    }

    document.getElementById(`${side}ScoreDisplay`).innerText = team.score;
    team.index++;
    renderSide(side);
}

function checkGameCompletion() {
    if (leftTeam.finished && rightTeam.finished && gameActive) {
        gameActive = false;
        
        const modal = document.getElementById('resultModal');
        const title = document.getElementById('resultTitle');
        const desc = document.getElementById('resultDesc');

        const leftDuration = ((leftTeam.endTime - startTime) / 1000).toFixed(2);
        const rightDuration = ((rightTeam.endTime - startTime) / 1000).toFixed(2);

        let winnerName = "";
        let winReason = "";

        if (leftTeam.correctCount > rightTeam.correctCount) {
            winnerName = leftTeam.name;
            title.style.color = "#00f0ff";
            winReason = `<b>${leftTeam.name}</b> командасы көбүрөөк туура жооп берип жеңишке жетти!`;
        } else if (rightTeam.correctCount > leftTeam.correctCount) {
            winnerName = rightTeam.name;
            title.style.color = "#ff0055";
            winReason = `<b>${rightTeam.name}</b> командасы көбүрөөк туура жооп берип жеңишке жетти!`;
        } else {
            if (parseFloat(leftDuration) < parseFloat(rightDuration)) {
                winnerName = leftTeam.name;
                title.style.color = "#00f0ff";
                winReason = `Эки команда тең бирдей туура жооп беришти, бирок <b>${leftTeam.name}</b> командасы <b>${leftDuration} сек</b> ичинде тезирээк бүтүрүп, убакыт боюнча утту!`;
            } else if (parseFloat(rightDuration) < parseFloat(leftDuration)) {
                winnerName = rightTeam.name;
                title.style.color = "#ff0055";
                winReason = `Эки команда тең бирдей туура жооп беришти, бирок <b>${rightTeam.name}</b> командасы <b>${rightDuration} сек</b> ичинде тезирээк бүтүрүп, убакыт боюнча утту!`;
            } else {
                winnerName = "ТЕҢ ЧЫГУУ";
                title.style.color = "#d4af37";
                winReason = `Теңдешсиз мелдеши! Эки команда тең бирдей упай топтоп, бирдей убакытта бүтүрүштү.`;
            }
        }

        title.innerText = (winnerName === "ТЕҢ ЧЫГУУ") ? "🤝 ТЕҢ ЧЫГУУ!" : `🏆 ${winnerName} ЖЕҢДИ!`;
        desc.innerHTML = `
            ${winReason} <br><br>
            📊 <b>Жыйынтык статистика:</b><br>
            • ${leftTeam.name}: <b>${leftTeam.correctCount} туура жооп</b> (${leftDuration} сек)<br>
            • ${rightTeam.name}: <b>${rightTeam.correctCount} туура жооп</b> (${rightDuration} сек)
        `;

        modal.style.display = 'flex';
    }
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerY = canvas.height * 0.7;
    const centerX = canvas.width / 2 + ropeOffset;

    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.65);
    skyGradient.addColorStop(0, '#0f2027');
    skyGradient.addColorStop(1, '#203a43');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.65);

    ctx.beginPath();
    ctx.arc(canvas.width * 0.85, canvas.height * 0.25, 35, 0, Math.PI * 2);
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 25; ctx.shadowColor = '#ff00ff'; ctx.fill(); ctx.shadowBlur = 0;

    ctx.fillStyle = '#0a0a20';
    ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);
    
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.65);
    ctx.lineTo(canvas.width, canvas.height * 0.67);
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 3; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(30, centerY); ctx.lineTo(canvas.width - 30, centerY);
    ctx.lineWidth = 10; ctx.strokeStyle = '#d4af37'; ctx.stroke();

    ctx.fillStyle = '#ff0055';
    ctx.fillRect(centerX - 8, centerY - 20, 16, 40);
    
    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.fillRect(canvas.width / 2 - 2, centerY - 35, 4, 70);

    drawTeam(canvas.width * 0.22 + ropeOffset * 0.4, centerY, '#00f0ff', `[${leftTeam.name}]`, false);
    drawTeam(canvas.width * 0.78 + ropeOffset * 0.4, centerY, '#ff0055', `[${rightTeam.name}]`, true);

    ropeOffset += (targetRopeOffset - ropeOffset) * 0.05;

    if (gameActive) {
        requestAnimationFrame(drawGame);
    }
}

function drawTeam(startX, centerY, color, teamName, isRightSide) {
    ctx.fillStyle = color; ctx.font = "bold 13px Segoe UI"; ctx.textAlign = "center";
    ctx.fillText(teamName, startX, centerY - 55);

    for (let i = 0; i < 3; i++) {
        let offsetX = isRightSide ? (i * 35) : -(i * 35);
        let x = startX + offsetX; let y = centerY;
        ctx.beginPath(); ctx.arc(x, y - 30, 9, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = color;
        ctx.beginPath(); ctx.moveTo(x, y - 21); ctx.lineTo(x, y + 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 15); ctx.lineTo(startX, y); ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x - 8, y + 30); ctx.moveTo(x, y + 8); ctx.lineTo(x + 8, y + 30); ctx.stroke();
    }
}
