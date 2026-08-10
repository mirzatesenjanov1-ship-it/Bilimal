import { db, auth } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, child, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadTests();
        } else {
            const container = document.getElementById('testContainer');
            if (container) {
                container.innerHTML = `
                    <div style="text-align:center; padding:30px; grid-column: 1/-1;">
                        <p style="color:#ff0055; margin-bottom:15px;"><i class="fa-solid fa-lock"></i> Бул баракчага кирүү үчүн системага киришиңиз керек!</p>
                        <a href="/login.html" class="btn-create" style="display:inline-block;">Кирүү барагына өтүү</a>
                    </div>
                `;
            }
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
                const maxAttempts = test.maxAttempts !== undefined ? test.maxAttempts : 0; // 0 = чексиз
                const attemptsText = maxAttempts === 0 ? 'Чексиз' : `${maxAttempts} жолу`;

                const card = document.createElement('div');
                card.className = 'test-card';
                card.id = `card_${id}`;
                card.innerHTML = `
                    <span class="badge ${isHidden ? 'badge-unpub' : 'badge-pub'}">
                        ${isHidden ? '• Жашырылган' : '• Жарыяланган'}
                    </span>
                    <h3>${escapeHtml(test.title || 'Аталышы жок тест')}</h3>
                    <p><i class="fa-solid fa-book"></i> Предмет: <strong>${escapeHtml(test.subject || '-')}</strong> (${escapeHtml(test.grade || '-')}-класс)</p>
                    <p><i class="fa-solid fa-clock"></i> Убактысы: <strong>${test.duration || 15} мүнөт</strong></p>
                    <p><i class="fa-solid fa-circle-question"></i> Суроолор саны: <strong>${qCount}</strong></p>
                    <p><i class="fa-solid fa-rotate-right"></i> Тапшыруу чеги: <strong>${attemptsText}</strong></p>
                    ${test.topic ? `<p><i class="fa-solid fa-tag"></i> Тема: ${escapeHtml(test.topic)}</p>` : ''}

                    <div class="card-actions">
                        <button class="btn-action btn-copy" data-id="${id}">
                            <i class="fa-solid fa-link"></i> Шилтеме
                        </button>
                        <button class="btn-action btn-toggle" data-id="${id}" data-hidden="${isHidden}">
                            <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Көрсөтүү' : 'Жашыруу'}
                        </button>
                        <button class="btn-action btn-attempts" data-id="${id}" data-attempts="${maxAttempts}">
                            <i class="fa-solid fa-repeat"></i> Аракеттер
                        </button>
                        <a href="test-builder.html?id=${encodeURIComponent(id)}" class="btn-action">
                            <i class="fa-solid fa-pen"></i> Оңдоо
                        </a>
                        <button class="btn-action btn-results" data-id="${id}" data-title="${escapeHtml(test.title || 'Тест')}">
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

    // Тапшыруу санын башкаруу (maxAttempts)
    document.querySelectorAll('.btn-attempts').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const currentAttempts = btn.getAttribute('data-attempts');
            
            const userInput = prompt("Окуучу бул тестти канча жолу тапшыра аларын жазыңыз:\n(0 - чексиз жолу, же сан киргизиңиз: 1, 2, 3...)", currentAttempts);
            
            if (userInput !== null) {
                const newAttempts = parseInt(userInput.trim());
                if (isNaN(newAttempts) || newAttempts < 0) {
                    alert("Сураныч, туура сан жазыңыз (0 же андан чоң)!");
                    return;
                }

                try {
                    await update(ref(db, `tests/${id}`), { maxAttempts: newAttempts });
                    alert("Тапшыруу жолу ийгиликтүү жаңыртылды!");
                    loadTests();
                } catch (err) {
                    alert("Базаны жаңыртууда ката чыкты: " + err.message);
                }
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
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Жүктөлүүдө...</td></tr>';
    modal.style.display = 'flex';

    try {
        const dbRef = ref(db);
        let foundResultsObj = null;

        // test_results/TEST_ID аркылуу издөө
        try {
            const snap = await get(child(dbRef, `test_results/${testId}`));
            if (snap.exists()) {
                foundResultsObj = snap.val();
            }
        } catch (e1) {
            console.warn("test_results ичинен окулган жок:", e1.message);
        }

        // Эгер табылбаса эски results/TEST_ID аркылуу издөө
        if (!foundResultsObj) {
            try {
                const snap = await get(child(dbRef, `results/${testId}`));
                if (snap.exists()) {
                    foundResultsObj = snap.val();
                }
            } catch (e2) {
                console.warn("results ичинен окулган жок:", e2.message);
            }
        }

        if (foundResultsObj) {
            tableBody.innerHTML = '';
            
            const entries = Object.entries(foundResultsObj);

            entries.forEach(([key, r]) => {
                const cheatedCount = r.cheatedCount || 0;
                let cheatedBadge = `<span style="color:#10b981;">Таза (0)</span>`;

                if (cheatedCount > 0) {
                    cheatedBadge = `<span style="color:#ff0055; font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> ${cheatedCount} жолу</span>`;
                }

                if (r.cheatingAttempt) {
                    cheatedBadge += ` <small style="color:#ff0055;">(Бөгөттөлгөн)</small>`;
                }

                // Уникалдуу ID: key же r.id же Name+Date комби
                const resultUniqueId = key || (r.studentName ? `${r.studentName}_${r.date}` : Math.random().toString());
                const storageKey = `checked_result_${testId}_${resultUniqueId}`;
                const isChecked = localStorage.getItem(storageKey) === 'true';

                const tr = document.createElement('tr');
                if (isChecked) tr.classList.add('checked-row-bg');

                tr.innerHTML = `
                    <td class="check-col">
                        <input type="checkbox" class="result-checkbox" ${isChecked ? 'checked' : ''} data-key="${storageKey}">
                    </td>
                    <td class="student-name-td ${isChecked ? 'checked-student-name' : ''}">${escapeHtml(r.studentName || '-')}</td>
                    <td>${escapeHtml(r.studentClass || '-')}</td>
                    <td><strong>${r.score || 0}</strong> / ${r.totalQuestions || '-'}</td>
                    <td><strong>${r.percent || 0}%</strong></td>
                    <td>${cheatedBadge}</td>
                    <td>${r.date ? new Date(r.date).toLocaleString('ky-KG') : '-'}</td>
                `;

                // Чекбокс клик окуясы
                const chk = tr.querySelector('.result-checkbox');
                chk.addEventListener('change', (e) => {
                    const checked = e.target.checked;
                    const nameTd = tr.querySelector('.student-name-td');

                    if (checked) {
                        nameTd.classList.add('checked-student-name');
                        tr.classList.add('checked-row-bg');
                        localStorage.setItem(storageKey, 'true');
                    } else {
                        nameTd.classList.remove('checked-student-name');
                        tr.classList.remove('checked-row-bg');
                        localStorage.removeItem(storageKey);
                    }
                });

                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Бул тестти азырынча эч ким тапшыра элек.</td></tr>';
        }
    } catch (err) {
        console.error("Жыйынтыктарды жүктөөдө ката:", err);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ff0055;">Ката чыкты: ${err.message}</td></tr>`;
    }
}

// Экранирование функциясы (XSS бөгөттөө үчүн)
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
