const db = firebase.database();
let myRole = ""; 
let myName = "";
let roomRef = null;
let currentQuestions = [];
let currentQIndex = 0;
let totalQuestions = 0;

// Тандалган варианттарды аралаштыруу функциясы
function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function loginAndLoadQuiz(action) {
    myName = document.getElementById('player-name').value.trim();
    const quizCode = document.getElementById('teacher-quiz-code').value.trim();
    const roomCode = document.getElementById('room-input').value.trim();

    if (!myName || !quizCode) {
        return alert("Сураныч, атыңызды жана Мугалим берген ТЕСТ КОДДУ киргизиңиз!");
    }

    // 1. Мугалимдин тестин базадан издөө
    db.ref('teacher_quizzes/' + quizCode).once('value', snapshot => {
        if (!snapshot.exists()) {
            return alert("Мындай ТЕСТ КОД табылган жок! Катаны текшериңиз.");
        }

        const quizData = snapshot.val();
        currentQuestions = quizData.questions; 
        totalQuestions = currentQuestions.length;
        
        document.getElementById('display-level-name').innerText = quizData.subject + " | " + quizData.title;

        // 2. Бөлмө түзүү же кирүү логикасы
        if (action === 'create') {
            createGameRoom(quizCode);
        } else if (action === 'join') {
            if (!roomCode) return alert("Бөлмөгө кирүү үчүн БӨЛМӨ КОДУН жазыңыз!");
            joinGameRoom(roomCode);
        }
    });
}

function createGameRoom(quizCode) {
    myRole = "boy";
    const rCode = Math.floor(100 + Math.random() * 899); // 3 орундуу бөлмө коду
    document.getElementById('room-controls').style.display = "none";
    document.getElementById('wait-status').innerHTML = `ОЮН БӨЛМӨСҮ ТҮЗҮЛДҮ: <b style="font-size:24px; color:#f39c12;">${rCode}</b><br>Кыздын кошулуусун күтүңүз...`;

    roomRef = db.ref('game_rooms/' + rCode);
    roomRef.set({
        quizCode: quizCode,
        players: { boy: myName, girl: "" },
        pos: { boy: 0, girl: 20 }, // Кыз бир аз алдыда баштайт
        currentQuestion: 0,
        status: "waiting"
    });

    // Экинчи оюнчу киргенде оюнду баштоо
    roomRef.child('players/girl').on('value', snap => {
        if (snap.exists() && snap.val() !== "") {
            startGame();
        }
    });
}

function joinGameRoom(roomCode) {
    myRole = "girl";
    roomRef = db.ref('game_rooms/' + roomCode);
    
    roomRef.once('value', snap => {
        if (!snap.exists()) return alert("Мындай оюн бөлмөсү табылган жок!");
        
        const data = snap.val();
        if (data.players.girl !== "") return alert("Бул бөлмөдө кыздын орду толо!");

        roomRef.child('players/girl').set(myName).then(() => {
            startGame();
        });
    });
}

function startGame() {
    document.getElementById('setup-screen').style.display = "none";
    document.getElementById('game-field').style.display = "block";
    document.getElementById('ui-bottom').style.display = "block";

    // Базадагы өзгөрүүлөрдү байкоо (Аттардын жылышы)
    roomRef.on('value', snap => {
        const data = snap.val();
        if (!data) return;

        // Аттардын аттарын жаңыртуу
        document.getElementById('label-boy').innerText = data.players.boy || "Жигит";
        document.getElementById('label-girl').innerText = data.players.girl || "Кыз";

        // Позицияларды жаңыртуу
        document.getElementById('boy-container').style.left = data.pos.boy + "%";
        document.getElementById('girl-container').style.left = data.pos.girl + "%";

        // Суроо синхрондуу өзгөрөт
        if (data.currentQuestion !== currentQIndex) {
            currentQIndex = data.currentQuestion;
            if (currentQIndex < totalQuestions) {
                showQuestion();
            } else {
                endGame(data.pos);
            }
        }
    });

    currentQIndex = 0;
    showQuestion();
}

function showQuestion() {
    if (currentQIndex >= totalQuestions) return;
    
    const qData = currentQuestions[currentQIndex];
    document.getElementById('q-text').innerText = `Суроо ${currentQIndex + 1}/${totalQuestions}: ${qData.q}`;
    
    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = "";

    // Варианттарды аралаштырып чыгаруу
    const shuffledOptions = shuffleArray(qData.a);

    shuffledOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "opt-btn";
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(opt, qData.c);
        optionsDiv.appendChild(btn);
    });
}

function checkAnswer(selected, correct) {
    // Жооп бергенден кийин баскычтарды убактылуу жабуу
    const buttons = document.querySelectorAll('.opt-btn');
    buttons.forEach(b => b.disabled = true);

    if (selected === correct) {
        // Туура жооп үчүн аттар алдыга жылат
        roomRef.child('pos/' + myRole).transaction(currentPos => {
            return (currentPos || 0) + 10; // 10% алдыга кадам
        });
    }

    // Эки оюнчу тең кийинки суроого өтүшү үчүн бөлмөнүн суроо индексин өзгөртөбүз
    // Бул логика суроонун синхрондуу алмашуусун камсыз кылат
    if (myRole === "boy") {
        setTimeout(() => {
            roomRef.child('currentQuestion').set(currentQIndex + 1);
        }, 1000);
    }
}

function endGame(finalPos) {
    document.getElementById('ui-bottom').innerHTML = `
        <div class="quiz-container">
            <h2>ОЮН АЯКТАДЫ! 🏁</h2>
            <p>Жигиттин упайы: ${finalPos.boy}%</p>
            <p>Кыздын упайы: ${finalPos.girl}%</p>
            <h3 style="color: #2ecc71;">
                ${finalPos.boy >= finalPos.girl ? "Жигит кызды кууп жетти! 🏆" : "Кыз Жигитке алдырбастан качып кетти! 🏆"}
            </h3>
            <button class="btn main-btn" onclick="location.reload()">Кайра баштоо</button>
        </div>
    `;
}
