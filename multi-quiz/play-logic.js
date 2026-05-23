// --- 1. FIREBASE ЖӨНДӨӨЛӨРҮ (ЕВРОПА РЕГИОНУ КАТУУ КӨРСӨТҮЛДҮ) ---
const _p1 = "AIzaSyAs7_3V9vG";
const _p2 = "-67Xz-lR7pXF_N74bO8m0bVE";
const DB_URL = "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app";

const firebaseConfig = {
    apiKey: _p1 + _p2, 
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: DB_URL,
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.appspot.com",
    messagingSenderId: "1039475820194",
    appId: "1:1039475820194:web:cd937b83d8e204c3"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
// Европа региону үчүн эң ишенимдүү туташуу форматы
const db = firebase.app().database(DB_URL);

// --- АВТОРИЗАЦИЯНЫ КӨЗӨМӨЛДӨӨ (ЖАҢЫ ТОЛУКТОО) ---
// Мугалим өз кабинетинен Кыз Куумайга киргенде анын сессиясын таануу үчүн
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("Мугалим сессиясы аныкталды:", user.uid);
        localStorage.setItem("teacherUid", user.uid);
    } else {
        console.log("Учурдагы колдонуучу: Окуучу режими");
    }
});

// --- 2. ШИЛТЕМЕДЕГИ КЫРГЫЗЧА СӨЗДӨРДҮ ДАТАБАЗАГА ЫЛАЙЫКТАП КОТОРУУ (УНИВЕРСАЛДУУ ФИЛЬТР) ---
const urlParams = new URLSearchParams(window.location.search);
const rawSubject = urlParams.get('subject') || 'physics';
const rawTheme = urlParams.get('theme') || 'kinematika_20';

// Firebase папкаларынын аттарында кириллица жана пробел ката бербеши үчүн латынчага транслитерациялоо
function safeFirebasePath(text) {
    if (!text) return 'default';
    let converted = text.toLowerCase().trim();
    
    const dict = {
        'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'ё':'yo', 'ж':'zh', 
        'з':'z', 'и':'i', 'й':'y', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'ң':'ng', 
        'о':'o', 'ө':'o', 'п':'p', 'р':'r', 'с':'s', 'т':'t', 'у':'u', 'ү':'u', 
        'ф':'f', 'х':'h', 'ц':'ts', 'ч':'ch', 'ш':'sh', 'щ':'shch', 'ы':'y', 
        'э':'e', 'ю':'yu', 'я':'ya'
    };
    
    let result = '';
    for (let char of converted) {
        if (dict[char] !== undefined) {
            result += dict[char];
        } else if (/[a-z0-9_]/.test(char)) {
            result += char;
        } else if (char === ' ' || char === '-' || char === '_') {
            result += '_';
        }
        // Кашаалар () жана башка белгилер автоматтык түрдө тазаланат
    }
    return result.replace(/__+/g, '_').replace(/^_+|_+$/g, '');
}

// Тазаланган коопсуз папка аттары
const subject = safeFirebasePath(rawSubject);
const theme = safeFirebasePath(rawTheme);

let cleanTheme = theme.replace('_20', ''); 
let spaceTheme = theme.replace(/_/g, ' ');

// --- ГЛОБАЛДЫК ӨЗГӨРМӨЛӨР ---
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
    // Экранга теманын атын кооз кылып чыгаруу (Шилтемеден келген оригиналдуу текстти колдонобуз)
    const themeName = rawTheme.toUpperCase();
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

// Базадан келген маалымат узун текст же объект түрүндө болсо да тазалап массивге айландыруучу фильтр
function parseFirebaseQuestions(rawData) {
    if (!rawData) return [];
    
    if (Array.isArray(rawData)) {
        return rawData.filter(q => q && (q.q || q.question));
    }
    
    let list = Object.values(rawData);
    if (list.length === 1 && typeof list[0] === 'object' && !list[0].q) {
        list = Object.values(list[0]);
    }
    
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
    
    // КҮЧӨТҮЛГӨН ИЗДӨӨ: Базадан теманы коопсуз транслитерация болгон форматтарда издейт
    let paths = [
        `quizzes/${subject}/${theme}`,
        `quizzes/${subject}/${cleanTheme}`,
        `quizzes/${subject}/${spaceTheme}`,
        `quizzes/${subject}`,
        `quizzes/physics/kinematika_20` // Резервдик демейки тема
    ];

    let checkPath = (index) => {
        if (index >= paths.length) {
            return db.ref(`quizzes/${subject}`).once('value').then(snap => {
                let allData = snap.val();
                if (allData) {
                    let firstKey = Object.keys(allData)[0];
                    return parseFirebaseQuestions(allData[firstKey]);
                }
                return [];
            });
        }

        return db.ref(paths[index]).once('value').then(snapshot => {
            let parsed = parseFirebaseQuestions(snapshot.val());
            if (parsed && parsed.length > 0) {
                return parsed; 
            }
            return checkPath(index + 1); 
        });
    };

    checkPath(0).then((fetchedQuestions) => {
        if (!fetchedQuestions || fetchedQuestions.length === 0) {
            alert("Ката: Бул предмет боюнча базада эч кандай тест табылган жок. Жеке кабинеттен кайра сактап көрүңүз.");
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
        switchToArena();
    }).catch(err => {
        console.error(err);
        alert("Бөлмө түзүүдө ката кетти. Сураныч, Firebase коопсуздук эрежелерин (Rules) ачык экенин текшериңиз.");
    });
}

// --- БӨЛМӨГӨ КИРҮҮ (КЫЗ) ---
function joinRoom() {
    playerName = document.getElementById("player-name").value.trim();
    roomCode = document.getElementById("room-code-input").value.trim();
    
    if (!playerName) { alert("Сураныч, атыңызды жазыңыз!"); return; }
    if (!roomCode) { alert("Бөлмө кодут киргизиңиз!"); return; }

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
    const lobby = document.getElementById("lobby-container");
    const arena = document.getElementById("game-arena");
    const codeDisplay = document.getElementById("display-room-code");
    
    if(lobby) lobby.classList.add("hidden");
    if(arena) arena.classList.remove("hidden");
    if(codeDisplay) codeDisplay.innerText = `БӨЛМӨ: ${roomCode}`;
    
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

        const jName = document.getElementById("jigit-name-lbl");
        const kName = document.getElementById("kyz-name-lbl");
        const jScore = document.getElementById("jigit-score");
        const kScore = document.getElementById("kyz-score");
        const statusTxt = document.getElementById("game-status-text");

        if(jName) jName.innerText = data.jigitName || "...";
        if(kName) kName.innerText = data.kyzName || "...";
        if(jScore) jScore.innerText = data.jigitScore;
        if(kScore) kScore.innerText = data.kyzScore;

        let totalQs = questions.length || 20;
        let stepPercent = 70 / totalQs; 

        let jigitLeft = 10 + (data.jigitScore * stepPercent); 
        let kyzLeft = 40 + (data.kyzScore * stepPercent);
        if(jigitLeft > 85) jigitLeft = 85;
        if(kyzLeft > 85) kyzLeft = 85;

        const jTrack = document.getElementById("jigit-track-container");
        const kTrack = document.getElementById("kyz-track-container");
        if(jTrack) jTrack.style.left = `${jigitLeft}%`;
        if(kTrack) kTrack.style.left = `${kyzLeft}%`;

        if(data.status === "waiting") {
            if(statusTxt) statusTxt.innerText = "Кыздын кошулушун күтүүдө...";
        } 
        else if(data.status === "playing") {
            if(statusTxt) statusTxt.innerText = data.isExtraRound ? "КОШУМЧА РАУНД! ТЕҢ ЧЫГУУ СЕБЕПТҮҮ ЖАРЫШ УЛАНУУДА" : "ЖАРЫШ АЛМАК-САЛМАК ЖҮРҮҮДӨ";
            
            if(menuMusic) menuMusic.pause();
            if(gameMusic && gameMusic.paused) { gameMusic.play().catch(()=>{}); }

            const qContainer = document.getElementById("quiz-box-container");
            if(qContainer) {
                qContainer.classList.remove("hidden");
                let myTargetIndex = (myRole === "jigit") ? data.jigitCurrentQuestion : data.kyzCurrentQuestion;
                
                if (data.turn !== myRole) {
                    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
                    qContainer.innerHTML = `
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
        } 
        else if(data.status === "finished") {
            endGame(data);
        }
        applyWhiteTrackBackground(); 
    });
}

function showQuestion() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    const qContainer = document.getElementById("quiz-box-container");
    if(!qContainer) return;

    if(currentQuestionIdx >= questions.length) {
        qContainer.innerHTML = `
            <div class="text-center py-12 text-sm font-bold text-gray-400">
                <i class="fas fa-flag-checkered mr-2 text-lg text-emerald-400"></i> Жооп берип бүттүңүз. Каршылашыңыздын жыйынтыгын күтүүдөсүз...
            </div>`;
        checkGameEndCondition();
        return;
    }

    isAnswered = false;
    timeLeft = 20;
    let qData = questions[currentQuestionIdx];
    
    qContainer.innerHTML = `
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

// Убакыт бүткөндө автоматтык түрдө ката катары өткөрүү
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
            if(currentRoomData.jigitScore === currentRoomData.kyzScore) {
                let extraQs = [
                    { q: "КОШУМЧА РАУНД: Төмөнкүлөрдүн ичинен кайсынысы скалярдык чоңдук?", a: "Убакыт", options: ["Убакыт", "Күч", "Ылдамдык", "Ылдамдануу"] },
                    { q: "КОШУМЧА РАУНД: Атмосфералык басымды өлчөөчү курал кандай аталат?", a: "Барометр", options: ["Барометр", "Термометр", "Динамометр", "Манометр"] }
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

// --- ЖЫЙЫНТЫКТЫ МУГАЛИМДИН КАБИНЕТИНЕ ЖӨНӨТҮҮ (ЖАҢЫ ТОЛУКТОО) ---
function saveGameResultToDashboard(data) {
    const teacherUid = localStorage.getItem("teacherUid");
    if (!teacherUid) {
        console.log("Жыйынтык мугалимдин кабинетине сакталган жок (бул конок оюну).");
        return;
    }

    // Жигиттин жана кыздын упайын мугалимдин жеке папкасына жазуу
    const dashboardResultsRef = db.ref(`users/${teacherUid}/results`);
    
    // Жаңы уникалдуу ID менен натыйжаларды кошуу
    dashboardResultsRef.push({
        className: "Онлайн Оюн (Кыз Куумай)",
        name: `${data.jigitName} (Жигит) vs ${data.kyzName} (Кыз)`,
        score: `Жигит: ${data.jigitScore} | Кыз: ${data.kyzScore}`,
        status: data.jigitScore > data.kyzScore ? "Жигит жетти" : "Кыз качып кетти",
        cheatCount: 0,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        console.log("Оюндун натыйжалары мугалимдин жеке кабинетине ийгиликтүү жөнөтүлдү!");
    }).catch(err => {
        console.error("Мугалимдин кабинетине жазууда ката кетти:", err);
    });
}

function endGame(data) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if(gameMusic) gameMusic.pause();
    
    const modal = document.getElementById("result-modal");
    const msgLbl = document.getElementById("result-message-text");
    const jScoreRes = document.getElementById("res-jigit-score");
    const kScoreRes = document.getElementById("res-kyz-score");
    
    if(jScoreRes) jScoreRes.innerText = data.jigitScore;
    if(kScoreRes) kScoreRes.innerText = data.kyzScore;

    if(modal && msgLbl) {
        if(data.jigitScore > data.kyzScore) {
            msgLbl.innerHTML = `<b class="text-orange-400">${data.jigitName}</b> деген жигит <b class="text-pink-400">${data.kyzName}</b> деген кызга жетти! 🎉`;
        } else {
            msgLbl.innerHTML = `<b class="text-orange-400">${data.jigitName}</b> деген жигиттен <b class="text-pink-400">${data.kyzName}</b> деген кыз качып кетти! 🐎💨`;
        }
        modal.classList.remove("hidden");
    }

    // Оюн бүткөндө жыйынтыкты мугалимдин кабинетине сактоо функциясын бир гана Жигит (бөлмө ээси) чакырат
    if (myRole === "jigit") {
        saveGameResultToDashboard(data);
    }
}
