/**
 * /arkan-game/js/game.js
 * Аркан Тартыш оюнунун башкы кыймылдаткычы (Game Engine).
 * Canvas API аркылуу 60 FPS анимацияны жана рендерингди камсыздайт.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Экрандын өлчөмүнө жараша Canvas'ты тууралоо (100% Responsive)
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Оюндун абалын сактоочу объект
const gameState = {
    isRunning: true,
    score: 0,
    ropePosition: canvas.width / 2 // Аркандын ортосу экрандын ортосунда
};

/**
 * Оюндун башкы рендеринг цикли (Game Loop)
 */
function gameLoop() {
    if (!gameState.isRunning) return;

    // 1. Экранды тазалоо (ар бир кадр сайын)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Убактылуу: Арканды чийүү (Кийинчерээк бул жерге RopePhysics кошулат)
    ctx.beginPath();
    ctx.moveTo(100, canvas.height / 1.5); // Сол команданын колу
    ctx.lineTo(canvas.width - 100, canvas.height / 1.5); // Оң команданын колу
    ctx.lineWidth = 15;
    ctx.strokeStyle = '#8B4513'; // Күрөң аркан түсү
    ctx.stroke();

    // Ортоңку белги (Кызыл чүпүрөк)
    ctx.fillStyle = 'red';
    ctx.fillRect(gameState.ropePosition - 10, (canvas.height / 1.5) - 20, 20, 40);

    // 3. Кийинки кадрды чакыруу (60 FPS камсыз кылуу)
    requestAnimationFrame(gameLoop);
}

// Оюнду баштоо
console.log("Аркан Тартыш симуляциясы ишке кирди (Clean Code Architecture).");
requestAnimationFrame(gameLoop);
