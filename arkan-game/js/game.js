/**
 * /arkan-game/js/game.js
 * Аркан Тартыш оюнунун толук функционалдык кыймылдаткычы.
 * 60 FPS рендеринг, каармандардын физикалык анимациясы.
 */
import { physicsQuestions } from './questions.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Экранга ылайыкташтыруу
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Оюндун туруктуу механикалык абалы
let currentQuestionIndex = 0;
let score = 0;
let gameActive = true;

// Физикалык позициялар (Экрандын борборуна карата локалдаштырылган)
let ropeOffset = 0; // 0 - ортосу, минус - солго (Көк), плюс - оңго (Кызыл)
let targetRopeOffset = 0;

// Суроолорду аралаштыруу (Ар бир оюн кайталанбаш үчүн)
const shuffledQuestions = [...physicsQuestions].sort(() => Math.random() - 0.5);

/**
 * Оюндун графикасын (Жайлоо стилиндеги фонду жана каармандарды) тартуу
 */
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height * 0.65;
    const centerX = canvas.width / 2 + ropeOffset;

    // 1. Асман жана Күн фону
    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.6);
    skyGradient.addColorStop(0, '#0f2027');
    skyGradient.addColorStop(1, '#203a43');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.6);

    // Күн анимациясы
    ctx.beginPath();
    ctx.arc(canvas.width * 0.8, canvas.height * 0.2, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff00ff';
    ctx.fill();
    ctx.shadowBlur = 0; // Шадоуну өчүрүү (башка элементтерге таасир этпеши үчүн)

    // 2. Жер/Тоо катмары (Улуттук стилдеги жайлоо контуру)
    ctx.fillStyle = '#0a0a20';
    ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);
    
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.6);
    ctx.lineTo(canvas.width, canvas.height * 0.62);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 3. Арканды тартуу (Борбордук жылышууну эсепке алуу менен)
    ctx.beginPath();
    ctx.moveTo(50, centerY);
    ctx.lineTo(canvas.width - 50, centerY);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#d4af37'; // Алтын түстүү улуттук жип эффекти
    ctx.stroke();

    // Аркандын ортосундагы кызыл чүпүрөк (Тең салмактуулук көрсөткүчү)
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(centerX - 10, centerY - 25, 20, 50);
    
    // Инерция сызыгы (Жердеги борбордук маркер)
    ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.fillRect(canvas.width / 2 - 2, centerY - 40, 4, 80);

    // 4. КОМАНДА КӨК (Сиз - Сол тарап)
    drawTeam(canvas.width * 0.25 + ropeOffset * 0.5, centerY, '#00f0ff', '[БилимАл]', false);

    // 5. КОМАНДА КЫЗЫЛ (Робот - Оң тарап)
    drawTeam(canvas.width * 0.75 + ropeOffset * 0.5, centerY, '#ff0055', '[Каршылаш]', true);

    // Физикалык инерцияны жылмакай кылуу (Linear Interpolation)
    ropeOffset += (targetRopeOffset - ropeOffset) * 0.05;

    // Жеңиш же жеңилүү шарттарын текшерүү
    if (gameActive) {
        if (ropeOffset < -canvas.width * 0.2) {
            endGame(true);
        } else if (ropeOffset > canvas.width * 0.2) {
            endGame(false);
        }
    }

    requestAnimationFrame(drawGame);
}

/**
 * Каармандардын тобун вектордук чийүү
 */
function drawTeam(startX, centerY, color, teamName, isRightSide) {
    ctx.fillStyle = color;
    ctx.font = "bold 14px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(teamName, startX, centerY - 70);

    // 3 каармандын катар турушу
    for (let i = 0; i < 3; i++) {
        let offsetX = isRightSide ? (i * 45) : -(i * 45);
        let x = startX + offsetX;
        let y = centerY;

        // Башы
        ctx.beginPath();
        ctx.arc(x, y - 40, 12, 0, Math.PI * 2);
        ctx.fill();

        // Денеси
        ctx.lineWidth = 6;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - 28);
        ctx.lineTo(x, y + 10);
        ctx.stroke();

        // Колдору (Арканды кармап жаткан абалы)
        ctx.beginPath();
        ctx.moveTo(x, y - 20);
        ctx.lineTo(startX, y);
        ctx.lineWidth = 4;
        ctx.stroke();

        // Буттары
        ctx.beginPath();
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x - 10, y + 40);
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x + 10, y + 40);
        ctx.stroke();
    }
}

/**
 * Суроолорду UI катмарына чыгаруу логикасы
 */
function loadQuestion() {
    if (currentQuestionIndex >= shuffledQuestions.length) {
        // Эгер суроолор бүтсө, ким жакыныраак турганына карап жыйынтык чыгарат
        endGame(ropeOffset < 0);
        return;
    }

    const currentQuiz = shuffledQuestions[currentQuestionIndex];
    document.getElementById('questionText').innerText = currentQuiz.question;
    
    const answersGrid = document.getElementById('answersGrid');
    answersGrid.innerHTML = ''; // Эски суроолорду тазалоо

    currentQuiz.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.innerText = `${index + 1}) ${answer}`;
        button.onclick = () => handleAnswer(index, currentQuiz.correct);
        answersGrid.appendChild(button);
    });
}

/**
 * Жоопту текшерүү жана Ньютондун күч импульсун берүү
 */
function handleAnswer(selectedIndex, correctIndex) {
    if (!gameActive) return;

    if (selectedIndex === correctIndex) {
        score += 100;
        document.getElementById('scoreDisplay').innerText = score;
        // Ньютондун закону: Сиздин күч жогорулады, аркан солго (минус көздөй) жылат
        targetRopeOffset -= 120;
    } else {
        // Ката жооп: Каршылаштардын сүрүлүү күчү үстөмдүк кылып, оңго тартат
        targetRopeOffset += 100;
    }

    currentQuestionIndex++;
    
    // Кичине анимациялык тыныгуудан кийин кийинки суроону жүктөө
    const container = document.getElementById('quizContainer');
    container.style.transform = 'scale(0.95)';
    setTimeout(() => {
        container.style.transform = 'scale(1)';
        loadQuestion();
    }, 200);
}

/**
 * Оюнду токтотуу жана жыйынтык терезесин ачуу
 */
function endGame(isWin) {
    gameActive = false;
    document.getElementById('quizContainer').style.display = 'none';
    const modal = document.getElementById('resultModal');
    const title = document.getElementById('resultTitle');
    const desc = document.getElementById('resultDesc');

    if (isWin) {
        title.innerText = "ЖЕҢИШ! 🏆";
        title.style.color = "#00f0ff";
        desc.innerText = `Куттуктайбыз! Сиз Ньютондун закондорун жана күч векторлорун мыкты өздөштүрүп, өз командаңызды жеңишке алып келдиңиз. Жалпы топтолгон упайыңыз: ${score} упай.`;
    } else {
        title.innerText = "УТУЛУУ! ❌";
        title.style.color = "#ff0055";
        desc.innerText = `Тилекке каршы, каршылаш команданын тартуу күчү сиздин күчтөн ашып кетти. Физика эрежелерин кайрадан кайталап көрүүнү сунуштайбыз.`;
    }

    modal.style.display = 'flex';
}

// Кыймылдаткычты ишке киргизүү
loadQuestion();
requestAnimationFrame(drawGame);
