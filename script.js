// Космостук жылдыздардын анимациясы
const canvas = document.getElementById('starsCanvas');
const ctx = canvas.getContext('2d');
let stars = [];

function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < 400; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 1.5,
            opacity: Math.random(),
            speed: Math.random() * 0.2,
            twinkle: Math.random() * 0.02, 
            color: Math.random() > 0.8 ? '#60a5fa' : '#ffffff'
        });
    }
}

function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(star => {
        star.opacity += star.twinkle;
        if (star.opacity > 1 || star.opacity < 0.2) star.twinkle *= -1;
        ctx.globalAlpha = Math.abs(star.opacity);
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        star.y += star.speed;
        if (star.y > canvas.height) star.y = 0;
    });
    requestAnimationFrame(drawStars);
}

// Сабак пландары жана лабораториялар үчүн баштапкы сырсөз логикаңыз
function accessContent(type) {
    let password = prompt("Кирүү кодук жазыңыз:");
    const codes = { 'plans': '1999', 'labs': '1405' };
    if (password === codes[type]) {
        window.location.href = type + "-content.html";
    } else if (password !== null) {
        if (confirm("Ката код! Boosty аркылуу алуу үчүн өтөсүзбү?")) {
            window.open("https://boosty.to/astrophysica", '_blank');
        }
    }
}

// Мектеп предметтери үчүн Модал логикасы
function openSubjectModal(subjectName) {
    document.getElementById('modal-title').innerText = subjectName;
    document.getElementById('modal-body').innerHTML = `
        <div class="py-6 space-y-4">
            <div class="text-4xl text-blue-500/40"><i class="fas fa-folder-open"></i></div>
            <p class="text-gray-300">"${subjectName}" предмети боюнча санариптик материалдар, кызыктуу конспекттер жана методикалык колдонмолор даярдалууда.</p>
            <p class="text-xs text-gray-500">Жакын арада бул жерге тиешелүү шилтемелер жана файлдар кошулат.</p>
        </div>`;
    document.getElementById('dynamic-modal').classList.remove('hidden');
}

// Бала бакча бөлүмдөрү үчүн Модал логикасы
function openKindergartenModal(sectionName) {
    document.getElementById('modal-title').innerText = sectionName + " (Бала бакча)";
    document.getElementById('modal-body').innerHTML = `
        <div class="py-6 space-y-4">
            <div class="text-4xl text-amber-500/40"><i class="fas fa-child"></i></div>
            <p class="text-gray-300">"${sectionName}" багытында бөбөктөр үчүн кыргыз тилиндеги интерактивдүү материалдар жана өнүктүрүү куралдары түзүлүүдө.</p>
            <p class="text-xs text-gray-500">Бул бөлүм аркылуу бала бакчанын тарбиячылары жана ата-энелер сапаттуу ресурсарды ала алышат.</p>
        </div>`;
    document.getElementById('dynamic-modal').classList.remove('hidden');
}

// Купуялуулук саясаты (Privacy Policy) үчүн модалдык терезе (AdSense Талабы)
function openPrivacyModal() {
    document.getElementById('modal-title').innerText = "Купуялуулук саясаты / Privacy Policy";
    document.getElementById('modal-body').innerHTML = `
        <div class="text-left py-4 space-y-4 text-xs md:text-sm leading-relaxed text-gray-300">
            <p class="font-bold text-white text-center mb-4">BILIMAL.ORG порталынын купуялуулук эрежелери</p>
            <p><strong>1. Жалпы маалымат:</strong> Бул купуялуулук саясаты BILIMAL.ORG сайтынын колдонуучуларынын маалыматтары кандайча корголорун жана колдонуларын түшүндүрөт. Биз сиздин жеке коопсуздугуңузга өзгөчө маани беребиз.</p>
            <p><strong>2. Куки (Cookies) файлдары жана Жарнама:</strong> Биздин сайт үчүнчү тараптын жарнамалык кызматтарын, тактап айтканда <strong>Google AdSense</strong> тутумун колдонот. Google AdSense колдонуучуларга алардын кызыгууларына ылайык жарнамаларды көрсөтүү үчүн куки файлдарын колдонушу мүмкүн.</p>
            <p><strong>3. Google Analytics:</strong> Сайтта колдонуучулардын агымын жана статистикасын талдоо максатында Google Analytics куралы колдонулат. Бул маалыматтар сайттын сапатын жогорулатуу жана билим берүү материалдарын жакшыртуу үчүн гана кызмат кылат.</p>
            <p><strong>4. Маалыматтарды коргоо:</strong> Сиздин сайттагы иш-аракеттериңиз, киргизген сырсөздөрүңүз же шилтемелериңиз үчүнчү тарапка эч кандай учурда сатылбайт жана берилбейт.</p>
            <p class="text-gray-500 text-center pt-4">Эгерде суроолоруңуз болсо, Telegram аркылуу администратор менен байланышсаңыз болот.</p>
        </div>`;
    document.getElementById('dynamic-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('dynamic-modal').classList.add('hidden');
}

window.addEventListener('resize', initCanvas);
initCanvas();
drawStars();
