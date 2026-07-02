/**
 * /arkan-game/js/game.js
 * Динамикалык суроолор жана Командалык эсептөө тутуму менен жаңыртылган кыймылдаткыч.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Демейки (Планы бар) 25 даана суроонун шаблону (Мугалим текст кутучасына чаптабаса ушул иштейт)
const defaultTemplate = `Ньютондун үчүнчү закону кандай туюнтулат? | Аракет күчү каршы аракет күчүнө модулу боюнча барабар | Күч массага түз пропорционалдуу | Инерция сакталат | Энергия жоголбойт | 0
Нерсеге аракет эткен күчтүн бирдиги кайсы? | Джоуль | Ватт | Ньютон | Паскаль | 2
Э эки команда тең арканды 500 Н менен тартса чыңалуу канча? | 0 Н | 250 Н | 500 Н | 1000 Н | 2`;

// Текст кутучасына демейки үлгүнү алдын ала жазып коюу
document.getElementById('questionsTextArea').value = Array(25).fill(null).map((_, i) => 
    `Физикалык суроо №${i+1}: Күч жана кыймыл динамикасы кандай аныкталат? | Туура жооп варианты | Ката вариант А | Ката вариант Б | Ката вариант В | 0`
).join('\n');

// Оюндун абалын сактоочу өзгөрмөлөр
let gameQuestions = [];
let currentQuestionIndex = 0;
let gameActive = false;

let leftTeamName = "Көк Команда";
let rightTeamName = "Кызыл Команда";

let leftScore = 0;
let rightScore = 0;

let ropeOffset = 0; 
let targetRopeOffset = 0;

// Оюнду баштоо баскычын угуу
document.getElementById('startGameBtn').addEventListener('click', () => {
    const rawLeft = document.getElementById('leftTeamInput').value.trim();
    const rawRight = document.getElementById('rightTeamInput').value.trim();
    if(rawLeft) leftTeamName = rawLeft;
    if(rawRight) rightTeamName = rawRight;

    // Суроолорду парсинг кылуу (Текстти массиве айлантуу)
    const textData = document.getElementById('questionsTextArea').value.trim();
    const lines = textData.split('\n');
    
    gameQuestions = [];
    lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 6) {
            gameQuestions.push({
                question: parts[0].trim(),
                answers: [parts[1].trim(), parts[2].trim(), parts[3].trim(), parts[4].trim()],
                correct: parseInt(parts[5].trim())
            });
        }
    });

    if (gameQuestions.length === 0) {
        alert("Суроолорду форматка ылайык туура киргизиңиз!");
        return;
    }

    // Интерфейстерди алмаштыруу
    document.getElementById('setup-layer').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    document.getElementById('leftTeamLabel').innerText = leftTeamName;
    document.getElementById('rightTeamLabel').innerText = rightTeamName;

    gameActive = true;
    currentQuestionIndex = 0;
    leftScore = 0;
    rightScore = 0;
    ropeOffset = 0;
    targetRopeOffset = 0;

    loadQuestion();
    requestAnimationFrame(drawGame);
});

/**
 * Рендеринг цикли (Сиз каалагандай визуалдык катмарга тийбейбиз)
 */
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height * 0.65;
    const centerX = canvas.width / 2 + ropeOffset;

    // Жайлоо асманы
    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.6);
    skyGradient.addColorStop(0, '#0f2027');
    skyGradient.addColorStop(1, '#203a43');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.6);

    // Күн
    ctx.beginPath();
    ctx.arc(canvas.width * 0.8, canvas.height * 0.2, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff00ff';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Жер катмары
    ctx.fillStyle = '#0a0a20';
    ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);
    
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.6);
    ctx.lineTo(canvas.width, canvas.height * 0.62);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Аркан
    ctx.beginPath();
    ctx.moveTo(50, centerY);
    ctx.lineTo(canvas.width - 50, centerY);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();

    // Кызыл маркер
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(centerX - 10, centerY - 25, 20, 50);
    
    // Тең салмактуулук сызыгы
    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.fillRect(canvas.width / 2 - 2, centerY - 40, 4, 80);

    // Сол команданы тартуу
    drawTeam(canvas.width * 0.25 + ropeOffset * 0.5, centerY, '#00f0ff', `[${leftTeamName}]`, false);

    // Оң команданы тартуу
    drawTeam(canvas.width * 0.75 + ropeOffset * 0.5, centerY, '#ff0055', `[${rightTeamName}]`, true);

    // Физикалык жылышуу инерциясы
    ropeOffset += (targetRopeOffset - ropeOffset) * 0.05;

    if (gameActive) {
        requestAnimationFrame(drawGame);
    }
}

function drawTeam(startX, centerY, color, teamName, isRightSide) {
    ctx.fillStyle = color;
    ctx.font = "bold 14px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(teamName, startX, centerY - 70);

    for (let i = 0; i < 3; i++) {
        let offsetX = isRightSide ? (i * 45) : -(i * 45);
        let x = startX + offsetX;
        let y = centerY;

        ctx.beginPath();
        ctx.arc(x, y - 40, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 6;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - 28);
        ctx.lineTo(x, y + 10);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y - 20);
        ctx.lineTo(startX, y);
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x - 10, y + 40);
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x + 10, y + 40);
        ctx.stroke();
    }
}

function loadQuestion() {
    if (currentQuestionIndex >= gameQuestions.length) {
        endGame();
        return;
    }

    const currentQuiz = gameQuestions[currentQuestionIndex];
    // Кезекте кайсы команда жооп берип жатканын визуалдык көрсөтүү
    const isLeftTurn = currentQuestionIndex % 2 === 0;
    const activeTeam = isLeftTurn ? leftTeamName : rightTeamName;
    const activeColor = isLeftTurn ? '#00f0ff' : '#ff0055';

    document.getElementById('questionText').innerHTML = `
        <div style="font-size:0.9rem; color:${activeColor}; margin-bottom:8px; font-weight:bold;">
            Жооп берүүчү кезек: ${activeTeam} Командасы (Суроо ${currentQuestionIndex + 1}/${gameQuestions.length})
        </div>
        ${currentQuiz.question}
    `;
    
    const answersGrid = document.getElementById('answersGrid');
    answersGrid.innerHTML = '';

    currentQuiz.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.innerText = `${index + 1}) ${answer}`;
        button.onclick = () => handleAnswer(index, currentQuiz.correct, isLeftTurn);
        answersGrid.appendChild(button);
    });
}

function handleAnswer(selectedIndex, correctIndex, isLeftTurn) {
    if (!gameActive) return;

    if (selectedIndex === correctIndex) {
        if (isLeftTurn) {
            leftScore += 100;
            document.getElementById('leftScoreDisplay').innerText = leftScore;
            targetRopeOffset -= 70; // Сол тарап өзүнө тартты
        } else {
            rightScore += 100;
            document.getElementById('rightScoreDisplay').innerText = rightScore;
            targetRopeOffset += 70; // Оң тарап өзүнө тартты
        }
    } else {
        // Ким ката кетирсе, карама каршы команда арканды өзүнө тартып алат
        if (isLeftTurn) {
            rightScore += 50; 
            document.getElementById('rightScoreDisplay').innerText = rightScore;
            targetRopeOffset += 50;
        } else {
            leftScore += 50;
            document.getElementById('leftScoreDisplay').innerText = leftScore;
            targetRopeOffset -= 50;
        }
    }

    currentQuestionIndex++;
    
    const container = document.getElementById('quizContainer');
    container.style.transform = 'scale(0.97)';
    setTimeout(() => {
        container.style.transform = 'scale(1)';
        loadQuestion();
    }, 250);
}

/**
 * Оюн аягында упайларды салыштырып жеңүүчүнү аныктоо
 */
function endGame() {
    gameActive = false;
    document.getElementById('quizContainer').style.display = 'none';
    const modal = document.getElementById('resultModal');
    const title = document.getElementById('resultTitle');
    const desc = document.getElementById('resultDesc');

    if (leftScore > rightScore) {
        title.innerText = `🎉 ЖЕҢИШ: ${leftTeamName}!`;
        title.style.color = "#00f0ff";
        desc.innerHTML = `Бул мелдеште <b>${leftTeamName}</b> командасы мыкты билим көрсөтүп, көбүрөөк туура жооп берди!<br><br>🏆 Жыйынтык эсеп:<br>${leftTeamName}: <b>${leftScore} упай</b><br>${rightTeamName}: <b>${rightScore} упай</b>`;
    } else if (rightScore > leftScore) {
        title.innerText = `🎉 ЖЕҢИШ: ${rightTeamName}!`;
        title.style.color = "#ff0055";
        desc.innerHTML = `Бул мелдеште <b>${rightTeamName}</b> командасы мыкты билим көрсөтүп, көбүрөөк туура жооп берди!<br><br>🏆 Жыйынтык эсеп:<br>${rightTeamName}: <b>${rightScore} упай</b><br>${leftTeamName}: <b>${leftScore} упай</b>`;
    } else {
        title.innerText = "ДОСТУК ЖЕҢДИ! 🤝";
        title.style.color = "#d4af37";
        desc.innerHTML = `Эки команда тең бирдей деңгээлде упай топтошту! Күчтөрдүн тең салмактуулугу сакталды.<br><br>Жыйынтык эсеп: <b>${leftScore} - ${rightScore}</b>`;
    }

    modal.style.display = 'flex';
}
