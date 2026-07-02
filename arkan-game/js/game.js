/**
 * /arkan-game/js/game.js
 * Скриншоттогу (image_879279.png) текст кулоо катасы толук оңдолду.
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
    defaultQuestionsText.push(`Суроо №${i+1}: Ньютондун 3-закону кандай айтылат? | Аракет күчү каршы аракет күчүнө модулу боюнча барабар | Күч ылдамдыкка түз пропорциялуу | Инерция дайыма сакталат | Нерсе тынч абалын сактай албайт | 0`);
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
    listContainer.innerHTML = '';
    let savedTests = JSON.parse(localStorage.getItem('bilimal_arkan_tests')) || {};
    if (Object.keys(savedTests).length === 0) {
        listContainer.innerHTML = `<div style="color: #555; text-align: center; padding-top: 10px;">Сакталган тесттер азырынча жок.</div>`;
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
    if (!testName || !testContent) return alert("Атын жазыңыз!");
    let savedTests = JSON.parse(localStorage.getItem('bilimal_arkan_tests')) || {};
    savedTests[testName] = testContent;
    localStorage.setItem('bilimal_arkan_tests', JSON.stringify(savedTests));
    loadSavedTestsList();
    alert("Тест сакталды!");
});

loadSavedTestsList();

// ОЮНДУ БАШТОО
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

    if (parsedQuestions.length === 0) return alert("Тесттин форматы ката!");

    if (bgMusic) {
        bgMusic.currentTime = 0;
        bgMusic.volume = 0.4;
        bgMusic.play().catch(e => console.log(e));
    }

    // Тексттерди жаңыртуу
    document.getElementById('leftSideName').innerText = leftTeam.name;
    document.getElementById('rightSideName').innerText = rightTeam.name;
    document.getElementById('leftTeamLabel').innerText = leftTeam.name;
    document.getElementById('rightTeamLabel').innerText = rightTeam.name;

    document.getElementById('setup-layer').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    
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
    const overlayEl = document.getElementById(`${side}WaitingOverlay`);

    if (team.index >= parsedQuestions.length) {
        team.finished = true;
        if (team.endTime === 0) team.endTime = performance.now();
        if(overlayEl) overlayEl.style.display = 'flex';
        checkGameCompletion();
        return;
    }

    if(progressEl) progressEl.innerText = `Суроо: ${team.index + 1}/${parsedQuestions.length}`;
    
    const currentQuiz = parsedQuestions[team.index];
    if(questionEl) questionEl.innerText = currentQuiz.question;

    if(gridEl) {
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
}

function handleSelection(side, selectedAnswer, correctText) {
    if (!gameActive) return;
    const team = (side === 'left') ? leftTeam : rightTeam;
    
    if (selectedAnswer === correctText) {
        team.score += 100;
        team.correctCount++;
        targetRopeOffset += (side === 'left') ? -50 : 50;
    } else {
        targetRopeOffset += (side === 'left') ? 30 : -30;
    }
    
    const scoreDisplay = document.getElementById(`${side}ScoreDisplay`);
    if(scoreDisplay) scoreDisplay.innerText = team.score;
    
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

        let winnerName = ""; let winReason = "";

        if (leftTeam.correctCount > rightTeam.correctCount) {
            winnerName = leftTeam.name; title.style.color = "#00f0ff";
            winReason = `<b>${leftTeam.name}</b> көбүрөөк туура жооп берди!`;
        } else if (rightTeam.correctCount > leftTeam.correctCount) {
            winnerName = rightTeam.name; title.style.color = "#ff0055";
            winReason = `<b>${rightTeam.name}</b> көбүрөөк туура жооп берди!`;
        } else {
            if (parseFloat(leftDuration) < parseFloat(rightDuration)) {
                winnerName = leftTeam.name; title.style.color = "#00f0ff";
                winReason = `Упайлар тең, бирок <b>${leftTeam.name}</b> ылдам аяктады!`;
            } else {
                winnerName = rightTeam.name; title.style.color = "#ff0055";
                winReason = `Упайлар тең, бирок <b>${rightTeam.name}</b> ылдам аяктады!`;
            }
        }

        title.innerText = `🏆 ${winnerName} ЖЕҢДИ!`;
        desc.innerHTML = `${winReason} <br><br> Жыйынтык: <br> • ${leftTeam.name}: ${leftTeam.correctCount} туура (${leftDuration} сек)<br> • ${rightTeam.name}: ${rightTeam.correctCount} туура (${rightDuration} сек)`;
        modal.style.display = 'flex';
    }
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerY = canvas.height * 0.7;
    const centerX = canvas.width / 2 + ropeOffset;

    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.65);
    skyGradient.addColorStop(0, '#0f2027'); skyGradient.addColorStop(1, '#203a43');
    ctx.fillStyle = skyGradient; ctx.fillRect(0, 0, canvas.width, canvas.height * 0.65);

    ctx.beginPath(); ctx.arc(canvas.width * 0.85, canvas.height * 0.25, 35, 0, Math.PI * 2);
    ctx.fillStyle = '#ff00ff'; ctx.shadowBlur = 25; ctx.shadowColor = '#ff00ff'; ctx.fill(); ctx.shadowBlur = 0;

    ctx.fillStyle = '#0a0a20'; ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);
    ctx.beginPath(); ctx.moveTo(0, canvas.height * 0.65); ctx.lineTo(canvas.width, canvas.height * 0.67);
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 3; ctx.stroke();

    ctx.beginPath(); ctx.moveTo(30, centerY); ctx.lineTo(canvas.width - 30, centerY);
    ctx.lineWidth = 10; ctx.strokeStyle = '#d4af37'; ctx.stroke();

    ctx.fillStyle = '#ff0055'; ctx.fillRect(centerX - 8, centerY - 20, 16, 40);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)'; ctx.fillRect(canvas.width / 2 - 2, centerY - 35, 4, 70);

    drawTeam(canvas.width * 0.22 + ropeOffset * 0.4, centerY, '#00f0ff', `[${leftTeam.name}]`, false);
    drawTeam(canvas.width * 0.78 + ropeOffset * 0.4, centerY, '#ff0055', `[${rightTeam.name}]`, true);

    ropeOffset += (targetRopeOffset - ropeOffset) * 0.05;
    if (gameActive) requestAnimationFrame(drawGame);
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
