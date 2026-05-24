// Физиканын 9 бөлүмү боюнча маалымат базасы
const gameLevels = {
    "Механика": [
        { question: "Ньютондун биринчи мыйзамы кандай аталат?", options: ["Динамика мыйзамы", "Инерция мыйзамы", "Тартылуу мыйзамы", "Сакталуу мыйзамы"], correct: 1 },
        { question: "Ылдамдануунун формуласы кайсы?", options: ["a = F/m", "v = s/t", "E = mc²", "p = mv"], correct: 0 },
        { question: "Жумуштун бирдиги?", options: ["Ватт", "Ньютон", "Джоуль", "Паскаль"], correct: 2 }
    ],
    "Молекулярдык физика": [
        { question: "Заттын абалынын канча негизги фазасы бар?", options: ["2", "3", "4", "5"], correct: 2 },
        { question: "Идеалдык газдын абалынын теңдемеси?", options: ["Менделеев-Клайперон", "Бойль-Мариотт", "Шарль", "Гей-Люссак"], correct: 0 },
        { question: "Абсолюттук нөл температура Цельсий боюнча канча?", options: ["0 °C", "-100 °C", "-273.15 °C", "100 °C"], correct: 2 }
    ],
    "Термодинамика": [
        { question: "Термодинамиканын биринчи мыйзамы эмнени түшүндүрөт?", options: ["Энергиянын сакталышын", "Жылуулук өткөрүүнү", "Энтропияны", "Массаны"], correct: 0 },
        { question: "Изотермалык процессте кайсы чоңдук өзгөрбөйт?", options: ["Басым", "Көлөм", "Температура", "Масса"], correct: 2 },
        { question: "Жылуулук санынын бирдиги?", options: ["Ватт", "Кельвин", "Джоуль", "Ньютон"], correct: 2 }
    ],
    "Электродинамика": [
        { question: "Ом мыйзамынын формуласы?", options: ["I = U/R", "F = ma", "P = UI", "Q = I²Rt"], correct: 0 },
        { question: "Ток күчүнүн бирдиги?", options: ["Вольт", "Ампер", "Ом", "Ватт"], correct: 1 },
        { question: "Электр сыйымдуулугу эмне менен өлчөнөт?", options: ["Генри", "Тесла", "Фарадей", "Фарад"], correct: 3 }
    ],
    "Термелүүлөр жана толкундар": [
        { question: "Үн толкундары кандай толкундарга кирет?", options: ["Туурасынан", "Узунунан", "Электромагниттик", "Радиотолкундар"], correct: 1 },
        { question: "Жыштыктын бирдиги?", options: ["Герц (Гц)", "Секунд", "Метр", "Децибел"], correct: 0 },
        { question: "Математикалык маятниктин термелүү мезгили эмнеден көз каранды?", options: ["Массадан", "Жиптин узундугунан", "Амплитудадан", "Көлөмдөн"], correct: 1 }
    ],
    "Оптика": [
        { question: "Жарыктын вакуумдагы ылдамдыгы?", options: ["300 000 км/с", "340 м/с", "150 000 км/с", "3 000 км/с"], correct: 0 },
        { question: "Жарыктын сынуу мыйзамында кайсы чоңдук туруктуу калат?", options: ["Ылдамдык", "Жыштык", "Толкун узундугу", "Амплитуда"], correct: 1 },
        { question: "Линзанын оптикалык күчүнүн бирдиги?", options: ["Диоптрия", "Фокус", "Люмен", "Кандела"], correct: 0 }
    ],
    "Атомдук физика": [
        { question: "Атомдун борборунда эмне жайгашкан?", options: ["Электрон", "Протон", "Ядро", "Нейтрон"], correct: 2 },
        { question: "Резерфорд атомдун кайсы моделин сунуштаган?", options: ["Планетардык", "Пудинг", "Кванттык", "Булуттуу"], correct: 0 },
        { question: "Фотоэффект кубулушун ким түшүндүргөн?", options: ["Максвелл", "Планк", "Эйнштейн", "Бор"], correct: 2 }
    ],
    "Ядролук физика": [
        { question: "Ядродогу протондор менен нейтрондорду кармап турган күч?", options: ["Гравитациялык", "Электромагниттик", "Күчтүү өз ара аракеттенишүү", "Алсыз"], correct: 2 },
        { question: "Альфа бөлүкчөсү бул эмне?", options: ["Электрон", "Гелийдин ядросу", "Протон", "Нейтрон"], correct: 1 },
        { question: "Радиоактивдүүлүктү ким ачкан?", options: ["Мария Кюри", "Беккерель", "Рентген", "Чедвик"], correct: 1 }
    ],
    "Астрономия / Астрофизика": [
        { question: "Күнгө эң жакын планета?", options: ["Венера", "Марс", "Меркурий", "Жер"], correct: 2 },
        { question: "Күн системасындагы эң чоң планета?", options: ["Сатурн", "Нептун", "Уран", "Юпитер"], correct: 3 },
        { question: "Жарык жылы бул кайсы чоңдуктун бирдиги?", options: ["Убакыт", "Ылдамдык", "Аралык", "Масса"], correct: 2 }
    ]
};

let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timer;
let boyPos = 10;
let girlPos = 60;

const boyElement = document.getElementById('boy');
const girlElement = document.getElementById('girl');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const scoreElement = document.getElementById('score');
const timeElement = document.getElementById('time');
const resultModal = document.getElementById('result-modal');
const levelSelection = document.getElementById('level-selection');

// Баракча жүктөлгөндө деңгээлдерди чыгаруу
window.onload = () => {
    const levelBtnsContainer = document.getElementById('level-buttons');
    Object.keys(gameLevels).forEach(level => {
        const btn = document.createElement('button');
        btn.textContent = level;
        btn.className = "bg-white/5 border border-white/10 hover:border-pink-500 hover:bg-pink-500/20 text-white font-bold py-4 px-6 rounded-xl transition text-sm uppercase tracking-wider";
        btn.onclick = () => selectLevel(level);
        levelBtnsContainer.appendChild(btn);
    });
};

function selectLevel(level) {
    document.getElementById('current-level-badge').textContent = level;
    levelSelection.style.display = 'none';
    currentQuestions = [...gameLevels[level]].sort(() => Math.random() - 0.5);
    startGame();
}

function startGame() {
    updatePositions();
    loadQuestion();
    
    timer = setInterval(() => {
        timeLeft--;
        timeElement.textContent = timeLeft;
        
        if(timeLeft % 4 === 0 && girlPos < 85) {
            girlPos += 1;
            updatePositions();
        }

        if (timeLeft <= 0) endGame(false);
    }, 1000);
}

function loadQuestion() {
    if (currentQuestionIndex >= currentQuestions.length) {
        endGame(true);
        return;
    }

    const currentQ = currentQuestions[currentQuestionIndex];
    questionText.textContent = currentQ.question;
    optionsContainer.innerHTML = '';

    currentQ.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.className = 'option-btn';
        btn.onclick = () => checkAnswer(index, btn);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selectedIndex, btnElement) {
    const currentQ = currentQuestions[currentQuestionIndex];
    const allBtns = optionsContainer.querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    if (selectedIndex === currentQ.correct) {
        btnElement.classList.add('correct');
        score += 10;
        boyPos += 10;
        if (boyPos >= girlPos - 5) {
            setTimeout(() => endGame(true), 800);
            return;
        }
    } else {
        btnElement.classList.add('wrong');
        allBtns[currentQ.correct].classList.add('correct');
        boyPos -= 3;
        if (boyPos < 0) boyPos = 0;
    }

    scoreElement.textContent = score;
    updatePositions();

    setTimeout(() => {
        currentQuestionIndex++;
        loadQuestion();
    }, 1500);
}

function updatePositions() {
    boyElement.style.left = boyPos + '%';
    girlElement.style.left = girlPos + '%';
}

function endGame(isWin) {
    clearInterval(timer);
    resultModal.style.display = 'flex';
    document.getElementById('final-score').textContent = score;
    
    const title = document.getElementById('result-title');
    const icon = document.getElementById('result-icon');
    
    if (isWin) {
        icon.textContent = "🏆";
        title.textContent = "Азаматсыз! Кызга жеттиңиз!";
        title.className = "text-3xl font-black mb-2 text-green-400";
    } else {
        icon.textContent = "⏳";
        title.textContent = "Убакыт бүттү! Кыз узап кетти";
        title.className = "text-3xl font-black mb-2 text-rose-400";
    }
}
