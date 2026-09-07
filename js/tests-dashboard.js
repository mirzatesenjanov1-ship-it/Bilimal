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
            // Эгер Firebase Auth иштебей жатса, LocalStorage аркылуу текшерип көрөбүз
            const storedEmail = localStorage.getItem('userEmail');
            if (storedEmail) {
                currentUser = { email: storedEmail, uid: localStorage.getItem('userId') || '' };
                loadTests();
            } else {
                renderNoAuthMessage();
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

function renderNoAuthMessage() {
    const container = document.getElementById('testContainer');
    if (container) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; grid-column: 1/-1; background:#0f172a; border-radius:12px; border:1px solid #1e293b;">
                <i class="fa-solid fa-lock" style="font-size:3rem; color:#ef4444; margin-bottom:15px;"></i>
                <h3 style="margin-bottom:10px;">Системага кирүү талап кылынат</h3>
                <p style="color:#94a3b8; margin-bottom:20px;">Түзүлгөн тесттерди көрүү үчүн аккаунтуңузга кириңиз.</p>
                <a href="/login.html" class="btn-create" style="display:inline-block;">Кирүү барагына өтүү</a>
            </div>
        `;
    }
}

async function loadTests() {
    const container = document.getElementById('testContainer');
    if (!container || !currentUser) return;

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, 'tests'));

        if (snapshot.exists()) {
            const data = snapshot.val();
            container.innerHTML = '';
            let userTestCount = 0;

            const currentEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
            const currentUid = currentUser.uid || '';

            Object.keys(data).forEach((id) => {
                const test = data[id];

                // Бардык альтернативдик автор талааларын текшерүү
                const testEmail = (test.authorEmail || test.email || test.userEmail || '').toLowerCase().trim();
                const testUid = test.authorId || test.userId || test.uid || '';

                // АВТОРДУК ДАЛ КЕЛҮҮ ШАРТЫ:
                // 1. Почтасы окшош болсо
                // 2. Же UID окшош болсо
                // 3. Же базадагы тестте автор көрсөтүлбөй калган болсо (баарына көрсөтүү)
                const isOwner = (currentEmail && testEmail && currentEmail === testEmail) || 
                                (currentUid && testUid && currentUid === testUid) ||
                                (!testEmail && !testUid);

                if (isOwner) {
                    userTestCount++;
                    const qCount = test.questions ? (Array.isArray(test.questions) ? test.questions.length : Object.keys(test.questions).length) : 0;
                    const isHidden = test.hidden || false;
                    const maxAttempts = test.maxAttempts !== undefined ? test.maxAttempts : 0;
                    const attemptsText = maxAttempts === 0 ? 'Чексиз' : `${maxAttempts} жолу`;

                    const card = document.createElement('div');
                    card.className = 'test-card';
                    card.id = `card_${id}`;
                    card.innerHTML = `
                        <span class="badge ${isHidden ? 'badge-unpub' : 'badge-pub'}">
                            ${isHidden ? '• Жашырылган' : '• Активдүү'}
                        </span>
                        <h3>${escapeHtml(test.title || 'Аталышы жок тест')}</h3>
                        <p><i class="fa-solid fa-book"></i> Предмет: <strong>${escapeHtml(test.subject || '-')}</strong> (${escapeHtml(test.grade || '-')}-класс)</p>
                        <p><i class="fa-solid fa-clock"></i> Убактысы: <strong>${test.duration || 15} мүнөт</strong></p>
                        <p><i class="fa-solid fa-circle-question"></i> Суроолор: <strong>${qCount} даана</strong></p>
                        <p><i class="fa-solid fa-rotate-right"></i> Тапшыруу чеги: <strong>${attemptsText}</strong></p>

                        <div class="card-actions">
                            <button class="btn-action btn-copy" data-id="${id}" title="Шилтемени көчүрүү">
                                <i class="fa-solid fa-link"></i> Шилтеме
                            </button>
                            <button class="btn-action btn-toggle" data-id="${id}" data-hidden="${isHidden}">
                                <i class="fa-solid ${isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isHidden ? 'Ачуу' : 'Жашыруу'}
                            </button>
                            <button class="btn-action btn-attempts" data-id="${id}" data-attempts="${maxAttempts}">
                                <i class="fa-solid fa-repeat"></i> Лимит
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
                }
            });

            if (userTestCount === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px; grid-column: 1/-1;">
                        <p style="color:#94a3b8; font-size:1.1rem; margin-bottom:15px;">Сизде азырынча түзүлгөн тесттер жок.</p>
                        <a href="test-builder.html" class="btn-create"><i class="fa-solid fa-plus"></i> Биринчи тестти түзүү</a>
                    </div>
                `;
            } else {
                attachEventListeners();
            }

        } else {
            container.innerHTML = '<p style="color:#94a3b8; grid-column: 1/-1;">Базада тесттер табылган жок.</p>';
        }
    } catch (err) {
        console.error("Тесттерди жүктөөдө ката:", err);
        container.innerHTML = `<p style="color:#ef4444; grid-column: 1/-1;">Жүктөөдө ката чыкты: ${err.message}</p>`;
    }
}

function attachEventListeners() {
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

    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const currentStatus = btn.getAttribute('data-hidden') === 'true';
            try {
                await update(ref(db, `tests/${id}`), { hidden: !currentStatus });
                loadTests();
            } catch (err) {
                alert("Ката чыкты: " + err.message);
            }
        });
    });

    document.querySelectorAll('.btn-attempts').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const currentAttempts = btn.getAttribute('data-attempts');
            
            const userInput = prompt("Тапшыруу сан чегин киргизиңиз (0 - чексиз жолу):", currentAttempts);
            if (userInput !== null) {
                const newAttempts = parseInt(userInput.trim());
                if (isNaN(newAttempts) || newAttempts < 0) {
                    alert("Туура сан киргизиңиз!");
                    return;
                }
                try {
                    await update(ref(db, `tests/${id}`), { maxAttempts: newAttempts });
                    loadTests();
                } catch (err) {
                    alert("Ката: " + err.message);
                }
            }
        });
    });

    document.querySelectorAll('.btn-results').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const title = btn.getAttribute('data-title');
            viewResults(id, title);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm("Чын эле бул тестти өчүргүңүз келеби?")) {
                try {
                    await remove(ref(db, `tests/${id}`));
                    loadTests();
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

    if (!modal || !titleEl || !tableBody) return;

    titleEl.innerText = `Жыйынтыктар: ${title}`;
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Жүктөлүүдө...</td></tr>';
    modal.style.display = 'flex';

    try {
        const dbRef = ref(db);
        let foundResultsObj = null;

        const snap1 = await get(child(dbRef, `test_results/${testId}`));
        if (snap1.exists()) foundResultsObj = snap1.val();

        if (!foundResultsObj) {
            const snap2 = await get(child(dbRef, `results/${testId}`));
            if (snap2.exists()) foundResultsObj = snap2.val();
        }

        if (foundResultsObj) {
            tableBody.innerHTML = '';
            let index = 1;
            Object.entries(foundResultsObj).forEach(([key, r]) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index++}</td>
                    <td><strong>${escapeHtml(r.studentName || '-')}</strong></td>
                    <td>${escapeHtml(r.studentClass || '-')}</td>
                    <td>${r.score || 0} / ${r.totalQuestions || '-'}</td>
                    <td><span style="color:#00f2fe; font-weight:bold;">${r.percent || 0}%</span></td>
                    <td>${r.cheatedCount > 0 ? `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${r.cheatedCount} жолу</span>` : '<span style="color:#10b981;">Таза</span>'}</td>
                    <td>${r.date ? new Date(r.date).toLocaleString('ky-KG') : '-'}</td>
                    <td>
                        <button class="btn-delete-res" data-key="${key}" style="background:none; border:none; color:#ef4444; cursor:pointer;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;

                tr.querySelector('.btn-delete-res').addEventListener('click', async () => {
                    if (confirm("Жыйынтыкты өчүрүүнү каалайсызбы?")) {
                        await remove(ref(db, `test_results/${testId}/${key}`));
                        await remove(ref(db, `results/${testId}/${key}`));
                        tr.remove();
                    }
                });

                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#94a3b8;">Азырынча эч ким тапшыра элек.</td></tr>';
        }
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444;">Ката: ${err.message}</td></tr>`;
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
