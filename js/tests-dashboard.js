import { auth, db } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../dashboard.html";
        return;
    }
    loadTeacherTests(user.uid);
});

async function loadTeacherTests(uid) {
    const container = document.getElementById('testContainer');
    const testsRef = ref(db, 'tests');
    
    try {
        const snapshot = await get(testsRef);
        container.innerHTML = '';

        if (!snapshot.exists()) {
            container.innerHTML = '<p>Азырынча тесттер жок.</p>';
            return;
        }

        snapshot.forEach(child => {
            const test = child.val();
            const testId = child.key;

            if (test.ownerUid === uid) {
                const card = document.createElement('div');
                card.className = 'test-card';
                card.innerHTML = `
                    <h3>${test.title}</h3>
                    <p>Предмет: ${test.subject} (${test.grade}-класс)</p>
                    <p>Убакыт: ${test.duration} мүнөт</p>
                    <div class="card-actions">
                        <button class="btn-action" onclick="copyLink('${testId}')"><i class="fas fa-link"></i> Ссылка</button>
                        <button class="btn-action" onclick="viewResults('${testId}', '${test.title}')"><i class="fas fa-poll"></i> Жыйынтыктар</button>
                        <button class="btn-action btn-delete" onclick="deleteTest('${testId}')"><i class="fas fa-trash"></i> Өчүрүү</button>
                    </div>
                `;
                container.appendChild(card);
            }
        });
    } catch (e) {
        container.innerHTML = `<p style="color:#ff0055">Ката: ${e.message}</p>`;
    }
}

window.copyLink = (testId) => {
    const url = `${window.location.origin}/test.html?testId=${testId}`;
    navigator.clipboard.writeText(url);
    alert('Шилтеме көчүрүлдү: ' + url);
};

window.deleteTest = async (testId) => {
    if (confirm('Тестти өчүрүүнү каалайсызбы?')) {
        await remove(ref(db, `tests/${testId}`));
        location.reload();
    }
};

window.viewResults = async (testId, title) => {
    document.getElementById('modalTitle').innerText = `${title} — Жыйынтыктар`;
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '<tr><td colspan="5">Жүктөлүүдө...</td></tr>';
    document.getElementById('resultsModal').style.display = 'flex';

    const resRef = ref(db, `results/${testId}`);
    const snapshot = await get(resRef);
    tbody.innerHTML = '';

    if (!snapshot.exists()) {
        tbody.innerHTML = '<tr><td colspan="5">Азырынча тапшырган окуучулар жок.</td></tr>';
        return;
    }

    snapshot.forEach(child => {
        const r = child.val();
        const date = new Date(r.submittedAt).toLocaleDateString();
        tbody.innerHTML += `
            <tr>
                <td>${r.studentName}</td>
                <td>${r.studentClass}</td>
                <td>${r.score}/${r.total}</td>
                <td>${r.percentage}%</td>
                <td>${date}</td>
            </tr>
        `;
    });
};

document.getElementById('closeModal').onclick = () => {
    document.getElementById('resultsModal').style.display = 'none';
};
