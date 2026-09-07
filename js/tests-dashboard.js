import { db, auth } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, child, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = {
                uid: user.uid,
                email: user.email ? user.email.toLowerCase().trim() : ''
            };
            await loadTeacherTests();
        } else {
            // Fallback: LocalStorage аркылуу колдонуучунун сессиясын текшерүү
            const storedEmail = localStorage.getItem('userEmail') || localStorage.getItem('email');
            const storedUid = localStorage.getItem('userId') || localStorage.getItem('uid');

            if (storedEmail || storedUid) {
                currentUser = {
                    uid: storedUid || 'local_' + Date.now(),
                    email: storedEmail ? storedEmail.toLowerCase().trim() : ''
                };
                await loadTeacherTests();
            } else {
                alert("Платформага кирүү үчүн авторизация талап кылынат!");
                window.location.href = '/login.html';
            }
        }
    });
});

async function loadTeacherTests() {
    const loadingEl = document.getElementById('loadingIndicator') || document.querySelector('.loading-text') || createOrGetLoadingEl();
    const container = document.getElementById('testsContainer') || document.getElementById('tests-list') || document.querySelector('.tests-grid');

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, 'tests'));

        if (loadingEl) loadingEl.style.display = 'none';

        if (!container) {
            console.warn("Тесттерди көрсөтүүчү контейнер (DOM element) табылган жок.");
            return;
        }

        container.innerHTML = '';

        if (!snapshot.exists()) {
            container.innerHTML = '<div class="no-data">Азырынча эч кандай тест түзүлө элек.</div>';
            return;
        }

        const allTests = snapshot.val();
        const userTests = [];

        // Колдонуучунун ID/Email боюнча тесттерин чыпкалоо
        for (const key in allTests) {
            const test = allTests[key];
            test.id = key;

            const isOwner = 
                (test.ownerUid && test.ownerUid === currentUser.uid) ||
                (test.authorId && test.authorId === currentUser.uid) ||
                (test.userId && test.userId === currentUser.uid) ||
                (test.uid && test.uid === currentUser.uid) ||
                (test.authorEmail && test.authorEmail.toLowerCase() === currentUser.email) ||
                (test.email && test.email.toLowerCase() === currentUser.email) ||
                (test.userEmail && test.userEmail.toLowerCase() === currentUser.email);

            if (isOwner) {
                userTests.push(test);
            }
        }

        if (userTests.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align:center; padding:40px; color:#a5b4fc;">
                    <i class="fa-solid fa-folder-open" style="font-size: 48px; margin-bottom:15px; display:block;"></i>
                    <p>Сиз тараптан азырынча тест түзүлө элек.</p>
                    <a href="test-builder.html" class="btn btn-primary" style="margin-top:10px; display:inline-block;">Жаңы Тест Түзүү</a>
                </div>
            `;
            return;
        }

        // Тесттерди акыркы өзгөртүлгөн убактысы боюнча сорттоо
        userTests.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

        // Тесттерди экранга чыгаруу
        userTests.forEach(test => {
            const card = document.createElement('div');
            card.className = 'test-card';
            card.style.cssText = "background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 15px; color: #fff;";

            const qCount = test.questions ? (Array.isArray(test.questions) ? test.questions.length : Object.keys(test.questions).length) : 0;

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h3 style="margin:0 0 8px 0; color:#00f0ff; font-size:1.2rem;">${escapeHtml(test.title || 'Аталышсыз тест')}</h3>
                        <p style="margin:0 0 5px 0; color:#cbd5e1; font-size:0.9rem;">Предмет: <strong>${escapeHtml(test.subject || '-')}</strong> | Класс: <strong>${escapeHtml(test.grade || '-')}</strong></p>
                        <p style="margin:0; color:#94a3b8; font-size:0.85rem;">Суроолор: <strong>${qCount}</strong> | Убакыт: <strong>${test.duration || 15} мүн</strong></p>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <a href="test-builder.html?id=${test.id}" class="btn btn-sm" style="background:#3b82f6; color:#fff; padding:6px 12px; border-radius:6px; text-decoration:none;"><i class="fa-solid fa-pen"></i> Оңдоо</a>
                        <button onclick="deleteTest('${test.id}')" class="btn btn-sm" style="background:#ef4444; color:#fff; padding:6px 12px; border-radius:6px; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i> Өчүрүү</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error("Тесттерди жүктөөдө ката чыкты:", err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (container) {
            container.innerHTML = `<div class="error-msg" style="color:#f87171;">Маалыматты жүктөөдө ката чыкты: ${err.message}</div>`;
        }
    }
}

window.deleteTest = async function(testId) {
    if (!confirm("Чын эле бул тестти өчүрүүнү каалайсызбы?")) return;

    try {
        await remove(ref(db, `tests/${testId}`));
        alert("Тест өчүрүлдү!");
        await loadTeacherTests();
    } catch (err) {
        console.error("Өчүрүүдө ката чыкты:", err);
        alert("Өчүрүү мүмкүн болбоду: " + err.message);
    }
};

function createOrGetLoadingEl() {
    let el = document.getElementById('loadingIndicator');
    if (!el) {
        const textHolder = document.body;
        // Эгер тексти бар болсо табат
        const allNodes = document.querySelectorAll('*');
        for (let node of allNodes) {
            if (node.children.length === 0 && node.textContent.includes('Тесттер жүктөлүүдө')) {
                return node;
            }
        }
    }
    return el;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
