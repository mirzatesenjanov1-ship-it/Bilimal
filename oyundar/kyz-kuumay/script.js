// Физика суроолорунун базасы (өзгөртүп же кошуп алсаңыз болот)
const questions = [
    { question: "Ньютондун биринчи мыйзамы кандай аталат?", options: ["Динамика мыйзамы", "Инерция мыйзамы", "Тартылуу мыйзамы", "Сакталуу мыйзамы"], correct: 1 },
    { question: "Күчтүн бирдиги эмне?", options: ["Джоуль (Дж)", "Ватт (Вт)", "Ньютон (Н)", "Паскаль (Па)"], correct: 2 },
    { question: "Күч моменти кайсы формула менен эсептелет?", options: ["M = F * d", "F = m * a", "A = F * S", "p = m * v"], correct: 0 },
    { question: "Механикалык жумуштун бирдиги?", options: ["Ньютон", "Ватт", "Джоуль", "Герц"], correct: 2 },
    { question: "Көлөмдүн эл аралык (СИ) системасындагы бирдиги?", options: ["Литр", "Куб метр (м³)", "Квадрат метр (м²)", "Миллилитр"], correct: 1 },
    { question: "Эркин түшүүнүн ылдамдануусу (g) болжол менен канчага барабар?", options: ["9.8 м/с²", "10.5 м/с²", "3.14 м/с²", "8.9 м/с²"], correct: 0 },
    { question: "Кубаттуулуктун формуласы кайсы?", options: ["N = A / t", "p = m * v", "F = m * a", "E = mc²"], correct: 0 },
    { question: "Архимед күчү кайсы багытты көздөй таасир этет?", options: ["Төмөн көздөй", "Оңду көздөй", "Жогору көздөй", "Бардык тарапка"], correct: 2 },
    { question: "Ылдамдыктын убакыт боюнча өзгөрүүсүн эмне деп атайбыз?", options: ["Жол", "Ылдамдануу", "Күч", "Импульс"], correct: 1 },
    { question: "Кинетикалык энергия кайсы чоңдуктардан көз каранды?", options: ["Масса жана Бийиктик", "Күч жана Убакыт", "Масса жана Ылдамдык", "Басым жана Көлөм"], correct: 2 }
];

let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timer;
let boyPos = 10; // Жигиттин баштапкы орду (10%)
let girlPos = 60; // Кыздын орду (60%)

const boyElement = document.getElementById('boy');
const girlElement = document.getElementById('girl');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const scoreElement = document.getElementById('score');
const timeElement = document.getElementById('time');
const resultModal = document.getElementById('result-modal');

// Оюнду баштоо
function startGame() {
    // Суроолорду аралаштыруу
    questions.sort(() => Math.random() - 0.5);
    updatePositions();
    loadQuestion();
    
    // Таймерди иштетүү
    timer = setInterval(() => {
        timeLeft--;
        timeElement.textContent = timeLeft;
        
        // Кыз акырын алдыга жыла берет
        if(timeLeft % 3 === 0 && girlPos < 85) {
            girlPos += 1;
            updatePositions();
        }

        if (timeLeft <= 0) {
            endGame(false); // Убакыт бүттү, жеңилди
        }
    }, 1000);
}

// Суроону чыгаруу
function loadQuestion() {
    if (currentQuestionIndex >= questions.length) {
        endGame(true); // Суроолор бүттү, жигит жетти деп эсептейбиз
        return;
    }

    const currentQ = questions[currentQuestionIndex];
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

// Жоопту текшерүү
function checkAnswer(selectedIndex, btnElement) {
    const currentQ = questions[currentQuestionIndex];
    
    // Бардык баскычтарды басылбас кылуу
    const allBtns = optionsContainer.querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    if (selectedIndex === currentQ.correct) {
        // Туура жооп
        btnElement.classList.add('correct');
        score += 10;
        boyPos += 8; // Жигит алдыга жылат
        
        // Жигит кызга жеттиби?
        if (boyPos >= girlPos - 5) {
            setTimeout(() => endGame(true), 1000);
            return;
        }
    } else {
        // Ката жооп
        btnElement.classList.add('wrong');
        // Туурасын көрсөтүү
        allBtns[currentQ.correct].classList.add('correct');
        boyPos -= 2; // Ката жооп берсе, жигит артка калат
        if (boyPos < 0) boyPos = 0;
    }

    scoreElement.textContent = score;
    updatePositions();

    // Кийинки суроого өтүү
    setTimeout(() => {
        currentQuestionIndex++;
        loadQuestion();
    }, 1500);
}

// Каармандардын ордун жаңыртуу
function updatePositions() {
    boyElement.style.left = boyPos + '%';
    girlElement.style.left = girlPos + '%';
}

// Оюнду аяктоо
function endGame(isWin) {
    clearInterval(timer);
    resultModal.style.display = 'flex';
    document.getElementById('final-score').textContent = score;
    
    const title = document.getElementById('result-title');
    if (isWin) {
        title.textContent = "Азаматсыз! Кызга жеттиңиз! 🥳";
        title.className = "text-4xl font-black mb-4 text-green-400";
    } else {
        title.textContent = "Убакыт бүттү! Кыз узап кетти 😔";
        title.className = "text-4xl font-black mb-4 text-red-400";
    }
}

// Баштоо
window.onload = startGame;
