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

// КҮЧӨТҮЛГӨН ОҢДОО: Мугалимдин жеке кабинетинен келген каалаган форматтагы (объект же массив) суроолорду тазалап иретөө функциясы
function parseFirebaseQuestions(rawData) {
    if (!rawData) return [];
    
    // Эгер түз эле массив болсо
    if (Array.isArray(rawData)) {
        return rawData.filter(q => q && (q.q || q.question));
    }
    
    // Эгер объект болсо (мугалимдердин IDлери же кокустук ачкычтар менен сакталса)
    let list = Object.values(rawData);
    
    // Эгер ички катмарда дагы объект болуп кетсе (мисалы: { questions: { ... } })
    if (list.length === 1 && typeof list[0] === 'object' && !list[0].q) {
        list = Object.values(list[0]);
    }
    
    // Суроолордун талааларын бирдей стандартка келтирүү (q: суроо, a: жооп, options: варианттар)
    return list.map(item => {
        if (!item) return null;
        return {
            q: item.q || item.question || "",
            a: item.a || item.answer || item.correct || "",
            options: item.options || item.variants || [item.a, item.b, item.c, item.d].filter(Boolean)
        };
    }).filter(q => q.q && q.options && q.options.length > 0);
}

// --- БӨЛМӨ ТҮЗҮҮ (ЖИГИТ) ---
function createRoom() {
    playerName = document.getElementById("player-name").value.trim();
    if (!playerName) { alert("Сураныч, алгач атыңызды жазыңыз!"); return; }
    
    myRole = "jigit";
    roomCode = Math.floor(100 + Math.random() * 900).toString(); 
    roomRef = db.ref('rooms/' + roomCode);
    
    // Жеке кабинеттеги эки мүмкүн болгон жолду тең текшерип суроону синхрондуу тартабыз
    db.ref(`quizzes/${subject}/${theme}`).once('value').then((snapshot) => {
        let data = snapshot.val();
        if (!data) {
            return db.ref(`quizzes/${subject}/${cleanTheme}`).once('value');
        }
        return snapshot;
    }).then((snapshot) => {
        let fetchedQuestions = parseFirebaseQuestions(snapshot.val());
        
        if (!fetchedQuestions || fetchedQuestions.length === 0) {
            alert("Ката: Жеке кабинеттен жиберилген тема табылган жок же түзүмү туура эмес! Базаңызды текшериңиз.");
            return;
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
            isExtraRound: false,
            questions: fetchedQuestions
        });
    }).then(() => {
        initRoomListener();
        startLiveQuizSync(); // Мугалимдердин жеке кабинетин түз угуу режимин иштетүү
        switchToArena();
    }).catch(err => {
        console.error(err);
        alert("Бөлмө түзүүдө ката кетти. Кайра аракет кылыңыз.");
    });
}

// ОҢДОО: Оюндан чыкпай туруп жеке кабинеттеги теманы реалдуу убакытта синхрондоштуруу кайтарым байланышы
function startLiveQuizSync() {
    db.ref(`quizzes/${subject}/${theme}`).on('value', (snapshot) => {
        let list = parseFirebaseQuestions(snapshot.val());
        if (list.length > 0 && roomRef) { questions = list; roomRef.update({ questions: list }); }
    });
    db.ref(`quizzes/${subject}/${cleanTheme}`).on('value', (snapshot) => {
        let list = parseFirebaseQuestions(snapshot.val());
        if (list.length > 0 && roomRef) { questions = list; roomRef.update({ questions: list }); }
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

        questions = parseFirebaseQuestions(data.questions);
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
            questions = parseFirebaseQuestions(data.questions);
        }

        document.getElementById("jigit-name-lbl").innerText = data.jigitName || "...";
        document.getElementById("kyz-name-lbl").innerText = data.kyzName || "...";
        document.getElementById("jigit-score").innerText = data.jigitScore;
        document.getElementById("kyz-score").innerText = data.kyzScore;

        // ОҢДОО: Мугалимдин жеке кабинетинен канча суроо келсе (мисалы 20), аттардын кадамдары ошого жараша ийкемдүү өзгөрөт
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
            document.getElementById("game-status-text").innerText = data.isExtraRound ? "КОШУМЧА РАУНД! ТЕҢ ЧЫГУУ СЕБЕПТҮҮ ЖАРЫШ УЛАНУУДА" : "ЖАРЫШ АЛМАК-САЛМАК ЖҮРҮҮДӨ";
            
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
                <i class="fas fa-flag-checkered mr-2 text-lg text-emerald-400"></i> Жооп берип бүттүңүз. Каршылашыңыздын жыйынтыгын күтүүдөсүз...
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

// ОҢДОО: Экөө тең бирдей туура жооп берген учурда кошумча раунддун (суроолордун) берилишин көзөмөлдөө
function checkGameEndCondition() {
    if(!currentRoomData) return;
    if(currentRoomData.jigitCurrentQuestion >= questions.length && currentRoomData.kyzCurrentQuestion >= questions.length) {
        if(myRole === "jigit") {
            if(currentRoomData.jigitScore === currentRoomData.kyzScore) {
                // Кошумча раунд үчүн жаңы суроолор тизмеси
                let extraQs = [
                    { q: "КОШУМЧА РАУНД: Төмөнкүлөрдүн ичинен кайсынысы скалярдык чоңдук?", a: "Убакыт", options: ["Убакыт", "Күч", "Ылдамдык", "Ылдамдануу"] },
                    { q: "КОШУМЧА РАУНД: Атмосфералык басымды өлчөөчү курал кандай аталат?", a: "Барометр", options: ["Барометр", "Термометр", "Динамометр", "Манометр"] },
                    { q: "КОШУМЧА РАУНД: Нерсенин ички энергиясын өзгөртүүнүн канча жолу бар?", a: "2", options: ["2", "1", "3", "4"] }
                ];
                roomRef.update({
                    status: "playing",
                    isExtraRound: true,
                    turn: "jigit",
                    jigitCurrentQuestion: 0, 
                    kyzCurrentQuestion: 0,   
                    questions: extraQs       
                });
            } else {
                roomRef.update({ status: "finished" });
            }
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

        if(data.jigitScore > data.kyzScore) {
            msgLbl.innerHTML = `<b class="text-orange-400">${data.jigitName}</b> деген жигит <b class="text-pink-400">${data.kyzName}</b> деген кызга жетти! 🎉`;
        } else {
            msgLbl.innerHTML = `<b class="text-orange-400">${data.jigitName}</b> деген жигиттен <b class="text-pink-400">${data.kyzName}</b> деген кыз качып кетти! 🐎💨`;
        }
        modal.classList.remove("hidden");
    }
}
