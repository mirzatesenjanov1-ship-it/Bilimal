import { db } from '/firebase/firebase-config.js';
import { ref, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let allTests = [];
let selectedSubject = 'all';
let selectedGrade = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
    fetchPublicTests();
    setupFilters();
});

// Firebase'ден Жарыяланган тесттерди гана тартуу
async function fetchPublicTests() {
    const grid = document.getElementById('testsGrid');
    try {
        const testsRef = ref(db, 'tests');
        // Болгону опубликованный тесттерди тартуу
        const testsQuery = query(testsRef, orderByChild('published'), equalTo(true));
        const snapshot = await get(testsQuery);

        if (!snapshot.exists()) {
            grid.innerHTML = '<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">Азырынча ачык тесттер жок.</p>';
            return;
        }

        const data = snapshot.val();
        allTests = [];

        Object.entries(data).forEach(([id, test]) => {
            allTests.push({ id, ...test });
        });

        // Акыркы сакталган тесттерди башына чыгаруу (сортировка)
        allTests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        renderTests();

    } catch (error) {
        console.error("Тесттерди жүктөөдө ката:", error);
        grid.innerHTML = '<p style="color:#ff0055; text-align:center; grid-column:1/-1;">Тесттерди жүктөөдө ката болду.</p>';
    }
}

// Фильтрленген тесттерди экранга чыгаруу
function renderTests() {
    const grid = document.getElementById('testsGrid');
    grid.innerHTML = '';

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
        grid.innerHTML = '<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">Сиздин сурооңуз боюнча тест табылган жок.</p>';
        return;
    }

    filtered.forEach((test, index) => {
        const card = document.createElement('div');
        card.className = 'test-card';

        const qCount = test.questions ? Object.keys(test.questions).length : 0;

        card.innerHTML = `
            <div>
                <span class="card-tag">${escapeHtml(test.subject || 'Жалпы')}</span>
                <h3 class="card-title">${escapeHtml(test.title || 'Аталышсыз тест')}</h3>
                <p class="card-topic">${escapeHtml(test.topic || 'Тема белгиленген эмес')}</p>
            </div>
            <div>
                <div class="card-meta">
                    <span>🎓 ${escapeHtml(String(test.grade || '-'))}-класс</span>
                    <span>📝 ${qCount} суроо</span>
                    <span>⏱ ${test.duration || 15} мүн</span>
                </div>
                <a href="/test.html?testId=${test.id}" class="btn-start-test">ТЕСТТИ БАШТОО 🚀</a>
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
            (adsbygoogle = window.adsbygoogle || []).push({});
        }
    });
}

// Издөө жана фильтр баскычтарынын окуялары
function setupFilters() {
    // Издөө тилкеси
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderTests();
    });

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
