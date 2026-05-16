// ==========================================
// 1. КОСМОСТУК ЖЫЛДЫЗДАРДЫН АНИМАЦИЯСЫ
// ==========================================
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

// ==========================================
// 2. СЫРСПӨЗ МЕНЕН КИРҮҮ ЛОГИКАСЫ (BOOSTY)
// ==========================================
function accessContent(type) {
    let password = prompt("Кирүү кодун жазыңыз:");
    const codes = { 'plans': '1999', 'labs': '1405' };
    if (password === codes[type]) {
        window.location.href = type + "-content.html";
    } else if (password !== null) {
        if (confirm("Ката код! Boosty аркылуу алуу үчүн өтөсүзбү?")) {
            window.open("https://boosty.to/astrophysica", '_blank');
        }
    }
}

// ==========================================
// 3. МЕКТЕП ПРЕДМЕТТЕРИ ҮЧҮН МОДАЛ ЛОГИКАСЫ
// ==========================================
function openSubjectModal(subjectName) {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modal = document.getElementById('dynamic-modal');

    if (!modal || !modalTitle || !modalBody) return;

    // Модалдын башына предметтин атын жазабыз
    modalTitle.innerHTML = `<i class="fas fa-book-open mr-2 text-blue-400"></i> ${subjectName} бөлүмү`;
    
    // Предметтин ичиндеги 3 негизги багыттын менюсу
    modalBody.innerHTML = `
        <div class="text-left mb-5">
            <p class="text-xs text-gray-400">Мугалимдер үчүн керектүү усулдук-санариптик материалдар топтому. Багытты тандаңыз:</p>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            
            <div onclick="loadSubjectData('${subjectName}', 'materials')" class="cursor-pointer p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/40 hover:bg-blue-500/[0.02] transition group">
                <div class="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center text-base mb-2 group-hover:scale-110 transition">
                    <i class="fas fa-file-alt"></i>
                </div>
                <h5 class="text-[11px] font-black uppercase text-white tracking-wider">Маалыматтар</h5>
                <p class="text-[10px] text-gray-500 mt-1 leading-tight">Сабак пландары жана конспекттер.</p>
            </div>

            <div onclick="loadSubjectData('${subjectName}', 'labs')" class="cursor-pointer p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] transition group">
                <div class="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-base mb-2 group-hover:scale-110 transition">
                    <i class="fas fa-flask"></i>
                </div>
                <h5 class="text-[11px] font-black uppercase text-white tracking-wider">Лаборатория</h5>
                <p class="text-[10px] text-gray-500 mt-1 leading-tight">Виртуалдык тажрыйбалар.</p>
            </div>

            <div onclick="loadSubjectData('${subjectName}', 'simulations')" class="cursor-pointer p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/40 hover:bg-purple-500/[0.02] transition group">
                <div class="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center text-base mb-2 group-hover:scale-110 transition">
                    <i class="fas fa-film"></i>
                </div>
                <h5 class="text-[11px] font-black uppercase text-white tracking-wider">Симуляция</h5>
                <p class="text-[10px] text-gray-500 mt-1 leading-tight">Кубулуштардын 3D видеолору.</p>
            </div>

        </div>

        <div id="subject-content-area" class="mt-5 p-4 rounded-xl bg-black/30 border border-white/5 hidden text-left text-xs text-gray-300">
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// Ички бөлүмдү басканда тиешелүү материалдарды чыгаруучу функция
function loadSubjectData(subject, type) {
    const contentArea = document.getElementById('subject-content-area');
    if (!contentArea) return;
    
    contentArea.classList.remove('hidden');
    
    let typeTitle = "";
    let contentHtml = "";

    // Суб-бөлүмдөргө карата маалымат түзүмү
    if (type === 'materials') {
        typeTitle = "Усулдук маалыматтар жана пландар";
        contentHtml = `
            <ul class="space-y-2">
                <li class="flex justify-between items-center bg-white/[0.01] p-2 rounded border border-white/5 hover:bg-white/[0.03] transition">
                    <span>📄 1-чейрек боюнча календарлык план (${subject})</span>
                    <a href="#" onclick="accessContent('plans')" class="text-blue-400 hover:underline text-[11px] shrink-0 ml-2">Жүктөө →</a>
                </li>
                <li class="flex justify-between items-center bg-white/[0.01] p-2 rounded border border-white/5 hover:bg-white/[0.03] transition">
                    <span>📄 Сабактын инновациялык конспектиси</span>
                    <a href="#" onclick="accessContent('plans')" class="text-blue-400 hover:underline text-[11px] shrink-0 ml-2">Ачуу →</a>
                </li>
            </ul>`;
    } else if (type === 'labs') {
        typeTitle = "Лабораториялык жана практикалык иштер";
        contentHtml = `
            <ul class="space-y-2">
                <li class="flex justify-between items-center bg-white/[0.01] p-2 rounded border border-white/5 hover:bg-white/[0.03] transition">
                    <span>🧪 №1 Практикалык иштин көрсөтмөсү (${subject})</span>
                    <a href="#" onclick="accessContent('labs')" class="text-emerald-400 hover:underline text-[11px] shrink-0 ml-2">Аткаруу →</a>
                </li>
                <li class="flex justify-between items-center bg-white/[0.01] p-2 rounded border border-white/5 hover:bg-white/[0.03] transition">
                    <span>🧪 Виртуалдык лабораториялык колдонмо</span>
                    <a href="#" onclick="accessContent('labs')" class="text-emerald-400 hover:underline text-[11px] shrink-0 ml-2">Кирүү →</a>
                </li>
            </ul>`;
    } else if (type === 'simulations') {
        typeTitle = "Интерактивдүү симуляциялык видеолор";
        contentHtml = `
            <div class="space-y-3">
                <p class="text-[11px] text-gray-400">${subject} предмети боюнча кубулуштарды визуалдык түрдө түшүндүргөн видеолор кошулууда. Материалдар толук жаңыртылганда Boosty платформабыздан биринчилерден болуп көрө аласыз.</p>
                <a href="https://boosty.to/astrophysica" target="_blank" class="inline-flex items-center space-x-1 text-purple-400 hover:underline text-[11px]">
                    <i class="fab fa-youtube mr-1"></i> Симуляцияларды азыр көрүү →
                </a>
            </div>`;
    }

    // Тандалган контентти интерфейске басып чыгаруу
    contentArea.innerHTML = `
        <div class="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
            <h6 class="font-bold uppercase tracking-wider text-[10px] text-gray-400">${typeTitle}</h6>
            <span class="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-400 font-mono">${subject.toUpperCase()}</span>
        </div>
        ${contentHtml}
    `;
}

// ==========================================
// 4. БАЛА БАКЧА БӨЛҮМДӨРҮ ҮЧҮН МОДАЛ ЛОГИКАСЫ
// ==========================================
function openKindergartenModal(sectionName) {
    document.getElementById('modal-title').innerText = sectionName + " (Бала бакча)";
    document.getElementById('modal-body').innerHTML = `
        <div class="py-6 space-y-4">
            <div class="text-4xl text-amber-500/40 text-center"><i class="fas fa-child"></i></div>
            <p class="text-gray-300 text-sm">"${sectionName}" багытында бөбөктөр үчүн кыргыз тилиндеги интерактивдүү материалдар жана өнүктүрүү куралдары түзүлүүдө.</p>
            <p class="text-xs text-gray-500">Бул бөлүм аркылуу бала бакчанын тарбиячылары жана ата-энелер сапаттуу ресурстарды ала алышат.</p>
        </div>`;
    document.getElementById('dynamic-modal').classList.remove('hidden');
}

// ==========================================
// 5. КУПУЯЛУУЛУК САЯСАТЫ (PRIVACY POLICY - ADSENSE ТАЛАБЫ)
// ==========================================
function openPrivacyModal() {
    document.getElementById('modal-title').innerText = "Купуялуулук саясаты / Privacy Policy";
    document.getElementById('modal-body').innerHTML = `
        <div class="text-left py-4 space-y-4 text-xs md:text-sm leading-relaxed text-gray-300">
            <p class="font-bold text-white text-center mb-4">BILIMAL.ORG порталынын купуялуулук эрежелери</p>
            <p><strong>1. Жалпы маалымат:</strong> Бул купуялуулук саясаты BILIMAL.ORG сайтанын колдонуучуларынын маалыматтары кандайча корголорун жана колдонуларын түшүндүрөт. Биз сиздин жеке коопсуздугуңузга өзгөчө маани беребиз.</p>
            <p><strong>2. Куки (Cookies) файлдары жана Жарнама:</strong> Биздин сайт үчүнчү тараптын жарнамалык кызматтарын, тактап айтканда <strong>Google AdSense</strong> тутумун колдонот. Google AdSense колдонуучуларга алардын кызыгууларына ылайык жарнамаларды көрсөтүү үчүн куки файлдарын колдонушу мүмкүн.</p>
            <p><strong>3. Google Analytics:</strong> Сайтта колдонуучулардын агымын жана статистикасын талдоо максатында Google Analytics куралы колдонулат. Бул маалыматтар сайттын сапатын жогорулатуу жана билим берүү материалдарын жакшыртуу үчүн гана кызмат кылат.</p>
            <p><strong>4. Маалыматтарды коргоо:</strong> Сиздин сайттагы иш-аракеттериңиз, киргизген сырсөздөрүңүз же шилтемелериңиз үчүнчү тарапка эч кандай учурда сатылбайт жана берилбейт.</p>
            <p class="text-gray-500 text-center pt-4">Эгерде суроолоруңуз болсо, Telegram аркылуу администратор менен байланышсаңыз болот.</p>
        </div>`;
    document.getElementById('dynamic-modal').classList.remove('hidden');
}

// ==========================================
// 6. МОДАЛДЫ ЖАБУУ ЖАНА ТЕРЕЗЕ ОКУЯЛАРЫ
// ==========================================
function closeModal() {
    document.getElementById('dynamic-modal').classList.add('hidden');
}

// Терезе өзгөргөндө холстту кайра жүктөө
window.addEventListener('resize', initCanvas);
initCanvas();
drawStars();
