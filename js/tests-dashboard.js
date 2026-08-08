import { db, auth } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, child, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Авторизация абалын текшерүү
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadTests();
        } else {
            // Колдонуучу кирбесе да тесттерди жүктөй беребиз же эскертүү чыгарабыз
            loadTests();
        }
    });

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
                        <button class="btn-action btn-copy" data-id="${id}">
                            <i class="fa-solid fa-link"></i> Шилтеме
                        </button>
                        <button class="btn-action btn-toggle" data-id="${id}" data-hidden="${isHidden}">
                            <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Көрсөтүү' : 'Жашыруу'}
                        </button>
                        <a href="test-builder.html?id=${encodeURIComponent(id)}" class="btn-action">
                            <i class="fa-solid fa-pen"></i> Оңдоо
                        </a>
                        <button class="btn-action btn-results" data-id="${id}" data-title="${test.title || 'Тест'}">
                            <i class="fa-solid fa-chart-column"></i> Жыйынтыктар
                        </button>
                        <button class="btn-action btn-delete" data-id="${id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });

            attachEventListeners();

        } else {
            container.innerHTML = '<p style="color:#94a3b8">Азырынча эч кандай тест түзүлө элек.</p>';
        }
    } catch (err) {
        console.error("Тесттерди жүктөөдө ката:", err);
        container.innerHTML = `<p style="color:#ff0055">Ката чыкты: ${err.message}</p>`;
    }
}

function attachEventListeners() {
    // Шилтемени көчүрүү
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const link = `${window.location.origin}/test.html?testId=${id}`;
            navigator.clipboard.writeText(link).then(() => {
                alert("Тесттин шилтемеси көчүрүлдү:\n" + link);
            }).catch(() => {
                prompt("Шилтемени көчүрүп алыңыз:", link);
            });
        });
    });

    // Жашыруу / Көрсөтүү
    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const currentStatus = btn.getAttribute('data-hidden') === 'true';
            try {
                await update(ref(db, `tests/${id}`), { hidden: !currentStatus });
                loadTests();
            } catch (err) {
                alert("Статусту өзгөртүүдө ката чыкты: " + err.message);
            }
        });
    });

    // Жыйынтыктарды көрүү
    document.querySelectorAll('.btn-results').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const title = btn.getAttribute('data-title');
            viewResults(id, title);
        });
    });

    // Өчүрүү
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
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
        });
    });
}

async function viewResults(testId, title) {
    const modal = document.getElementById('resultsModal');
    const titleEl = document.getElementById('modalTitle');
    const tableBody = document.getElementById('resultsTableBody');

    titleEl.innerText = `Жыйынтыктар: ${title}`;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Жүктөлүүдө...</td></tr>';
    modal.style.display = 'flex';

    try {
        const dbRef = ref(db);
        let foundResults = [];

        // 1. test_results/TEST_ID аркылуу издөө
        let snap = await get(child(dbRef, `test_results/${testId}`));
        if (snap.exists()) {
            foundResults = Object.values(snap.val());
        } else {
            // 2. results/TEST_ID аркылуу издөө
            snap = await get(child(dbRef, `results/${testId}`));
            if (snap.exists()) {
                foundResults = Object.values(snap.val());
            } else {
                // 3. Жалпы test_results ичинен фильтрлөө
                snap = await get(child(dbRef, `test_results`));
                if (snap.exists()) {
                    const allData = snap.val();
                    Object.values(allData).forEach(item => {
                        if (item.testId === testId) {
                            foundResults.push(item);
                        }
                    });
                }
            }
        }

        if (foundResults.length > 0) {
            tableBody.innerHTML = '';

            foundResults.forEach(r => {
                const cheatedCount = r.cheatedCount || 0;
                let cheatedBadge = `<span style="color:#10b981;">Таза (0)</span>`;

                if (cheatedCount > 0) {
                    cheatedBadge = `<span style="color:#ff0055; font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> ${cheatedCount} жолу</span>`;
                }

                if (r.cheatingAttempt) {
                    cheatedBadge += ` <small style="color:#ff0055;">(Бөгөттөлгөн)</small>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.studentName || '-'}</td>
                    <td>${r.studentClass || '-'}</td>
                    <td><strong>${r.score || 0}</strong> / ${r.totalQuestions || '-'}</td>
                    <td><strong>${r.percent || 0}%</strong></td>
                    <td>${cheatedBadge}</td>
                    <td>${r.date ? new Date(r.date).toLocaleString('ky-KG') : '-'}</td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Бул тестти азырынча эч ким тапшыра элек.</td></tr>';
        }
    } catch (err) {
        console.error("Жыйынтыктарды жүктөөдө ката:", err);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ff0055;">Ката чыкты: ${err.message}</td></tr>`;
    }
}
