// --- 1. FIREBASE ЖӨНДӨӨЛӨРҮ (ЕВРОПА РЕГИОНУ) ---
const _p1 = "AIzaSyAs7_3V9vG";
const _p2 = "-67Xz-lR7pXF_N74bO8m0bVE";

const firebaseConfig = {
    apiKey: _p1 + _p2, 
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.appspot.com",
    messagingSenderId: "1039475820194",
    appId: "1:1039475820194:web:cd937b83d8e204c3"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.app().database("https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app");

// --- ГЛОБАЛДЫК ӨЗГӨРМӨЛӨР ---
const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject') || 'physics';
// ОҢДОО: Эгер шилтемеде 'kinematika_20' келсе, базадан 'kinematika' деп да издеп көрүү үчүн тазалайбыз
let theme = urlParams.get('theme') || 'kinematika_20';
let cleanTheme = theme.replace('_20', ''); 

let myRole = ""; 
let roomRef = null;
let roomCode = "";
let currentRoomData = null;
let playerName = "";

let questions = [];
let currentQuestionIdx = -1; 
let timerInterval = null;
let timeLeft = 20;
let isAnswered = false;

// Чыныгы 20 камдык суроо (Базадан эч нерсе келбей калган учурда гана кепилдик катары иштейт)
const mockQuestions = [
    { q: "Ылдамдыктын эл аралык бирдиги кандай?", a: "м/с", options: ["м/с", "км/саат", "м*с", "кг/м"] },
    { q: "Ньютондун экинчи мыйзамынын формуласы кайсы?", a: "F = ma", options: ["F = ma", "V = s/t", "E = mc²", "P = mv"] },
    { q: "Ылдамдануунун бирдиги кайсы?", a: "м/с²", options: ["м/с²", "м/с", "м*с", "км/саат"] },
    { q: "Нерсенин кыймыл Траекториясы деген эмне?", a: "Кыймылда калтырган сызыгы", options: ["Кыймылда калтырган сызыгы", "Басып өткөн жолу", "Ылдамдыктын багыты", "Убакыттын аралыгы"] },
    { q: "Материалдык чекит деп эмнени айтабыз?", a: "Өлчөмдөрүн эсепке албай койсо боло турган нерсе", options: ["Өлчөмдөрүн эсепке албай койсо боло турган нерсе", "Абдан кичинекей микроб", "Салмагы жок нерсе", "Формасы тегерек нерсе"] },
    { q: "Бир калыптагы түз сызыктуу кыймылдын формуласы кайсы?", a: "S = V * t", options: ["S = V * t", "A = F * S", "P = m * g", "E = m * v"] },
    { q: "Күчтүн өлчөө бирдиги кандай?", a: "Ньютон", options: ["Ньютон", "Джоуль", "Ватт", "Паскаль"] },
    { q: "Нерсенин массасынын өлчөө бирдиги кайсы?", a: "кг", options: ["кг", "грамм", "Ньютон", "метр"] },
    { q: "Эркин түшүүнүн ылдамдануусу (g) болжол менен канчага барабар?", a: "9.8 м/с²", options: ["9.8 м/с²", "5.5 м/с²", "12 м/с²", "0 м/с²"] },
    { q: "Ньютондун үчүнчү мыйзамы кандай айтылат?", a: "Аракетке каршы аракет барабар", options: ["Аракетке каршы аракет барабар", "F = ma", "Инерция мыйзамы", "Бүткүл дүйнөлүк тартылуу"] },
    { q: "Энергиянын өлчөө бирдиги кайсы?", a: "Джоуль", options: ["Джоуль", "Ватт", "Ньютон", "Вольт"] },
    { q: "Кубаттуулуктун өлчөө бирдиги кандай?", a: "Ватт", options: ["Ватт", "Джоуль", "Ампер", "Ом"] },
    { q: "Басымдын өлчөө бирдиги кайсы?", a: "Паскаль", options: ["Паскаль", "Ньютон", "Метр", "КГ"] },
    { q: "Токтун күчүн өлчөөчү курал кандай аталат?", a: "Амперметр", options: ["Амперметр", "Вольтметр", "Спидометр", "Динамометр"] },
    { q: "Каршылыктын өлчөө бирдиги кандай?", a: "Ом", options: ["Ом", "Вольт", "Ампер", "Ватт"] },
    { q: "Чыңалуунун өлчөө бирдиги кайсы?", a: "Вольт", options: ["Вольт", "Ом", "Ампер", "Джоуль"] },
    { q: "Импульстун формуласы кандай?", a: "P = m * v", options: ["P = m * v", "F = m * a", "E = m * g", "V = s / t"] },
    { q: "Тыгыздыктын формуласы кайсы?", a: "p = m / V", options: ["p = m / V", "F = m * a", "S = v * t", "m = p * V"] },
    { q: "Жарыктын боштуктагы (вакуумдагы) ылдамдыгы канча?", a: "300 000 км/с", options: ["300 000 км/с", "150 000 км/с", "340 м/с", "1000 км/саат"] },
    { q: "Сызыктуу ылдамдык менен бурчтук ылдамдыктын байланыш формуласы?", a: "V = w * R", options: ["V = w * R", "W = F * S", "P = m * g", "F = m * a"] }
];

const menuMusic = document.getElementById("bg-music-menu");
const gameMusic = document.getElementById("bg-music-game");

document.body.addEventListener('click', () => {
    if(menuMusic && menuMusic.paused && !roomRef) { menuMusic.play().catch(()=>{}); }
}, { once: true });

document.addEventListener("DOMContentLoaded", () => {
    const themeName = theme.replace('_', ' ').toUpperCase();
    const infoTxt = document.getElementById("quiz-info-text");
    if(infoTxt) {
        infoTxt.innerHTML = `<i class="fas fa-book-open text-amber-400 mr-1"></i> Багыт: <span class="text-white">${themeName}</span>`;
    }
    adjustHorseStyles();
    applyWhiteTrackBackground(); 
});

function applyWhiteTrackBackground() {
    const trackWrapper = document.querySelector(".border-2.border-amber-500\\/30");
    if (trackWrapper) {
        trackWrapper.style.backgroundColor = "#ffffff"; 
        trackWrapper.style.backgroundImage = "none";    
        trackWrapper.style.borderColor = "#fbbf24";     
    }
    const tracks = document.querySelectorAll(".border-b-2.border-dashed");
    tracks.forEach(track => { track.style.borderColor = "#e2e8f0"; });
}

function adjustHorseStyles() {
    const containers = ["jigit-track-container", "kyz-track-container"];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.className = "absolute transition-all duration-700 ease-out bg-white p-2 rounded-2xl shadow-lg border-2 border-amber-400 z-10";
            el.style.width = "140px";  
            el.style.height = "110px";
            const img = el.querySelector("img");
            if(img) img.className = "w-full h-full object-contain bg-white";
        }
    });
}

// --- БӨЛМӨ ТҮЗҮҮ (ЖИГИТ) ---
function createRoom() {
    playerName = document.getElementById("player-name").value.trim();
    if (!playerName) { alert("Сураныч, алгач атыңызды жазыңыз!"); return; }
    
    myRole = "jigit";
    roomCode = Math.floor(100 + Math.random() * 900).toString(); 
    roomRef = db.ref('rooms/' + roomCode);
    
    // ОҢДОО: Сиз жеке кабинеттен жөнөткөн суроолорду 'theme' же 'cleanTheme' аталыштары менен коштоп текшерип тартат
    db.ref(`quizzes/${subject}/${theme}`).once('value').then((snapshot) => {
        let fetchedQuestions = snapshot.val();
        if(!fetchedQuestions) {
            return db.ref(`quizzes/${subject}/${cleanTheme}`).once('value');
        }
        return snapshot;
    }).then((snapshot) => {
        let fetchedQuestions = snapshot.val();
        if (fetchedQuestions && !Array.isArray(fetchedQuestions)) {
            fetchedQuestions = Object.values(fetchedQuestions);
        }
        // Эгер жеке кабинеттен жиберген сурооңуз базадан такыр табылбай калса, 20 камдык суроо иштейт
        if(!fetchedQuestions || fetchedQuestions.length === 0) {
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
            turn: "jigit", 
            questions: fetchedQuestions
        });
    }).then(() => {
        initRoomListener();
        switchToArena();
    }).catch(err => {
        console.error(err);
        questions = mockQuestions;
        roomRef.set({
            roomCode: roomCode, subject: subject, theme: theme,
            jigitName: playerName, kyzName: "", jigitScore: 0, kyzScore: 0,
            jigitCurrentQuestion: 0, kyzCurrentQuestion: 0, status: "waiting",
            turn: "jigit", questions: mockQuestions
        }).then(() => {
            initRoomListener();
            switchToArena();
        });
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
        if(!snapshot.exists()) { return alert("Бул коддуу бөлмө табылган жок!"); }
        let data = snapshot.val();
        if(data.kyzName !== "") { return alert("Бул бөлмө толуп калган!"); }

        questions = data.questions || mockQuestions;
        return roomRef.update({ kyzName: playerName, status: "playing" });
    }).then(() => {
        initRoomListener();
        switchToArena();
    }).catch(err => alert("Кошулууда ката кетти!"));
}

function switchToArena() {
    document.getElementById("lobby-container").classList.add("hidden");
    document.getElementById("game-arena").classList.remove("hidden");
    document.getElementById("display-room-code").innerText = `БӨЛМӨ: ${roomCode}`;
    adjustHorseStyles();
    applyWhiteTrackBackground(); 
}

// --- СИНХРОНДУУ ТУТАШУУ ЛИСТЕНЕРИ ---
function initRoomListener() {
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if(!data) return;
        currentRoomData = data;

        if(data.questions) {
            questions = data.questions;
        }

        document.getElementById("jigit-name-lbl").innerText = data.jigitName || "...";
        document.getElementById("kyz-name-lbl").innerText = data.kyzName || "...";
        document.getElementById("jigit-score").innerText = data.jigitScore;
        document.getElementById("kyz-score").innerText = data.kyzScore;

        let totalQs = questions.length || 20;
        let stepPercent = 70 / totalQs; 

        let jigitLeft = 10 + (data.jigitScore * stepPercent); 
        let kyzLeft = 40 + (data.kyzScore * stepPercent);
        if(jigitLeft > 85) jigitLeft = 85;
        if(kyzLeft > 85) kyzLeft = 85;

        document.getElementById("jigit-track-container").style.left = `${jigitLeft}%`;
        document.getElementById("kyz-track-container").style.left = `${kyzLeft}%`;

        if(data.status === "waiting") {
            document.getElementById("game-status-text").innerText = "Кыздын кошулушун күтүүдө...";
        } 
        else if(data.status === "playing") {
            document.getElementById("game-status-text").innerText = "ЖАРЫШ АЛМАК-САЛМАК ЖҮРҮҮДӨ";
            
            if(menuMusic) menuMusic.pause();
            if(gameMusic && gameMusic.paused) { gameMusic.play().catch(()=>{}); }

            document.getElementById("quiz-box-container").classList.remove("hidden");
            
            let myTargetIndex = (myRole === "jigit") ? data.jigitCurrentQuestion : data.kyzCurrentQuestion;
            
            if (data.turn !== myRole) {
                if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
                document.getElementById("quiz-box-container").innerHTML = `
                    <div class="text-center py-12 text-sm font-bold text-amber-400 animate-pulse">
                        <i class="fas fa-hourglass-half fa-spin mr-2 text-lg"></i> Азыр каршылашыңыздын кезеги. Күтө туруңуз...
                    </div>`;
                currentQuestionIdx = -1;
            } else {
                if (myTargetIndex !== currentQuestionIdx) {
                    currentQuestionIdx = myTargetIndex;
                    showQuestion();
                }
            }
        } 
        else if(data.status === "finished") {
            endGame(data);
        }
        applyWhiteTrackBackground(); 
    });
}

function showQuestion() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    if(currentQuestionIdx >= questions.length) {
        document.getElementById("quiz-box-container").innerHTML = `
            <div class="text-center py-12 text-sm font-bold text-gray-400">
                <i class="fas fa-flag-checkered mr-2 text-lg text-emerald-400"></i> Сиз бардык суроолорго жооп бердиңиз! Оюн жыйынтыгын күтүүдөсүз...
            </div>`;
        checkGameEndCondition();
        return;
    }

    isAnswered = false;
    timeLeft = 20;

    let qData = questions[currentQuestionIdx];
    
    document.getElementById("quiz-box-container").innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <span id="question-number-lbl" class="text-xs font-bold tracking-widest text-amber-400 uppercase">Суроо №${currentQuestionIdx + 1}</span>
            <span id="timer-lbl" class="text-xs font-bold text-rose-400 bg-rose-950/40 px-3 py-1 rounded-full border border-rose-800/30">Убакыт: 20с</span>
        </div>
        <h3 id="question-text" class="text-base font-bold text-white leading-relaxed mb-6">${qData.q}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button id="opt-0" onclick="submitAnswer(0)" class="option-btn p-5 rounded-2xl text-left text-sm font-semibold text-gray-200 transition-all">${qData.options[0] || ''}</button>
            <button id="opt-1" onclick="submitAnswer(1)" class="option-btn p-5 rounded-2xl text-left text-sm font-semibold text-gray-200 transition-all">${qData.options[1] || ''}</button>
            <button id="opt-2" onclick="submitAnswer(2)" class="option-btn p-5 rounded-2xl text-left text-sm font-semibold text-gray-200 transition-all">${qData.options[2] || ''}</button>
            <button id="opt-3" onclick="submitAnswer(3)" class="option-btn p-5 rounded-2xl text-left text-sm font-semibold text-gray-200 transition-all">${qData.options[3] || ''}</button>
        </div>
    `;

    timerInterval = setInterval(() => {
        timeLeft--;
        const tLbl = document.getElementById("timer-lbl");
        if(tLbl) tLbl.innerText = `Убакыт: ${timeLeft}с`;
        if(timeLeft <= 0) {
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            autoSubmitWrong();
        }
    }, 1000);
}

function submitAnswer(selectedIdx) {
    if(isAnswered) return;
    isAnswered = true;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    let qData = questions[currentQuestionIdx];
    let chosenOption = qData.options[selectedIdx];
    let isCorrect = (chosenOption === qData.a);

    let btn = document.getElementById(`opt-${selectedIdx}`);
    if(btn) {
        if(isCorrect) {
            btn.className = "p-5 rounded-2xl text-left text-sm font-bold bg-emerald-600 text-black";
        } else {
            btn.className = "p-5 rounded-2xl text-left text-sm font-bold bg-rose-600 text-white";
        }
    }

    for(let i=0; i<4; i++) { 
        let b = document.getElementById(`opt-${i}`);
        if(b) b.disabled = true; 
    }

    setTimeout(() => {
        let nextTurn = (myRole === "jigit") ? "kyz" : "jigit"; 
        let updates = {};
        
        updates['turn'] = nextTurn;
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
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    let nextTurn = (myRole === "jigit") ? "kyz" : "jigit";
    let updates = {};
    updates['turn'] = nextTurn;
    if(myRole === "jigit") { updates['jigitCurrentQuestion'] = currentQuestionIdx + 1; } 
    else { updates['kyzCurrentQuestion'] = currentQuestionIdx + 1; }
    roomRef.update(updates);
}

function checkGameEndCondition() {
    if(!currentRoomData) return;
    if(currentRoomData.jigitCurrentQuestion >= questions.length && currentRoomData.kyzCurrentQuestion >= questions.length) {
        if(myRole === "jigit") {
            // ОҢДОО: Тең чыгуу логикасы толугу менен өчүрүлдү. Түз эле оюнду бүтүрүүгө багытталат.
            roomRef.update({ status: "finished" });
        }
    }
}

function endGame(data) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if(gameMusic) gameMusic.pause();
    
    const modal = document.getElementById("result-modal");
    const msgLbl = document.getElementById("result-message-text");
    
    if(modal && msgLbl) {
        document.getElementById("res-jigit-score").innerText = data.jigitScore;
        document.getElementById("res-kyz-score").innerText = data.kyzScore;

        // ОҢДОО: Жигиттин упайы ашып кетсе гана жеңет. Тең чыкса же Кыздын упайы көп болсо - Кыз качып кеткен болот (Жигит утулат).
        if(data.jigitScore > data.kyzScore) {
            msgLbl.innerHTML = `<b class="text-orange-400">${data.jigitName}</b> деген жигит <b class="text-pink-400">${data.kyzName}</b> деген кызга жетти! 🎉`;
        } else {
            msgLbl.innerHTML = `<b class="text-orange-400">${data.jigitName}</b> деген жигиттен <b class="text-pink-400">${data.kyzName}</b> деген кыз качып кетти! 🐎💨`;
        }
        modal.classList.remove("hidden");
    }
}
