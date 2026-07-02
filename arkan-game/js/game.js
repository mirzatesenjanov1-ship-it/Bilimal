/**
 * /arkan-game/js/game.js
 * Эки оюнчуга бир убакта өз алдынча суроо берүүчү, варианттарды аралаштыруучу 
 * жана убакыт боюнча жеңүүчүнү аныктоочу толук рендеринг кыймылдаткычы.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.55; // Каньвас жогорку 55% гана ээлейт
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Мугалим үчүн даяр 25 суроолуу физикалык тест генерациясы (автоматтык толтурулат)
const testTopics = [
    { q: "Ньютондун 3-закону кандай айтылат?", a: "Аракет күчү каршы аракет күчүнө модулу боюнча барабар", w: ["Күч ылдамдыкка түз пропорциялуу", "Инерция дайыма сакталат", "Нерсе тынч абалын сактай албайт"] },
    { q: "Күчтүн СИ системасындагы бирдиги кайсы?", a: "Ньютон (Н)", w: ["Джоуль (Дж)", "Ватт (Вт)", "Паскаль (Па)"] },
    { q: "Аркан тартышууда командалар 600 Н күч жумшашса, аркандын чыңалуусу канча?", a: "600 Н", w: ["0 Н", "300 Н", "1200 Н"] },
    { q: "Бут менен жерди артка түрткөндө, бизди алдыга кайсы күч түртөт?", a: "Жердин каршы аракеттешүү сүрүлүү күчү", w: ["Оордук күчү", "Гравитациялык күч", "Центрге умтулуучу күч"] },
    { q: "Нерсенин массасынын көбөйүшү анын инерттүүлүгүнө кандай таасир этет?", a: "Инерттүүлүгү жогорулайт", w: ["Инерттүүлүгү азаят", "Өзгөрбөйт", "Ылдамдыгы автоматтык өсөт"] }
];

// Текст талаасына 25 суроону формат боюнча даярдап салуу
let defaultQuestionsText = [];
for (let i = 0; i < 25; i++) {
    const topic = testTopics[i % testTopics.length];
    defaultQuestionsText.push(`Суроо №${i+1}: ${topic.q} | ${topic.a} | ${topic.w[0]} | ${topic.w[1]} | ${topic.w[2]} | 0`);
}
document.getElementById('questionsTextArea').value = defaultQuestionsText.join('\n');

// Базалык өзгөрмөлөр
let parsedQuestions = [];
let gameActive = false;

// Командалардын динамикалык абалы
let leftTeam = { name: "Көк Танк", index: 0, score: 0, correctCount: 0, endTime: 0, finished: false, renderedAnswers: [] };
let rightTeam = { name: "Кара Тулпар", index: 0, score: 0, correctCount: 0, endTime: 0, finished: false, renderedAnswers: [] };

let startTime = 0;
let ropeOffset = 0;
let targetRopeOffset = 0;

// Оюнду баштоо баскычы
document.getElementById('startGameBtn').addEventListener('click', () => {
    const rawLeft = document.getElementById('leftTeamInput').value.trim();
    const rawRight = document.getElementById('rightTeamInput').value.trim();
    if(rawLeft) leftTeam.name = rawLeft;
    if(rawRight) rightTeam.name = rawRight;

    // Тексттен суроолорду массивге парсинг кылуу
    const textData = document.getElementById('questionsTextArea').value.trim();
    const lines = textData.split('\n');
    
    parsedQuestions = [];
    lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 6) {
            parsedQuestions.push({
                question: parts[0].trim(),
                originalAnswers: [parts[1].trim(), parts[2].trim(), parts[3].trim(), parts[4].trim()],
                correctText: parts[1].trim() // Туура жооптун тексти аркылуу текшеребиз (аралашканда ката кетпеши үчүн)
            });
        }
    });

    if (parsedQuestions.length === 0) {
        alert("Суроолорду туура форматта киргизиңиз!");
        return;
    }

    // Экрандарды алмаштыруу
    document.getElementById('setup-layer').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';
    
    document.getElementById('leftSideName').innerText = leftTeam.name;
    document.getElementById('rightSideName').innerText = rightTeam.name;
    document.getElementById('leftTeamLabel').innerText = leftTeam.name;
    document.getElementById('rightTeamLabel').innerText = rightTeam.name;

    // Оюнду баштапкы абалга келтирүү
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

/**
 * Варианттарды аралаштырып, ар бир командага өзүнчө терезеге чыгаруу
 */
function renderSide(side) {
    const team = (side === 'left') ? leftTeam : rightTeam;
    const progressEl = document.getElementById(`${side}Progress`);
    const questionEl = document.getElementById(`${side}QuestionText`);
    const gridEl = document.getElementById(`${side}AnswersGrid`);

    if (team.index >= parsedQuestions.length) {
        team.finished = true;
        if (team.endTime === 0) team.endTime = performance.now();
        document.getElementById(`${side}WaitingOverlay`).style.display = 'flex';
        document.getElementById(`${side}WaitingOverlay`).innerHTML = `🏁 БАРДЫК ТЕСТ БҮТТҮ! <br><span style="font-size:1rem; color:#aaa; font-weight:normal; margin-top:10px; display:block;">Экинчи команданы күтүүдө...</span>`;
        checkGameCompletion();
        return;
    }

    progressEl.innerText = `Суроо: ${team.index + 1}/${parsedQuestions.length}`;
    const currentQuiz = parsedQuestions[team.index];
    questionEl.innerText = currentQuiz.question;

    gridEl.innerHTML = '';

    // Көчүрбөө үчүн варианттарды кокусунан аралаштыруу (Shuffling)
    const shuffledAnswers = [...currentQuiz.originalAnswers].sort(() => Math.random() - 0.5);
    team.renderedAnswers = shuffledAnswers;

    shuffledAnswers.forEach((ans) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.innerText = ans;
        button.onclick = () => handleSelection(side, ans, currentQuiz.correctText);
        gridEl.appendChild(button);
    });
}

/**
 * Жоопту текшерүү жана арканды реалдуу убакытта тартуу
 */
function handleSelection(side, selectedAnswer, correctText) {
    if (!gameActive) return;
    
    const team = (side === 'left') ? leftTeam : rightTeam;
    const isCorrect = (selectedAnswer === correctText);

    if (isCorrect) {
        team.score += 100;
        team.correctCount++;
        // Сол команда тапса аркан солго (-), оң команда тапса оңго (+) жылат
        targetRopeOffset += (side === 'left') ? -50 : 50;
    } else {
        // Ката кетирсе аркан каршы тарапка тартылып кетет
        targetRopeOffset += (side === 'left') ? 30 : -30;
    }

    // Жогорку упай тактасын жаңыртуу
    document.getElementById(`${side}ScoreDisplay`).innerText = team.score;

    team.index++;
    renderSide(side);
}

/**
 * Эки команда тең бүткөнүн көзөмөлдөө
 */
function checkGameCompletion() {
    if (leftTeam.finished && rightTeam.finished && gameActive) {
        gameActive = false;
        
        const modal = document.getElementById('resultModal');
        const title = document.getElementById('resultTitle');
        const desc = document.getElementById('resultDesc');

        // Убакыттарды секундга айлантуу
        const leftDuration = ((leftTeam.endTime - startTime) / 1000).toFixed(2);
        const rightDuration = ((rightTeam.endTime - startTime) / 1000).toFixed(2);

        let winnerName = "";
        let winReason = "";

        // 1-шарт: Кимдин туура жооптору (упайы) көп болсо, ошол утат
        if (leftTeam.correctCount > rightTeam.correctCount) {
            winnerName = leftTeam.name;
            title.style.color = "#00f0ff";
            winReason = `<b>${leftTeam.name}</b> командасы көбүрөөк туура жооп берип жеңишке жетти!`;
        } else if (rightTeam.correctCount > leftTeam.correctCount) {
            winnerName = rightTeam.name;
            title.style.color = "#ff0055";
            winReason = `<b>${rightTeam.name}</b> командасы көбүрөөк туура жооп берип жеңишке жетти!`;
        } else {
            // 2-шарт: Эгер упайлар тең болсо, ким эртерээк (тезирээк) бүтүрсө ошол утат!
            if (parseFloat(leftDuration) < parseFloat(rightDuration)) {
                winnerName = leftTeam.name;
                title.style.color = "#00f0ff";
                winReason = `Эки команда тең бирдей туура жооп беришти, бирок <b>${leftTeam.name}</b> командасы <b>${leftDuration} сек</b> ичинде тезирээк бүтүрүп, ылдамдык боюнча утту!`;
            } else if (parseFloat(rightDuration) < parseFloat(leftDuration)) {
                winnerName = rightTeam.name;
                title.style.color = "#ff0055";
                winReason = `Эки команда тең бирдей туура жооп беришти, бирок <b>${rightTeam.name}</b> командасы <b>${rightDuration} сек</b> ичинде тезирээк бүтүрүп, ылдамдык боюнча утту!`;
            } else {
                winnerName = "ТЕҢ ЧЫГУУ";
                title.style.color = "#d4af37";
                winReason = `Керемет! Эки команда тең бирдей упай топтоп, бирдей убакытта бүтүрүштү. Күчтөр толугу менен тең салмакталды!`;
            }
        }

        title.innerText = (winnerName === "ТЕҢ ЧЫГУУ") ? "🤝 ТЕҢ ЧЫГУУ!" : `🏆 ${winnerName} ЖЕҢДИ!`;
        desc.innerHTML = `
            ${winReason} <br><br>
            📊 <b>Жыйынтык статистика:</b><br>
            • ${leftTeam.name}: <b>${leftTeam.correctCount} туура жооп</b> (${leftDuration} секунд)<br>
            • ${rightTeam.name}: <b>${rightTeam.correctCount} туура жооп</b> (${rightDuration} секунд)
        `;

        modal.style.display = 'flex';
    }
}

/**
 * Каньвас Рендеринг (Жогорку 55% экранда гана таза иштейт)
 */
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height * 0.7; // Каармандарды бир аз ылдыйыраак тууралоо
    const centerX = canvas.width / 2 + ropeOffset;

    // Асман фону
    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.65);
    skyGradient.addColorStop(0, '#0f2027');
    skyGradient.addColorStop(1, '#203a43');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.65);

    // Күн
    ctx.beginPath();
    ctx.arc(canvas.width * 0.85, canvas.height * 0.25, 35, 0, Math.PI * 2);
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ff00ff';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Жер катмары
    ctx.fillStyle = '#0a0a20';
    ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);
    
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.65);
    ctx.lineTo(canvas.width, canvas.height * 0.67);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Аркан
    ctx.beginPath();
    ctx.moveTo(30, centerY);
    ctx.lineTo(canvas.width - 30, centerY);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();

    // Кызыл маркер
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(centerX - 8, centerY - 20, 16, 40);
    
    // Орто сызык
    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.fillRect(canvas.width / 2 - 2, centerY - 35, 4, 70);

    // Командаларды тартуу (Борбордук жылышуу менен)
    drawTeam(canvas.width * 0.22 + ropeOffset * 0.4, centerY, '#00f0ff', `[${leftTeam.name}]`, false);
    drawTeam(canvas.width * 0.78 + ropeOffset * 0.4, centerY, '#ff0055', `[${rightTeam.name}]`, true);

    // Жылмакай физикалык инерция
    ropeOffset += (targetRopeOffset - ropeOffset) * 0.05;

    if (gameActive) {
        requestAnimationFrame(drawGame);
    }
}

function drawTeam(startX, centerY, color, teamName, isRightSide) {
    ctx.fillStyle = color;
    ctx.font = "bold 13px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(teamName, startX, centerY - 55);

    for (let i = 0; i < 3; i++) {
        let offsetX = isRightSide ? (i * 35) : -(i * 35);
        let x = startX + offsetX;
        let y = centerY;

        ctx.beginPath();
        ctx.arc(x, y - 30, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 5;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - 21);
        ctx.lineTo(x, y + 8);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y - 15);
        ctx.lineTo(startX, y);
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x - 8, y + 30);
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x + 8, y + 30);
        ctx.stroke();
    }
}
