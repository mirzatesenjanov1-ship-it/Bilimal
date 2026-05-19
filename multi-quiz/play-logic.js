// --- 1. FIREBASE ЖӨНДӨӨЛӨРҮ ---
// Өзүңүздүн Firebase долбоордун маалыматтарын ушул жерге жазыңыз
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Проектти ишке киргизүү
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// --- ГЛОВАЛДЫК ӨЗГӨРМӨЛӨР ---
const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject') || 'physics';
const theme = urlParams.get('theme') || 'kinematika_20';

let myRole = ""; 
let roomRef = null;
let roomCode = "";
let currentRoomData = null;
let playerName = "";

let questions = [];
let currentQuestionIdx = 0;
let timerInterval = null;
let timeLeft = 20;
let isAnswered = false;

const mockQuestions = [
    { q: "Ылдамдыктын эл аралык бирдиги кандай?", a: "м/с", options: ["м/с", "км/саат", "м*с", "кг/м"] },
    { q: "Ньютондун экинчи мыйзамынын формуласы кайсы?", a: "F = ma", options: ["F = ma", "V = s/t", "E = mc²", "P = mv"] }
];

const menuMusic = document.getElementById("bg-music-menu");
const gameMusic = document.getElementById("bg-music-game");

// Музыканы иштетүү
document.body.addEventListener('click', () => {
    if(menuMusic && menuMusic.paused && !roomRef) { menuMusic.play().catch(()=>{}); }
}, { once: true });

document.addEventListener("DOMContentLoaded", () => {
    const themeName = theme.replace('_', ' ').toUpperCase();
    const infoTxt = document.getElementById("quiz-info-text");
    if(infoTxt) {
        infoTxt.innerHTML = `<i class="fas fa-book-open text-amber-400 mr-1"></i> Багыт: <span class="text-white">${themeName}</span>`;
    }
});

// --- БӨЛМӨ ТҮЗҮҮ (ЖИГИТ) ---
function createRoom() {
    playerName = document.getElementById("player-name").value.trim();
    if (!playerName) { alert("Сураныч, алгач атыңызды жазыңыз!"); return; }
    
    myRole = "jigit";
    roomCode = Math.floor(100 + Math.random() * 900).toString(); // 3 орундуу коопсуз код
    roomRef = db.ref('rooms/' + roomCode);
    
    db.ref(`quizzes/${subject}/${theme}`).once('value').then((snapshot) => {
        let fetchedQuestions = snapshot.val();
        if(!fetchedQuestions || !Array.isArray(fetchedQuestions)) {
            fetchedQuestions = mockQuestions; 
        }
        questions = fetchedQuestions;

        return roomRef.set({
            roomCode: roomCode,
            subject: subject,
            theme: theme,
            jigitName: playerName,
            kyzName: "",
            jigitScore: 0,
            kyzScore: 0,
            jigitCurrentQuestion: 0,
            kyzCurrentQuestion: 0,
            status: "waiting",
            isExtraRound: false,
            questions: fetchedQuestions
        });
    }).then(() => {
        initRoomListener();
        switchToArena();
    }).catch(err => {
        console.error("Firebase катасы:", err);
        alert("Firebase маалымат базасына туташууда ката кетти. Сураныч Config текшериңиз!");
    });
}

// --- БӨЛМӨГӨ КИРҮҮ (КЫЗ) ---
function joinRoom() {
    playerName = document.getElementById("player-name").value.trim();
    roomCode = document.getElementById("room-code-input").value.trim();
    
    if (!playerName) { alert("Сураныч, атыңызды жазыңыз!"); return; }
    if (!roomCode) { alert("Бөлмө кодун киргизиңиз!"); return; }

    myRole = "kyz";
    roomRef = db.ref('rooms/' + roomCode);

    roomRef.once('value').then((snapshot) => {
        if(!snapshot.exists()) {
            alert("Бул коддуу бөлмө табылган жок!");
            return;
        }
        let data = snapshot.val();
        if(data.kyzName !== "") {
            alert("Бул бөлмө толуп калган!");
            return;
        }

        questions = data.questions || mockQuestions;

        return roomRef.update({
            kyzName: playerName,
            status: "playing"
        });
    }).then(() => {
        initRoomListener();
        switchToArena();
    }).catch(err => alert("Кошулууда ката кетти!"));
}

function switchToArena() {
    document.getElementById("lobby-container").classList.add("hidden");
    document.getElementById("game-arena").classList.remove("hidden");
    document.getElementById("display-room-code").innerText = `БӨЛМӨ: ${roomCode}`;
}

function initRoomListener() {
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if(!data) return;
        currentRoomData = data;

        document.getElementById("jigit-name-lbl").innerText = data.jigitName || "...";
        document.getElementById("kyz-name-lbl").innerText = data.kyzName || "...";
        document.getElementById("jigit-score").innerText = data.jigitScore;
        document.getElementById("kyz-score").innerText = data.kyzScore;

        let jigitLeft = 10 + (data.jigitScore * 4.2);
        let kyzLeft = 45 + (data.kyzScore * 2.5);

        document.getElementById("jigit-track-container").style.left = `${jigitLeft}%`;
        document.getElementById("kyz-track-container").style.left = `${kyzLeft}%`;

        if(data.status === "waiting") {
            document.getElementById("game-status-text").innerText = "Кыздын кошулушун күтүүдө...";
        } 
        else if(data.status === "playing") {
            document.getElementById("game-status-text").innerText = data.isExtraRound ? "КОШУМЧА РАУНД! ТЕҢ ЧЫГУУ" : "ЖАРЫШ БАШТАЛДЫ!";
            
            if(menuMusic) menuMusic.pause();
            if(gameMusic && gameMusic.paused) { gameMusic.play().catch(()=>{}); }

            document.getElementById("quiz-box-container").classList.remove("hidden");
            
            let myTargetIndex = (myRole === "jigit") ? data.jigitCurrentQuestion : data.kyzCurrentQuestion;
            if(myTargetIndex !== currentQuestionIdx || (currentQuestionIdx === 0 && !timerInterval)) {
                currentQuestionIdx = myTargetIndex;
                showQuestion();
            }
        } 
        else if(data.status === "finished") {
            endGame(data);
        }
    });
}

function showQuestion() {
    if(currentQuestionIdx >= questions.length) {
        document.getElementById("quiz-box-container").innerHTML = `
            <div class="text-center py-8 text-sm font-bold text-gray-300 animate-pulse">
                <i class="fas fa-spinner fa-spin mr-2"></i> Каршылашыңыз тестти бүтүрүшүн күтүп жатасыз...
            </div>`;
        checkGameEndCondition();
        return;
    }

    isAnswered = false;
    clearInterval(timerInterval);
    timeLeft = 20;
    document.getElementById("timer-lbl").innerText = `Убакыт: ${timeLeft}с`;

    let qData = questions[currentQuestionIdx];
    document.getElementById("question-number-lbl").innerText = `Суроо №${currentQuestionIdx + 1}`;
    document.getElementById("question-text").innerText = qData.q;

    for(let i=0; i<4; i++) {
        let btn = document.getElementById(`opt-${i}`);
        btn.innerText = qData.options[i];
        btn.className = "option-btn p-5 rounded-2xl text-left text-sm font-semibold text-gray-200 transition-all";
        btn.disabled = false;
    }

    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("timer-lbl").innerText = `Убакыт: ${timeLeft}с`;
        if(timeLeft <= 0) {
            clearInterval(timerInterval);
            autoSubmitWrong();
        }
    }, 1000);
}

function submitAnswer(selectedIdx) {
    if(isAnswered) return;
    isAnswered = true;
    clearInterval(timerInterval);

    let qData = questions[currentQuestionIdx];
    let chosenOption = qData.options[selectedIdx];
    let isCorrect = (chosenOption === qData.a);

    let btn = document.getElementById(`opt-${selectedIdx}`);
    if(isCorrect) {
        btn.className = "p-5 rounded-2xl text-left text-sm font-bold bg-emerald-600 text-black";
    } else {
        btn.className = "p-5 rounded-2xl text-left text-sm font-bold bg-rose-600 text-white";
    }

    for(let i=0; i<4; i++) { document.getElementById(`opt-${i}`).disabled = true; }

    setTimeout(() => {
        let updates = {};
        if(myRole === "jigit") {
            updates['jigitCurrentQuestion'] = currentQuestionIdx + 1;
            if(isCorrect) updates['jigitScore'] = currentRoomData.jigitScore + 1;
        } else {
            updates['kyzCurrentQuestion'] = currentQuestionIdx + 1;
            if(isCorrect) updates['kyzScore'] = currentRoomData.kyzScore + 1;
        }
        roomRef.update(updates);
    }, 800);
}

function autoSubmitWrong() {
    isAnswered = true;
    let updates = {};
    if(myRole === "jigit") { updates['jigitCurrentQuestion'] = currentQuestionIdx + 1; } 
    else { updates['kyzCurrentQuestion'] = currentQuestionIdx + 1; }
    roomRef.update(updates);
}

function checkGameEndCondition() {
    if(!currentRoomData) return;
    if(currentRoomData.jigitCurrentQuestion >= questions.length && currentRoomData.kyzCurrentQuestion >= questions.length) {
        if(myRole === "jigit") {
            if(currentRoomData.jigitScore === currentRoomData.kyzScore) {
                let extraQs = [
                    { q: "КОШУМЧА РАУНД: Күчтүн бирдиги эмне?", a: "Ньютон", options: ["Ньютон", "Джоуль", "Паскаль", "Ватт"] }
                ];
                let newQuestionSet = questions.concat(extraQs);
                roomRef.update({
                    status: "playing",
                    isExtraRound: true,
                    questions: newQuestionSet
                });
            } else {
                roomRef.update({ status: "finished" });
            }
        }
    }
}

function endGame(data) {
    clearInterval(timerInterval);
    if(gameMusic) gameMusic.pause();
    
    const modal = document.getElementById("result-modal");
    const msgLbl = document.getElementById("result-message-text");
    
    document.getElementById("res-jigit-score").innerText = data.jigitScore;
    document.getElementById("res-kyz-score").innerText = data.kyzScore;

    if(data.jigitScore > data.kyzScore) {
        msgLbl.innerHTML = `<b class="text-orange-400">${data.jigitName}</b> деген жигит <b class="text-pink-400">${data.kyzName}</b> деген кызга жетти! 🎉`;
    } else {
        msgLbl.innerHTML = `<b class="text-orange-400">${data.jigitName}</b> деген жигиттен <b class="text-pink-400">${data.kyzName}</b> деген кыз качып кетти! 🐎💨`;
    }
    modal.classList.remove("hidden");
}
