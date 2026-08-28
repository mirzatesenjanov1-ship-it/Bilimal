import { db } from '/firebase/firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let allTests = [];
let selectedSubject = 'all';
let selectedGrade = 'all';
let searchQuery = '';

// 🌐 UI ЛОКАЛИЗАЦИЯ СӨЗДҮГҮ
const uiTranslations = {
    ky: {
        noPublicTests: "Азырынча ачык тесттер жок.",
        fetchError: "Тесттерди жүктөөдө ката болду.",
        noSearchResults: "Сиздин сурооңуз боюнча тест табылган жок.",
        generalSubject: "Жалпы",
        untitledTest: "Аталышсыз тест",
        noTopic: "Тема белгиленген эмес",
        gradeSuffix: "-класс",
        gradePrefix: "",
        questionsSuffix: " суроо",
        minSuffix: " мүн",
        startBtn: "ТЕСТТИ БАШТОО 🚀",
        subjects: {
            "Физика": "Физика",
            "Математика": "Математика",
            "Химия": "Химия",
            "Биология": "Биология",
            "Кыргыз тили": "Кыргыз тили",
            "Информатика": "Информатика"
        }
    },
    ru: {
        noPublicTests: "Пока нет открытых тестов.",
        fetchError: "Ошибка при загрузке тестов.",
        noSearchResults: "По вашему запросу тестов не найдено.",
        generalSubject: "Общий",
        untitledTest: "Тест без названия",
        noTopic: "Тема не указана",
        gradeSuffix: " класс",
        gradePrefix: "",
        questionsSuffix: " вопр.",
        minSuffix: " мин",
        startBtn: "НАЧАТЬ ТЕСТ 🚀",
        subjects: {
            "Физика": "Физика",
            "Математика": "Математика",
            "Химия": "Химия",
            "Биология": "Биология",
            "Кыргыз тили": "Кыргызский язык",
            "Информатика": "Информатика"
        }
    },
    en: {
        noPublicTests: "No public tests available yet.",
        fetchError: "Error loading tests.",
        noSearchResults: "No tests found matching your request.",
        generalSubject: "General",
        untitledTest: "Untitled Test",
        noTopic: "Topic not specified",
        gradeSuffix: " Grade",
        gradePrefix: "Grade ",
        questionsSuffix: " q's",
        minSuffix: " min",
        startBtn: "START TEST 🚀",
        subjects: {
            "Физика": "Physics",
            "Математика": "Mathematics",
            "Химия": "Chemistry",
            "Биология": "Biology",
            "Кыргыз тили": "Kyrgyz Language",
            "Информатика": "Computer Science"
        }
    }
};

function getCurrentLang() {
    return localStorage.getItem('site_lang') || 'ky';
}

function getTranslation() {
    const lang = getCurrentLang();
    return uiTranslations[lang] || uiTranslations.ky;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchPublicTests();
    setupFilters();
});

// 🌐 ТИЛ ӨЗГӨРГӨНДӨ КАРТОЧКАЛАРДЫ КАЙРА РЕНДЕРЛӨӨ
window.addEventListener('languageChanged', () => {
    renderTests();
});

// Firebase'ден бардык тесттерди тартуу жана client-side ичинде чыпкалоо
async function fetchPublicTests() {
    const grid = document.getElementById('testsGrid');
    const t = getTranslation();

    try {
        const testsRef = ref(db, 'tests');
        const snapshot = await get(testsRef);

        if (!snapshot.exists()) {
            grid.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">${t.noPublicTests}</p>`;
            return;
        }

        const data = snapshot.val();
        allTests = [];

        // Жашырылган (hidden === true) жана жарыяланбаган (published === false) тесттерди чыгарбоо
        Object.entries(data).forEach(([id, test]) => {
            if (test.published !== false && !test.hidden) {
                allTests.push({ id, ...test });
            }
        });

        if (allTests.length === 0) {
            grid.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">${t.noPublicTests}</p>`;
            return;
        }

        // Акыркы сакталган тесттерди башына чыгаруу (сортировка)
        allTests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        renderTests();

    } catch (error) {
        console.error("Тесттерди жүктөөдө ката:", error);
        grid.innerHTML = `<p style="color:#ff0055; text-align:center; grid-column:1/-1;">${t.fetchError}</p>`;
    }
}

// Фильтрленген тесттерди экранга чыгаруу
function renderTests() {
    const grid = document.getElementById('testsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const t = getTranslation();
    const currentLang = getCurrentLang();

    const filtered = allTests.filter(test => {
        const matchSubject = selectedSubject === 'all' || (test.subject && test.subject.toLowerCase() === selectedSubject.toLowerCase());
        const matchGrade = selectedGrade === 'all' || String(test.grade) === String(selectedGrade);
        
        const q = searchQuery.toLowerCase();
        const matchSearch = !searchQuery || 
            (test.title && test.title.toLowerCase().includes(q)) ||
            (test.topic && test.topic.toLowerCase().includes(q)) ||
            (test.subject && test.subject.toLowerCase().includes(q));

        return matchSubject && matchGrade && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">${t.noSearchResults}</p>`;
        return;
    }

    filtered.forEach((test, index) => {
        const card = document.createElement('div');
        card.className = 'test-card';

        const qCount = test.questions ? (Array.isArray(test.questions) ? test.questions.length : Object.keys(test.questions).length) : 0;

        // Предмет аталышын которуу
        let rawSubject = test.subject || '';
        let displaySubject = t.subjects[rawSubject] || rawSubject || t.generalSubject;

        // Класс форматын тууралоо
        let displayGrade = '-';
        if (test.grade) {
            displayGrade = currentLang === 'en' 
                ? `${t.gradePrefix}${test.grade}` 
                : `${test.grade}${t.gradeSuffix}`;
        }

        card.innerHTML = `
            <div>
                <span class="card-tag">${escapeHtml(displaySubject)}</span>
                <h3 class="card-title">${escapeHtml(test.title || t.untitledTest)}</h3>
                <p class="card-topic">${escapeHtml(test.topic || t.noTopic)}</p>
            </div>
            <div>
                <div class="card-meta">
                    <span>🎓 ${escapeHtml(displayGrade)}</span>
                    <span>📝 ${qCount}${t.questionsSuffix}</span>
                    <span>⏱ ${test.duration || 15}${t.minSuffix}</span>
                </div>
                <a href="/test.html?testId=${test.id}" class="btn-start-test">${t.startBtn}</a>
            </div>
        `;

        grid.appendChild(card);

        // Ар бир 6 карточкадан кийин AdSense Жарнама Блогун кыстыруу (AdSense саясатына туура келет)
        if ((index + 1) % 6 === 0) {
            const adCard = document.createElement('div');
            adCard.className = 'ad-card';
            adCard.innerHTML = `
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="ca-pub-1495571814896964"
                     data-ad-slot="1574613769"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
            `;
            grid.appendChild(adCard);
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
    });
}

// Издөө жана фильтр баскычтарынын окуялары
function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderTests();
        });
    }

    // Предметтерди чыкылдатуу
    document.querySelectorAll('#subjectFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#subjectFilters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSubject = btn.getAttribute('data-subject');
            renderTests();
        });
    });

    // Класстарды чыкылдатуу
    document.querySelectorAll('#gradeFilters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#gradeFilters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGrade = btn.getAttribute('data-grade');
            renderTests();
        });
    });
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
