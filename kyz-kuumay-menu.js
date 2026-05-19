// --- КЫЗ КУУМАЙ ОЮНУ: 14 ПРЕДМЕТТИН ТОЛУК БАЗАСЫ ---
const kyzKuumayData = {
    "Математика": [
        { name: "Алгебра: Теңдемелер жана барабарсыздыктар", link: "games/kyz-kuumay.html?subject=math&topic=algebra" },
        { name: "Геометрия: Планиметрия негиздери", link: "games/kyz-kuumay.html?subject=math&topic=geometry" }
    ],
    "Кыргыз тили": [
        { name: "Фонетика жана Лексика", link: "games/kyz-kuumay.html?subject=kyrgyz&topic=phonetics" },
        { name: "Синтаксис жана Морфология", link: "games/kyz-kuumay.html?subject=kyrgyz&topic=syntax" }
    ],
    "Кыргыз адабияты": [
        { name: "Элдик ооз эки чыгармачылык жана Эпостор", link: "games/kyz-kuumay.html?subject=kyr-lit&topic=epos" },
        { name: "XX кылымдагы кыргыз адабияты", link: "games/kyz-kuumay.html?subject=kyr-lit&topic=modern" }
    ],
    "Орус тили": [
        { name: "Орфография и Пунктуация", link: "games/kyz-kuumay.html?subject=russian&topic=grammar" },
        { name: "Морфология русского языка", link: "games/kyz-kuumay.html?subject=russian&topic=morphology" }
    ],
    "Орус адабияты": [
        { name: "Золотой век русской литературы", link: "games/kyz-kuumay.html?subject=rus-lit&topic=golden-age" }
    ],
    "Англис тили": [
        { name: "English Tenses (Грамматикалык чактар)", link: "games/kyz-kuumay.html?subject=english&topic=tenses" },
        { name: "Vocabulary & Speaking (Сөз байлыгы)", link: "games/kyz-kuumay.html?subject=english&topic=vocabulary" }
    ],
    "Физика": [
        { name: "Механика (Динамика жана Кинематика)", link: "games/kyz-kuumay.html?subject=physics&topic=mechanics" },
        { name: "Термодинамика жана Молекулалык физика", link: "games/kyz-kuumay.html?subject=physics&topic=thermo" },
        { name: "Кванттык физика жана Оптика", link: "games/kyz-kuumay.html?subject=physics&topic=quantum" }
    ],
    "Химия": [
        { name: "Мезгилдик мыйзам жана Таблица", link: "games/kyz-kuumay.html?subject=chemistry&topic=periodic" },
        { name: "Органикалык химия негиздери", link: "games/kyz-kuumay.html?subject=chemistry&topic=organic" }
    ],
    "Биология": [
        { name: "Ботаника жана Зоология", link: "games/kyz-kuumay.html?subject=biology&topic=nature" },
        { name: "Адамдын анатомиясы жана Генетика", link: "games/kyz-kuumay.html?subject=biology&topic=anatomy" }
    ],
    "География": [
        { name: "Кыргызстандын физикалык географиясы", link: "games/kyz-kuumay.html?subject=geography&topic=kyrgyzstan" },
        { name: "Дүйнөнүн экономикалык географиясы", link: "games/kyz-kuumay.html?subject=geography&topic=world" }
    ],
    "Тарых": [
        { name: "Кыргызстан тарыхы (Байыркы заман)", link: "games/kyz-kuumay.html?subject=history&topic=kyrgyzstan" },
        { name: "Дүйнөлүк тарых: Жаңы доор", link: "games/kyz-kuumay.html?subject=history&topic=world" }
    ],
    "Информатика": [
        { name: "Алгоритмдер жана Программалоо (Python)", link: "games/kyz-kuumay.html?subject=cs&topic=programming" },
        { name: "Компьютердик тармактар жана Коопсуздук", link: "games/kyz-kuumay.html?subject=cs&topic=networks" }
    ],
    "Астрономия": [
        { name: "Күн системасы жана Планеталар", link: "games/kyz-kuumay.html?subject=astronomy&topic=solar-system" },
        { name: "Жылдыздар, Галактикалар жана Космология", link: "games/kyz-kuumay.html?subject=astronomy&topic=universe" }
    ],
    "Адам жана коом": [
        { name: "Укук, Мамлекет жана Демократия", link: "games/kyz-kuumay.html?subject=society&topic=law" },
        { name: "Адам укуктары жана Мораль негиздери", link: "games/kyz-kuumay.html?subject=society&topic=ethics" }
    ]
};

// Тандоону баштоо
function startKyzKuumaySelection() {
    const modal = document.getElementById('dynamic-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    title.innerHTML = `<i class="fas fa-horse mr-2 text-amber-400"></i> Кыз Куумай: Предметти тандаңыз`;
    
    let htmlContent = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">`;
    
    for (let subject in kyzKuumayData) {
        htmlContent += `
            <button onclick="showKyzKuumayTopics('${subject}')" class="w-full text-left bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/10 p-3.5 rounded-xl font-bold text-white transition-all flex items-center justify-between group">
                <span class="text-xs sm:text-sm tracking-wide"><i class="fas fa-book-open mr-2.5 text-amber-400/70 group-hover:text-amber-400"></i> ${subject}</span>
                <i class="fas fa-chevron-right text-[10px] text-gray-500 group-hover:text-amber-400"></i>
            </button>
        `;
    }
    htmlContent += `</div>`;
    
    body.innerHTML = htmlContent;
    modal.classList.remove('hidden');
}

// Темаларды көрсөтүү
function showKyzKuumayTopics(subject) {
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    title.innerHTML = `<i class="fas fa-list mr-2 text-amber-400"></i> ${subject} — Теманы тандаңыз`;
    
    let htmlContent = `<div class="space-y-3 p-2">`;
    const topics = kyzKuumayData[subject];
    topics.forEach(topic => {
        htmlContent += `
            <a href="${topic.link}" class="w-full text-left bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/5 hover:border-orange-500/40 hover:from-orange-500/5 hover:to-transparent p-4 rounded-xl font-medium text-gray-200 hover:text-white transition-all flex items-center justify-between group block">
                <span class="flex items-center gap-3 text-xs sm:text-sm">
                    <span class="w-2 h-2 rounded-full bg-orange-400 group-hover:animate-ping"></span>
                    ${topic.name}
                </span>
                <span class="bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md group-hover:bg-orange-500 group-hover:text-black transition-all shrink-0 ml-2">Ойноо <i class="fas fa-gamepad ml-1"></i></span>
            </a>
        `;
    });
    htmlContent += `
        <button onclick="startKyzKuumaySelection()" class="mt-6 w-full text-center text-[11px] text-gray-500 hover:text-white transition-all py-2 border-t border-white/5 pt-4 uppercase tracking-wider font-bold">
            <i class="fas fa-arrow-left mr-2"></i> Предметтерге кайтуу
        </button>
    `;
    htmlContent += `</div>`;
    body.innerHTML = htmlContent;
}

function closeModal() {
    document.getElementById('dynamic-modal').classList.add('hidden');
}
