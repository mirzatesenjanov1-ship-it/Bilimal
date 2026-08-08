import { auth, db } from '/firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;

// Auth текшерүү
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/dashboard.html";
        return;
    }
    currentUser = user;
    loadTeacherTests();
});

// Мугалимге гана тиешелүү тесттерди жүктөө
async function loadTeacherTests() {
    const container = document.getElementById('testContainer');
    try {
        const testsRef = ref(db, 'tests');
        const snapshot = await get(testsRef);

        if (!snapshot.exists()) {
            container.innerHTML = '<p style="color:#94a3b8">Сизде азырынча түзүлгөн тесттер жок.</p>';
            return;
        }

        const testsData = snapshot.val();
        container.innerHTML = ''; // Тазалоо

        let myTestsCount = 0;

        for (const [testId, test] of Object.entries(testsData)) {
            // Болгону ушул мугалимге тиешелүү тесттерди чыпкалоо
            if (test.ownerUid === currentUser.uid) {
                myTestsCount++;
                const card = createTestCard(testId, test);
                container.appendChild(card);
            }
        }

        if (myTestsCount === 0) {
            container.innerHTML = '<p style="color:#94a3b8">Сизде азырынча түзүлгөн тесттер жок.</p>';
        }

    } catch (error) {
        console.error('Тесттерди жүктөөдө ката чыкты:', error);
        container.innerHTML = '<p style="color:#ff0055">Тесттерди жүктөөдө ката болду.</p>';
    }
}

// Тест картасын түзүү
function createTestCard(testId, test) {
    const card = document.createElement('div');
    card.className = 'test-card';

    const qCount = test.questions ? Object.keys(test.questions).length : 0;
    const isPublished = test.published !== false;

    card.innerHTML = `
        <span class="badge ${isPublished ? 'badge-pub' : 'badge-unpub'}">
            ${isPublished ? '● Жарыяланган' : '○ Жашырылган'}
        </span>
        <h3>${escapeHtml(test.title || 'Аталышсыз тест')}</h3>
        <p><i class="fa-solid fa-book"></i> Предмет: <strong>${escapeHtml(test.subject || '-')}</strong> (${escapeHtml(test.grade || '-')}-класс)</p>
        <p><i class="fa-solid fa-clock"></i> Убактысы: <strong>${test.duration || 15} мүнөт</strong></p>
        <p><i class="fa-solid fa-circle-question"></i> Суроолор саны: <strong>${qCount}</strong></p>
        
        <div class="card-actions">
            <button class="btn-action btn-copy" data-id="${testId}" title="Окуучуларга шилтемени көчүрүү"><i class="fa-solid fa-link"></i> Шилтеме</button>
            <button class="btn-action btn-toggle" data-id="${testId}" data-pub="${isPublished}"><i class="fa-solid ${isPublished ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isPublished ? 'Жашыруу' : 'Жарыялоо'}</button>
            <a href="/sections/test-builder.html?editId=${testId}" class="btn-action"><i class="fa-solid fa-pen"></i> Оңдоо</a>
            <button class="btn-action btn-results" data-id="${testId}" data-title="${escapeHtml(test.title)}"><i class="fa-solid fa-chart-line"></i> Жыйынтыктар</button>
            <button class="btn-action btn-delete" data-id="${testId}"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;

    // Event Listener'дерди кошуу
    card.querySelector('.btn-copy').addEventListener('click', () => copyTestLink(testId));
    card.querySelector('.btn-toggle').addEventListener('click', () => togglePublish(testId, isPublished));
    card.querySelector('.btn-results').addEventListener('click', () => showResults(testId, test.title));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteTest(testId));

    return card;
}

// Шилтемени көчүрүү
function copyTestLink(testId) {
    const link = `https://bilimal.org/test.html?testId=${testId}`;
    navigator.clipboard.writeText(link).then(() => {
        alert(`Шилтеме көчүрүлдү!\n${link}`);
    }).catch(() => {
        prompt("Төмөнкү шилтемени көчүрүп алыңыз:", link);
    });
}

// Жарыялоо/Жашыруу статусун алмаштыруу
async function togglePublish(testId, currentStatus) {
    try {
        await update(ref(db, `tests/${testId}`), {
            published: !currentStatus
        });
        loadTeacherTests();
    } catch (error) {
        alert("Статусту өзгөртүүдө ката болду!");
    }
}

// Тестти өчүрүү
async function deleteTest(testId) {
    if (confirm("Чын эле бул тестти өчүргүңүз келеби? Бардык жыйынтыктар кошо өчөт!")) {
        try {
            await remove(ref(db, `tests/${testId}`));
            await remove(ref(db, `results/${testId}`));
            alert("Тест өчүрүлдү!");
            loadTeacherTests();
        } catch (error) {
            alert("Өчүрүүдө ката болду!");
        }
    }
}

// Жыйынтыктарды көрсөтүү (Modal)
async function showResults(testId, testTitle) {
    const modal = document.getElementById('resultsModal');
    const modalTitle = document.getElementById('modalTitle');
    const tableBody = document.getElementById('resultsTableBody');

    modalTitle.innerText = `Жыйынтыктар: ${testTitle}`;
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Жүктөлүүдө...</td></tr>';
    modal.style.display = 'flex';

    try {
        const resultsRef = ref(db, `results/${testId}`);
        const snapshot = await get(resultsRef);

        if (!snapshot.exists()) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Бул тестке азырынча окуучулар жооп бере элек.</td></tr>';
            return;
        }

        const resultsData = snapshot.val();
        tableBody.innerHTML = '';

        Object.values(resultsData).forEach(res => {
            const tr = document.createElement('tr');
            const dateStr = res.completedAt ? new Date(res.completedAt).toLocaleString('ky-KG') : '-';
            tr.innerHTML = `
                <td><strong>${escapeHtml(res.studentName || 'Аноним')}</strong></td>
                <td>${escapeHtml(res.studentClass || '-')}</td>
                <td>${res.score} / ${res.totalQuestions}</td>
                <td><strong style="color: ${res.percentage >= 70 ? '#10b981' : '#ff0055'}">${res.percentage}%</strong></td>
                <td>${dateStr}</td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error('Жыйынтыктарды жүктөөдө ката:', error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff0055;">Жыйынтыктарды жүктөөдө ката чыкты.</td></tr>';
    }
}

// Модалканы жабуу
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('resultsModal').style.display = 'none';
});

// HTML текстинен коргонуу (XSS Safety)
function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
