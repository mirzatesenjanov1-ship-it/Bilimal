import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.firebasestorage.app",
    messagingSenderId: "241750360816",
    appId: "1:241750360816:web:a991434eb5afbc470d7835"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

let currentUser = null;
let currentActiveTestId = null;
let allTests = [];

// Аутентификация текшерүү
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadTests();
            setupEventListeners();
        } else {
            window.location.href = "/auth.html";
        }
    });
});

// Негизги теги/баскычтарга окуяларды туташтыруу
function setupEventListeners() {
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", loadTests);

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allTests.filter(t => 
                (t.title && t.title.toLowerCase().includes(query)) ||
                (t.subject && t.subject.toLowerCase().includes(query)) ||
                (t.id && t.id.toLowerCase().includes(query))
            );
            renderTests(filtered);
        });
    }

    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);

    const copyLinkBtn = document.getElementById("copyLinkBtn");
    if (copyLinkBtn) copyLinkBtn.addEventListener("click", copyLink);

    const deleteTestBtn = document.getElementById("deleteTestBtn");
    if (deleteTestBtn) deleteTestBtn.addEventListener("click", deleteTest);

    const excelExportBtn = document.getElementById("excelExportBtn");
    if (excelExportBtn) excelExportBtn.addEventListener("click", exportToExcel);
}

// Тесттерди базадан жүктөө
async function loadTests() {
    if (!currentUser) return;
    try {
        const testsRef = ref(database, `teachers_data/${currentUser.uid}/tests`);
        const snapshot = await get(testsRef);
        
        allTests = [];
        let totalSubmits = 0;
        let activeCount = 0;

        if (snapshot.exists()) {
            const data = snapshot.val();
            for (let id in data) {
                const test = data[id];
                test.id = id;
                allTests.push(test);
                
                if (test.status === "active" || (test.settings && test.settings.isPublic)) {
                    activeCount++;
                }
                
                if (test.results) {
                    totalSubmits += Object.keys(test.results).length;
                } else if (test.submissionsCount) {
                    totalSubmits += test.submissionsCount;
                }
            }
        }

        updateDashboardStats(allTests.length, activeCount, totalSubmits);
        renderTests(allTests);

    } catch (error) {
        console.error("Маалымат алууда ката кетти:", error);
    }
}

function updateDashboardStats(total, active, submits) {
    const elTotal = document.getElementById("statTotal");
    const elActive = document.getElementById("statActive");
    const elSubmits = document.getElementById("statSubmits");
    const elAvg = document.getElementById("statAvg");

    if (elTotal) elTotal.innerText = total;
    if (elActive) elActive.innerText = active;
    if (elSubmits) elSubmits.innerText = submits;
    if (elAvg) elAvg.innerText = total > 0 ? "100%" : "0%";
}

function renderTests(tests) {
    const container = document.getElementById("testListContainer");
    if (!container) return;
    container.innerHTML = "";
    
    if (tests.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 30px;">
                <i class="fas fa-folder-open" style="font-size: 32px; color: #94a3b8;"></i>
                <p style="margin-top: 10px; color: #94a3b8;">Тесттер табылган жок.</p>
            </div>`;
        return;
    }

    [...tests].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).forEach(test => {
        const div = document.createElement("div");
        div.className = "test-card";
        const createdDate = test.createdAt ? new Date(test.createdAt).toLocaleDateString() : "Белгисиз";
        
        const isActive = test.status === "active" || (test.settings && test.settings.isPublic);
        const statusBadge = isActive 
            ? '<span class="badge badge-active" style="color: #00f2fe; font-size: 12px;">● Активдүү</span>' 
            : '<span class="badge badge-draft" style="color: #ffaa00; font-size: 12px;">● Черновик</span>';

        div.innerHTML = `
            <div class="test-card-header" style="display:flex; justify-style:space-between; align-items:center;">
                <h4>${test.title || 'Аталышсыз тест'}</h4>
                ${statusBadge}
            </div>
            <div class="test-meta" style="margin: 8px 0; color:#94a3b8; font-size: 13px;">
                <span><i class="fas fa-book"></i> ${test.subject || 'Предмет'}</span> | 
                <span><i class="fas fa-clock"></i> ${createdDate}</span>
            </div>
            <div class="test-id" style="font-size: 12px; color:#64748b;">ID: ${test.id}</div>
            <div class="test-card-footer" style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="btn btn-primary open-modal-btn" data-id="${test.id}" data-title="${test.title || ''}">
                    <i class="fas fa-cog"></i> Башкаруу
                </button>
                <button class="btn btn-outline edit-btn" data-id="${test.id}">
                    <i class="fas fa-pen"></i> Оңдоо
                </button>
            </div>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.open-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            openTestModal(target.getAttribute('data-id'), target.getAttribute('data-title'));
        });
    });

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            window.location.href = `/sections/test-builder.html?edit=${id}`;
        });
    });
}

// 🎯 УШУЛ МЕСТА ОҢДОЛДУ: Шилтеме /sections/student-test.html дарегине багытталды
function openTestModal(testId, title) {
    currentActiveTestId = testId;
    const titleEl = document.getElementById("modalTestTitle");
    if (titleEl) titleEl.innerText = title || "Тестти башкаруу";
    
    // Окуучулар үчүн оңдолгон шилтеме дареги (/sections/ кошулду):
    const shareUrl = `${window.location.origin}/sections/student-test.html?teacher=${currentUser.uid}&test=${testId}`;
    const shareInput = document.getElementById("shareLinkInput");
    if (shareInput) shareInput.value = shareUrl;
    
    // QR Code түзүү
    const qrContainer = document.getElementById("qrcode");
    if (qrContainer) {
        qrContainer.innerHTML = "";
        if (typeof QRCode !== "undefined") {
            new QRCode(qrContainer, {
                text: shareUrl,
                width: 150,
                height: 150,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
    }

    const modal = document.getElementById("testModal");
    if (modal) modal.style.display = "flex";
}

function closeModal() {
    const modal = document.getElementById("testModal");
    if (modal) modal.style.display = "none";
    currentActiveTestId = null;
}

function copyLink() {
    const input = document.getElementById("shareLinkInput");
    if (input && input.value) {
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            alert("Шилтеме көчүрүлдү!");
        }).catch(() => {
            document.execCommand("copy");
            alert("Шилтеме көчүрүлдү!");
        });
    }
}

async function deleteTest() {
    if (!currentActiveTestId || !currentUser) return;
    if (confirm("Бул тестти биротоло өчүрүүнү каалайсызбы?")) {
        try {
            const testRef = ref(database, `teachers_data/${currentUser.uid}/tests/${currentActiveTestId}`);
            const lookupRef = ref(database, `global_test_lookup/${currentActiveTestId}`);
            
            await remove(testRef);
            await remove(lookupRef);
            
            closeModal();
            loadTests();
        } catch (error) {
            console.error("Өчүрүү катасы:", error);
            alert("Өчүрүүдө ката кетти же уруксат берилген жок.");
        }
    }
}

async function exportToExcel() {
    if (!currentActiveTestId || !currentUser) return;

    if (typeof XLSX === "undefined") {
        alert("Excel китепканасы (SheetJS) жүктөлгөн эмес!");
        return;
    }

    try {
        const resultsRef = ref(database, `teachers_data/${currentUser.uid}/tests/${currentActiveTestId}/results`);
        const snapshot = await get(resultsRef);

        let exportData = [];

        if (snapshot.exists()) {
            const results = snapshot.val();
            let index = 1;
            for (let key in results) {
                const res = results[key];
                exportData.push({
                    "№": index++,
                    "Окуучу": res.studentName || "Белгисиз",
                    "Класс": res.studentClass || "-",
                    "Упай": res.score || 0,
                    "Жалпы суроо": res.totalQuestions || 0,
                    "Пайыз": res.percentage ? res.percentage + "%" : "0%",
                    "Убакыт": res.timestamp || "-"
                });
            }
        } else {
            exportData.push({
                "№": 1,
                "Окуучу": "Тест тапшырган окуучу жок",
                "Класс": "-",
                "Упай": 0,
                "Жалпы суроо": 0,
                "Пайыз": "0%",
                "Убакыт": "-"
            });
        }

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Жыйынтыктар");

        XLSX.writeFile(workbook, `Test_Results_${currentActiveTestId}.xlsx`);
    } catch (err) {
        console.error("Excel экспортто ката кетти:", err);
        alert("Экспорттоодо ката чыкты.");
    }
}

// Глобалдык чакыруулар
window.loadTests = loadTests;
window.openTestModal = openTestModal;
window.closeModal = closeModal;
window.copyLink = copyLink;
window.deleteTest = deleteTest;
