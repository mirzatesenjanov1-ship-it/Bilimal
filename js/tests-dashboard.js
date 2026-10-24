import { db, auth } from '../firebase/firebase-config.js';
import { ref, get, child, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

let currentUser = null;
let isLoaded = false;

document.addEventListener('DOMContentLoaded', () => {
    const firebaseAuth = auth || getAuth();

    onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
            currentUser = {
                uid: user.uid,
                email: user.email ? user.email.toLowerCase().trim() : ''
            };
            loadMyTests();
        } else {
            checkLocalStorageAuth();
        }
    });

    setTimeout(() => {
        if (!isLoaded && !currentUser) {
            checkLocalStorageAuth();
        }
    }, 1200);

    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            const modal = document.getElementById('resultsModal');
            if (modal) modal.style.display = 'none';
        });
    }

    const allowReviewToggle = document.getElementById('allowReviewToggle');
    if (allowReviewToggle) {
        allowReviewToggle.addEventListener('change', async (e) => {
            const isAllowed = e.target.checked;
            const activeTestId = window.currentActiveTestId;
            if (activeTestId) {
                try {
                    await update(ref(db, `tests/${activeTestId}`), {
                        allowReview: isAllowed
                    });
                    console.log("AllowReview мааниси базага ийгиликтүү сакталды:", isAllowed);
                } catch (err) {
                    console.error("AllowReview сактоодо ката:", err);
                }
            }
        });
    }
});

function checkLocalStorageAuth() {
    const storedEmail = localStorage.getItem('userEmail') || localStorage.getItem('email') || localStorage.getItem('teacherEmail');
    const storedUid = localStorage.getItem('userId') || localStorage.getItem('uid') || localStorage.getItem('teacherId');

    if (storedEmail || storedUid) {
        currentUser = {
            email: storedEmail ? storedEmail.toLowerCase().trim() : '',
            uid: storedUid || ''
        };
        loadMyTests();
    } else {
        renderNoAuthMessage();
    }
}

function renderNoAuthMessage() {
    isLoaded = true;
    const container = document.getElementById('testContainer');
    if (container) {
        container.innerHTML = `
            <div style="text-align:center; padding:50px; grid-column: 1/-1; background:#0f172a; border-radius:12px; border:1px solid #1e293b;">
                <i class="fa-solid fa-lock" style="font-size:3rem; color:#ef4444; margin-bottom:15px;"></i>
                <h3 style="margin-bottom:10px; color:#fff;">Системага кирүү талап кылынат</h3>
                <p style="color:#94a3b8; margin-bottom:20px;">Өзүңүздүн тесттериңизди көрүү үчүн аккаунтуңузга кириңиз.</p>
                <a href="/login.html" class="btn-create" style="display:inline-flex;">Кирүү барагына өтүү</a>
            </div>
        `;
    }
}

async function loadMyTests() {
    const container = document.getElementById('testContainer');
    if (!container || !currentUser) return;

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, 'tests'));

        isLoaded = true;

        if (snapshot.exists()) {
            const data = snapshot.val();
            container.innerHTML = '';
            let myTestCount = 0;

            const currEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
            const currUid = currentUser.uid || '';

            Object.keys(data).forEach((id) => {
                const test = data[id];

                const possibleEmails = [
                    test.authorEmail,
                    test.email,
                    test.userEmail,
                    test.teacherEmail,
                    test.createdByEmail
                ].filter(Boolean).map(e => e.toString().toLowerCase().trim());

                const possibleIds = [
                    test.authorId,
                    test.userId,
                    test.uid,
                    test.teacherId,
                    test.createdBy
                ].filter(Boolean).map(i => i.toString());

                let isMyTest = false;

                if (currUid && possibleIds.includes(currUid)) {
                    isMyTest = true;
                }

                if (!isMyTest && currEmail && possibleEmails.includes(currEmail)) {
                    isMyTest = true;
                }

                const myLocalTests = JSON.parse(localStorage.getItem('my_created_tests') || '[]');
                if (!isMyTest && myLocalTests.includes(id)) {
                    isMyTest = true;
                }

                if (isMyTest) {
                    myTestCount++;
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
                        <p><i class="fa-solid fa-rotate-right"></i> Лимит: <strong>${attemptsText}</strong></p>

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

            if (myTestCount === 0) {
                renderEmptyState(container);
            } else {
                attachEventListeners();
            }

        } else {
            renderEmptyState(container);
        }
    } catch (err) {
        console.error("Тесттерди жүктөөдө ката:", err);
        container.innerHTML = `<p style="color:#ef4444; grid-column: 1/-1; text-align:center;">Жүктөөдө ката чыкты: ${err.message}</p>`;
    }
}

function renderEmptyState(container) {
    container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; grid-column: 1/-1; background:#0f172a; border-radius:12px; border:1px border-dashed #1e293b;">
            <i class="fa-solid fa-folder-open" style="font-size:3rem; color:#334155; margin-bottom:15px;"></i>
            <h3 style="color:#fff; margin-bottom:10px;">Сизде азырынча түзүлгөн жеке тесттер жок</h3>
            <p style="color:#94a3b8; font-size:0.95rem; margin-bottom:20px;">Жаңы тест түзүү үчүн жогорудагы же төмөндөгү баскычты басыңыз.</p>
            <a href="test-builder.html" class="btn-create"><i class="fa-solid fa-plus"></i> Биринчи тестти түзүү</a>
        </div>
    `;
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
                loadMyTests();
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
                    loadMyTests();
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
                    loadMyTests();
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
    const allowReviewToggle = document.getElementById('allowReviewToggle');

    if (!modal || !titleEl || !tableBody) return;

    window.currentActiveTestId = testId;

    titleEl.innerText = `Жыйынтыктар: ${title}`;
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Жүктөлүүдө...</td></tr>';
    modal.style.display = 'flex';

    if (allowReviewToggle) {
        try {
            const testSnap = await get(child(ref(db), `tests/${testId}`));
            if (testSnap.exists()) {
                const testData = testSnap.val();
                allowReviewToggle.checked = testData.allowReview === true;
            } else {
                allowReviewToggle.checked = false;
            }
        } catch (e) {
            console.error("AllowReview абалын окууда ката:", e);
            allowReviewToggle.checked = false;
        }
    }

    try {
        const dbRef = ref(db);
        let foundResultsObj = null;

        const snap1 = await get(child(dbRef, `test_results/${testId}`));
        if (snap1.exists()) foundResultsObj = snap1.val();

        if (!foundResultsObj) {
            const snap2 = await get(child(dbRef, `results/${testId}`));
            if (snap2.exists()) foundResultsObj = snap2.val();
        }

        const testSnapForQuestions = await get(child(dbRef, `tests/${testId}`));
        const testDataObject = testSnapForQuestions.exists() ? testSnapForQuestions.val() : null;

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
                        <button class="btn-action btn-view-details" data-result-key="${key}" title="Деталдуу жоопторду көрүү" style="background:#1e293b; color:#38bdf8; border:1px solid #334155; padding:5px 10px; border-radius:6px; cursor:pointer;">
                            <i class="fa-solid fa-eye"></i> Жооптор
                        </button>
                    </td>
                    <td>
                        <button class="btn-delete-res" data-key="${key}" style="background:none; border:none; color:#ef4444; cursor:pointer;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;

                tr.querySelector('.btn-view-details').addEventListener('click', () => {
                    showStudentDetailsModal(r, testDataObject);
                });

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
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8;">Азырынча эч ким тапшыра элек.</td></tr>';
        }
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#ef4444;">Ката: ${err.message}</td></tr>`;
    }
}

// ФОРМУЛА ЖАНА ТЕКСТТИ ИРЭЭТТҮҮ ФОРМАТТООЧУ ФУНКЦИЯ
function prepareMathText(text) {
    if (!text) return '';
    let str = String(text);
    // Градустарды LaTeX форматына келтирүү
    str = str.replace(/(\d+)\s*°\s*([CС])?/g, '$1^\\circ\\text{$2}$');
    if ((str.includes('\\text') || str.includes('\\frac') || str.includes('^')) && !str.includes('$')) {
        return `$${str}$`;
    }
    return str;
}

// ОКУУЧУНУН ЖЕКЕ ЖООПТОРУН ДЕТАЛДУУ ЖАНА ФОРМУЛАЛАР МЕНЕН КӨРСӨТҮҮ
function showStudentDetailsModal(resultData, testData) {
    let detailModal = document.getElementById('studentDetailModal');
    if (!detailModal) {
        detailModal = document.createElement('div');
        detailModal.id = 'studentDetailModal';
        detailModal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:2000; padding:20px; box-sizing:border-box;';
        document.body.appendChild(detailModal);
    }

    const studentName = resultData.studentName || 'Окуучу';
    const studentClass = resultData.studentClass || '-';
    const score = resultData.score || 0;
    const total = resultData.totalQuestions || 0;
    const percent = resultData.percent || 0;

    let reviewItems = resultData.reviewList || resultData.answersDetails || [];

    let itemsHtml = '';
    if (reviewItems.length > 0) {
        reviewItems.forEach((item, idx) => {
            const isCorrect = item.isCorrect;
            itemsHtml += `
                <div style="background:rgba(2,2,8,0.7); border-radius:10px; padding:15px; margin-bottom:12px; border-left:5px solid ${isCorrect ? '#10b981' : '#ef4444'}; word-break:break-word;">
                    <div style="font-weight:bold; color:#fff; margin-bottom:8px; word-break:break-word;">${idx + 1}. ${prepareMathText(item.questionText || 'Суроо')}</div>
                    <div style="font-size:0.9rem; margin-top:4px; word-break:break-word;"><strong style="color:${isCorrect ? '#10b981' : '#ef4444'}">Окуучунун жообу:</strong> ${prepareMathText(String(item.studentAnswer || 'Жок'))}</div>
                    ${!isCorrect ? `<div style="font-size:0.9rem; margin-top:4px; word-break:break-word;"><strong style="color:#10b981">Туура жооп:</strong> ${prepareMathText(String(item.correctAnswer || '-'))}</div>` : ''}
                    <div style="font-size:0.75rem; color:#64748b; margin-top:6px;">Жумшалган убакыт: ${item.timeSpent || 0} сек</div>
                </div>
            `;
        });
    } else if (testData && testData.questions) {
        const questions = Array.isArray(testData.questions) ? testData.questions : Object.values(testData.questions);
        questions.forEach((q, idx) => {
            itemsHtml += `
                <div style="background:rgba(2,2,8,0.7); border-radius:10px; padding:15px; margin-bottom:12px; border-left:5px solid #334155; word-break:break-word;">
                    <div style="font-weight:bold; color:#fff; margin-bottom:8px; word-break:break-word;">${idx + 1}. ${prepareMathText(q.text || 'Суроо')}</div>
                    <div style="font-size:0.85rem; color:#94a3b8; font-style:italic;">(Бул сакталган мурунку жыйынтык)</div>
                </div>
            `;
        });
    } else {
        itemsHtml = `<p style="text-align:center; color:#94a3b8; padding:30px;">Бул жыйынтык үчүн деталдуу суроо-жооп маалыматтары сакталган эмес.</p>`;
    }

    detailModal.innerHTML = `
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:14px; width:100%; max-width:800px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 0 40px rgba(0,0,0,0.9); box-sizing:border-box;">
            <div style="padding:15px 20px; border-bottom:1px solid #1e293b; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color:#00f2fe; font-size:1.1rem; word-break:break-word; padding-right:15px;"><i class="fa-solid fa-user-graduate"></i> ${escapeHtml(studentName)} (${escapeHtml(studentClass)}) — Жооптордун талдоосу</h3>
                <button id="closeDetailModal" style="background:none; border:none; color:#ef4444; font-size:1.5rem; cursor:pointer; flex-shrink:0;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="padding:15px 20px; background:#1e293b; display:flex; gap:20px; font-size:0.95rem;">
                <div>Упай: <strong>${score} / ${total}</strong></div>
                <div>Пайыз: <strong style="color:#00f2fe;">${percent}%</strong></div>
            </div>
            <div id="detailModalContentBody" style="padding:20px; overflow-y:auto; flex:1; box-sizing:border-box;">
                ${itemsHtml}
            </div>
        </div>
    `;

    document.getElementById('closeDetailModal').addEventListener('click', () => {
        detailModal.style.display = 'none';
    });

    detailModal.style.display = 'flex';

    // MathJax формулаларын динамикалык түрдө кайра иштетүү (рендеринг)
    setTimeout(() => {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([document.getElementById('detailModalContentBody')]).catch((err) => console.error("MathJax error:", err));
        }
    }, 100);
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
