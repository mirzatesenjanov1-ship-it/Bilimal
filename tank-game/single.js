// ============================================================================
// 🎮 TANK BATTLE 2D — ОЮНДУН НЕГИЗГИ ӨЗГӨРМӨЛӨРҮ ЖАНА ЛОГИКАСЫЫ
// ============================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isGameRunning = false; // Оюндун активдүүлүк абалы (Жарнама учурунда false болот)
let playerLives = 3;       // Оюнчунун баштапкы өмүрү
let score = 0;

// Оюнду алгачкы жолу иштетүү (Же менюдан киргендеги башталыш)
function initGame() {
    playerLives = 3;
    score = 0;
    
    // Түз эле баштабай, алгач 7 секунддук жарнама көрсөтөбүз (Pre-roll Ad)
    showAdOverlay("Оюн башталууда...", () => {
        isGameRunning = true;
        gameLoop(); // Оюндун негизги циклин чакыруу
    });
}

// Оюндун туруктуу иштөө цикли (Катпоо үчүн маанилүү бөлүк!)
function gameLoop() {
    if (!isGameRunning) return; // Эгер жарнама иштеп жатса, бул цикл эч нерсе эсептебейт (FPS түшпөйт)

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // [Сиздин оюнуңуздун рендеринг коддору ушул жерде болот]
    // Мисалы: drawPlayer(), drawEnemies(), checkCollisions() ж.б.

    // Оюндун интерфейсин тартуу (Өмүр жана упай)
    ctx.fillStyle = "#fff";
    ctx.font = "20px Segoe UI";
    ctx.fillText(`ӨМҮР: ${playerLives}`, 20, 30);
    ctx.fillText(`УПАЙ: ${score}`, canvas.width - 120, 30);

    // Оюнчу утулуп калгандагы шартты текшерүү
    if (playerLives <= 0) {
        triggerGameOver(); 
        return; // Циклди токтотуу
    }

    requestAnimationFrame(gameLoop);
}

// ============================================================================
// 💰 ADSTERRA ЖАРНАМАСЫН БАШКАРУУ ЖАНА КАТПОО КЕПИЛДИГИ (ИНТЕГРАЦИЯ)
// ============================================================================
function showAdOverlay(titleText, callbackOnEnd) {
    // 1. Оюнду дароо тындыруу (Жарнама убагында JS процессорду бошотот)
    isGameRunning = false; 

    const overlay = document.getElementById('ad-interstitial-overlay');
    const timerText = document.getElementById('ad-timer-text');
    const screenTitle = document.getElementById('ad-screen-title');

    screenTitle.innerText = titleText;
    overlay.style.display = 'flex'; // Жарнама экранын ачуу

    let timeLeft = 7; // Сиз сураган 7 секунддук убакыт
    timerText.innerText = `Оюн уланууга: ${timeLeft} сек...`;

    // Таймердин артка эсептөөсү
    const adCountdown = setInterval(() => {
        timeLeft--;
        timerText.innerText = `Оюн уланууга: ${timeLeft} сек...`;

        if (timeLeft <= 0) {
            clearInterval(adCountdown);
            overlay.style.display = 'none'; // Жарнаманы жабуу
            
            // 2. Жарнама бүткөндөн кийин гана оюндун циклдерин кайра жандыруу
            callbackOnEnd(); 
        }
    }, 1000);
}

// 💀 ОЮНЧУ УТУЛГАНДА ЖАРНАМАНЫ ЧАКЫРУУ (Жашоо калыбына келтирүү же өчүрүү)
function triggerGameOver() {
    isGameRunning = false; // Оюн токтотулду

    // Экранга "Утулдуңуз!" деген текст менен жарнама чыгаруу
    showAdOverlay("ОЮН БҮТТҮ! Сиз утулдуңуз 💥", () => {
        // Жарнама көрүп бүткөндөн кийин колдонуучуга кошумча өмүр берип оюнду улантуу
        alert("Рахмат! Сизге +3 кошумча өмүр берилди. Согушту улантыңыз!");
        playerLives = 3;
        isGameRunning = true;
        gameLoop(); // Оюнду калыбына келтирүү
    });
}

// Оюнду иштетүү
initGame();
