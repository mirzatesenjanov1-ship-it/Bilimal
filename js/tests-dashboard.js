import { db } from '../firebase/firebase-config.js';
import { ref, get, child, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    loadTests();

    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('resultsModal').style.display = 'none';
        });
    }
});

async function loadTests() {
    const container = document.getElementById('testContainer');
    if (!container) return;

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, 'tests'));

        if (snapshot.exists()) {
            const data = snapshot.val();
            container.innerHTML = '';

            // Realtime Database объектин цикл менен айлануу
            Object.keys(data).forEach((id) => {
                const test = data[id];
                const qCount = test.questions ? (Array.isArray(test.questions) ? test.questions.length : Object.keys(test.questions).length) : 0;
                const isHidden = test.hidden || false;

                const card = document.createElement('div');
                card.className = 'test-card';
                card.id = `card_${id}`;
                card.innerHTML = `
                    <span class="badge ${isHidden ? 'badge-unpub' : 'badge-pub'}">
                        ${isHidden ? '• Жашырылган' : '• Жарыяланган'}
                    </span>
                    <h3>${test.title || 'Аталышы жок тест'}</h3>
                    <p><i class="fa-solid fa-book"></i> Предмет: <strong>${test.subject || '-'}</strong> (${test.grade || '-'}-класс)</p>
                    <p><i class="fa-solid fa-clock"></i> Убактысы: <strong>${test.duration || 15} мүнөт</strong></p>
                    <p><i class="fa-solid fa-circle-question"></i> Суроолор саны: <strong>${qCount}</strong></p>
                    ${test.topic ? `<p><i class="fa-solid fa-tag"></i> Тема: ${test.topic}</p>` : ''}

                    <div class="card-actions">
                        <button class="btn-action" onclick="copyTestLink('${id}')">
                            <i class="fa-solid fa-link"></i> Шилтеме
                        </button>
                        <button class="btn-action" onclick="toggleHideTest('${id}', ${isHidden})">
                            <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Көрсөтүү' : 'Жашыруу'}
                        </button>
                        <a href="test-builder.html?id=${id}" class="btn-action">
                            <i class="fa-solid fa-pen"></i> Оңдоо
                        </a>
                        <button class="btn-action" onclick="viewResults('${id}', '${test.title}')">
                            <i class="fa-solid fa-chart-column"></i> Жыйынтыктар
                        </button>
                        <button class="btn-action btn-delete" onclick="deleteTest('${id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '<p style="color:#94a3b8">Азырынча эч кандай тест түзүлө элек.</p>';
        }
    } catch (err) {
        console.error("Тесттерди жүктөөдө ката:", err);
        container.innerHTML = `<p style="color:#ff0055">Ката чыкты: ${err.message}</p>`;
    }
}

// Глобалдык кнопкалар үчүн функциялар
window.copyTestLink = function(id) {
    const link = `${window.location.origin}/test.html?testId=${id}`;
    navigator.clipboard.writeText(link).then(() => {
        alert("Тесттин шилтемеси көчүрүлдү:\n" + link);
    }).catch(() => {
        prompt("Шилтемени көчүрүп алыңыз:", link);
    });
};

window.toggleHideTest = async function(id, currentStatus) {
    try {
        await update(ref(db, `tests/${id}`), { hidden: !currentStatus });
        loadTests();
    } catch (err) {
        alert("Статусту өзгөртүүдө ката чыкты: " + err.message);
    }
};

window.deleteTest = async function(id) {
    if (confirm("Бул тестти чындап эле өчүрүүнү каалайсызбы?")) {
        try {
            await remove(ref(db, `tests/${id}`));
            const card = document.getElementById(`card_${id}`);
            if (card) card.remove();
            alert("Тест өчүрүлдү!");
        } catch (err) {
            alert("Өчүрүүдө ката чыкты: " + err.message);
        }
    }
};

window.viewResults = async function(id, title) {
    const modal = document.getElementById('resultsModal');
    const titleEl = document.getElementById('modalTitle');
    const tableBody = document.getElementById('resultsTableBody');

    titleEl.innerText = `Жыйынтыктар: ${title}`;
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Жүктөлүүдө...</td></tr>';
    modal.style.display = 'flex';

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `test_results/${id}`));

        if (snapshot.exists()) {
            const results = snapshot.val();
            tableBody.innerHTML = '';

            Object.values(results).forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.studentName || '-'}</td>
                    <td>${r.studentClass || '-'}</td>
                    <td>${r.score} / ${r.totalQuestions}</td>
                    <td>${r.percent}%</td>
                    <td>${r.date ? new Date(r.date).toLocaleString('ky-KG') : '-'}</td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Бул тестти азырынча эч ким тапшыра элек.</td></tr>';
        }
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ff0055;">Ката: ${err.message}</td></tr>`;
    }
};
