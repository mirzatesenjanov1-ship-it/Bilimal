/**
 * /arkan-game/js/game.js
 * Баскычтардын басылбай калуу жана дизайндын кулап кетүү катасы толугу менен оңдолду.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bgMusic = document.getElementById('bgMusic');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.55;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Баштапкы суроо шаблону
let defaultQuestionsText = [];
for (let i = 0; i < 25; i++) {
    defaultQuestionsText.push(`Физикалык суроо №${i+1}: Ньютондун үчүнчү закону кандай туюнтулат? | Аракет этүүчү күч каршы аракет этүүчү күчкө модулу боюнча барабар, багыты боюнча карама-каршы | Нерсеге аракет эткен күч анын массасы менен тезденүүсүнүн көбөйтүндүсүнө барабар | Инерциялык эсептөө системаларында нерсе түз сызыктуу жана бир калыпта кыймылдайт | Энергия жоктон бар болбойт, бир түрдөн экинчи түргө өтөт | 0`);
}
document.getElementById('questionsTextArea').value = defaultQuestionsText.join('\n');

let parsedQuestions = [];
let gameActive = false;

let leftTeam = { name: "Көк Танк", index: 0, score: 0, correctCount: 0, endTime: 0, finished: false };
let rightTeam = { name: "Кара Тулпар", index: 0, score: 0, correctCount: 0, endTime: 0, finished: false };

let startTime = 0;
let ropeOffset = 0;
let targetRopeOffset = 0;

function loadSavedTestsList() {
    const listContainer = document.getElementById('savedTestsList');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    let savedTests = JSON.parse(localStorage.getItem('bilimal_arkan_tests')) || {};
    if (Object.keys(savedTests).length === 0) {
        listContainer.innerHTML = `<div style="color: #666; text-align: center; padding-top: 15px;">Сакталган тесттер азырынча жок.</div>`;
        return;
    }
    for (let testName in savedTests) {
        const item = document.createElement('div');
        item.className = 'test-item';
        item.innerHTML = `<span>📁 ${testName}</span><div><button class="btn-select" data-name="${testName}">Ачуу</button><button class="btn-delete" data-name="${testName}">Өчүрүү</button></div>`;
        listContainer.appendChild(item);
    }
    document.querySelectorAll('.btn-select').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            document.getElementById('questionsTextArea').value = savedTests[name];
            document.getElementById('testNameInput').value = name;
        });
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-name');
            if (confirm(`"${name}" өчүрүлсүнбү?`)) {
                delete savedTests[name];
                localStorage.setItem('bilimal_arkan_tests', JSON.stringify(savedTests));
                loadSavedTestsList();
            }
        });
    });
}

document.getElementById('saveTestBtn').addEventListener('click', () => {
    const testName = document.getElementById('testNameInput').value.trim();
    const testContent = document.getElementById('questionsTextArea').value.trim();
    if (!testName || !testContent) return alert("Атын жана мазмунун толтуруңуз!");
    let savedTests = JSON.parse(localStorage.getItem('bilimal_arkan_tests')) || {};
    savedTests[testName] = testContent;
    localStorage.setItem('bilimal_arkan_tests', JSON.stringify(savedTests));
    loadSavedTestsList();
    alert("Тест ийгиликтүү сакталды!");
});

loadSavedTestsList();

// ОЮНДУ БАШТОО ОКУЯСЫ
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

    if (parsedQuestions.length === 0) return alert("Тесттин форматы туура эмес! Суроолорду текшериңиз.");

    if (bgMusic) {
        bgMusic.currentTime = 0;
        bgMusic.volume = 0.35;
        bgMusic.play().catch(e => console.log("Музыканы жүктөөдө ката: ", e));
    }

    document.getElementById('leftSideName').innerText = leftTeam.name;
    document.getElementById('rightSideName').innerText = rightTeam.name;
    document.getElementById('leftTeamLabel').innerText = leftTeam.name;
    document.getElementById('rightTeamLabel').innerText = rightTeam.name;

    document.getElementById('setup-layer').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'block';
    
    gameActive = true;
    startTime = performance.now();
    
    leftTeam.index = 0; leftTeam.score = 0; leftTeam.correctCount = 0; leftTeam.finished = false; leftTeam.endTime = 0;
    rightTeam.index = 0; rightTeam.score = 0; rightTeam.correctCount = 0; rightTeam.finished = false; rightTeam.endTime = 0;
    ropeOffset = 0; targetRopeOffset = 0;

    document.getElementById('leftWaitingOverlay').style.display = 'none';
    document.getElementById('rightWaitingOverlay').style.display = 'none';
    document.getElementById('leftScoreDisplay').innerText = "0";
    document.getElementById('rightScoreDisplay').innerText = "0";

    renderSide('left');
    renderSide('right');
    requestAnimationFrame(drawGame);
});

function renderSide(side) {
    const team = (side === 'left') ? leftTeam : rightTeam;
    const progressEl = document.getElementById(`${side}Progress`);
    const questionEl = document.getElementById(`${side}QuestionText`);
    const gridEl = document.getElementById(`${side}AnswersGrid`);
    const overlayEl = document.getElementById(`${side}WaitingOverlay`);

    if (team.index >= parsedQuestions.length) {
        team.finished = true;
        if (team.endTime === 0) team.endTime = performance.now();
        if (overlayEl) overlayEl.style.display = 'flex';
        checkGameCompletion();
        return;
    }

    if (progressEl) progressEl.innerText = `Суроо: ${team.index + 1}/${parsedQuestions.length}`;
    
    const currentQuiz = parsedQuestions[team.index];
    if (questionEl) questionEl.innerText = currentQuiz.question;

    if (gridEl) {
        gridEl.innerHTML = '';
        // Варианттарды аралаштыруу
        const shuffledAnswers = [...currentQuiz.originalAnswers].sort(() => Math.random() - 0.5);

        shuffledAnswers.forEach((ans) => {
            const button = document.createElement('button');
            button.className = 'answer-btn';
            button.innerText = ans;
            // 'click' окуясын түздөн-түз коопсуз байлайбыз
            button.addEventListener('click', () => {
                handleSelection(side, ans, currentQuiz.correctText);
            });
            gridEl.appendChild(button);
        });
    }
}

function handleSelection(side, selectedAnswer, correctText) {
    if (!gameActive) return;
    const team = (side === 'left') ? leftTeam : rightTeam;
    
    if (selectedAnswer === correctText) {
        team.score += 100;
        team.correctCount++;
        targetRopeOffset += (side === 'left') ? -45 : 45;
    } else {
        targetRopeOffset += (side === 'left') ? 25 : -25;
    }
    
    const scoreDisplay = document.getElementById(`${side}ScoreDisplay`);
    if (scoreDisplay) scoreDisplay.innerText = team.score;
    
    team.index++;
    renderSide(side);
}

function checkGameCompletion() {
    if (leftTeam.finished && rightTeam.finished && gameActive) {
        gameActive = false;
        if (bgMusic) bgMusic.pause();

        const modal = document.getElementById('resultModal');
        const title = document.getElementById('resultTitle');
        const desc = document.getElementById('resultDesc');

        const leftDuration = ((leftTeam.endTime - startTime) / 1000).toFixed(2);
        const rightDuration = ((rightTeam.endTime - startTime) / 1000).toFixed(2);

        let winnerName = ""; 
        let winReason = "";

        if (leftTeam.correctCount > rightTeam.correctCount) {
            winnerName = leftTeam.name; title.style.color = "#00f0ff";
            winReason = `🔥 <b>${leftTeam.name}</b> командасы көбүрөөк туура жооп бергендиги үчүн жеңишке жетти!`;
        } else if (rightTeam.correctCount > leftTeam.correctCount) {
            winnerName = rightTeam.name; title.style.color = "#ff0055";
            winReason = `🔥 <b>${rightTeam.name}</b> командасы көбүрөөк туура жооп бергендиги үчүн жеңишке жетти!`;
        } else {
            if (parseFloat(leftDuration) < parseFloat(rightDuration)) {
                winnerName = leftTeam.name; title.style.color = "#00f0ff";
                winReason = `🤝 Туура жооптордун саны тең! Бирок <b>${leftTeam.name}</b> тестти ылдамыраак бүтүрдү.`;
            } else {
                winnerName = rightTeam.name; title.style.color = "#ff0055";
                winReason = `🤝 Туура жооптордун саны тең! Бирок <b>${rightTeam.name}</b> тестти ылдамыраак бүтүрдү.`;
            }
        }

        title.innerText = `🏆 ${winnerName} ЖЕҢДИ!`;
        desc.innerHTML = `
            ${winReason}<br><br>
            <b>Оюндун статистикасы:</b><br>
            • <b>${leftTeam.name}</b>: ${leftTeam.correctCount} туура жооп | Убакыт: ${leftDuration} сек<br>
            • <b>${rightTeam.name}</b>: ${rightTeam.correctCount} туура жооп | Убакыт: ${rightDuration} сек
        `;
        modal.style.display = 'flex';
    }
}

// КАНВАС СҮРӨТҮ (АНЛИМАЦИЯ)
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerY = canvas.height * 0.7;
    const centerX = canvas.width / 2 + ropeOffset;

    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.65);
    skyGradient.addColorStop(0, '#0f2027'); skyGradient.addColorStop(1, '#203a43');
    ctx.fillStyle = skyGradient; ctx.fillRect(0, 0, canvas.width, canvas.height * 0.65);

    ctx.beginPath(); ctx.arc(canvas.width * 0.85, canvas.height * 0.25, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#ff00ff'; ctx.shadowBlur = 20; ctx.shadowColor = '#ff00ff'; ctx.fill(); ctx.shadowBlur = 0;

    ctx.fillStyle = '#070716'; ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);
    ctx.beginPath(); ctx.moveTo(0, canvas.height * 0.65); ctx.lineTo(canvas.width, canvas.height * 0.65);
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(30, centerY); ctx.lineTo(canvas.width - 30, centerY);
    ctx.lineWidth = 8; ctx.strokeStyle = '#d4af37'; ctx.stroke();

    ctx.fillStyle = '#ff0055'; ctx.fillRect(centerX - 6, centerY - 15, 12, 30);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.15)'; ctx.fillRect(canvas.width / 2 - 2, centerY - 30, 4, 60);

    drawTeam(canvas.width * 0.25 + ropeOffset * 0.35, centerY, '#00f0ff', leftTeam.name, false);
    drawTeam(canvas.width * 0.75 + ropeOffset * 0.35, centerY, '#ff0055', rightTeam.name, true);

    ropeOffset += (targetRopeOffset - ropeOffset) * 0.05;
    if (gameActive) requestAnimationFrame(drawGame);
}

function drawTeam(startX, centerY, color, teamName, isRightSide) {
    ctx.fillStyle = color; ctx.font = "bold 14px Segoe UI"; ctx.textAlign = "center";
    ctx.fillText(`[ ${teamName} ]`, startX, centerY - 50);
    for (let i = 0; i < 3; i++) {
        let offsetX = isRightSide ? (i * 32) : -(i * 32);
        let x = startX + offsetX; let y = centerY;
        ctx.beginPath(); ctx.arc(x, y - 26, 8, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = color;
        ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(startX, y); ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x - 6, y + 25); ctx.moveTo(x, y + 6); ctx.lineTo(x + 6, y + 25); ctx.stroke();
    }
}
