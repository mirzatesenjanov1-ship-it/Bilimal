import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.firebasestorage.app",
    messagingSenderId: "241750360816",
    appId: "1:241750360816:web:a991434eb5afbc470d7835",
    measurementId: "G-9GSQV60QV0"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const teacherId = "demo_teacher_001";

function safeJsonParse(str) {
    if (!str) return null;
    try {
        const p = JSON.parse(str);
        return (typeof p === 'object' && p !== null) ? p : null;
    } catch (e) {
        return null;
    }
}

function showToast(msg, isErr = false) {
    alert((isErr ? "Ката: " : "") + msg);
}

let dbCache = { tests: {}, results: {}, classes: {}, activityLogs: {} };

document.addEventListener("DOMContentLoaded", () => {
    initClock();
    setupNavigation();
    setupActionListeners();
    syncData();
});

function initClock() {
    const clockEl = document.getElementById("lblDateTime");
    if(clockEl) {
        setInterval(() => {
            clockEl.textContent = "Учурдагы убакыт: " + new Date().toLocaleString("ky-KG");
        }, 1000);
    }
}

function setupNavigation() {
    document.getElementById("navDashboard")?.addEventListener("click", () => window.location.href = "/sections/tests.html");
    document.getElementById("navTestBuilder")?.addEventListener("click", () => window.location.href = "/sections/test-builder.html");
    document.getElementById("navResults")?.addEventListener("click", () => window.location.href = "/sections/test-results.html");
    document.getElementById("createNewTestBtn")?.addEventListener("click", () => window.location.href = "/sections/test-builder.html");
    document.getElementById("mobileToggle")?.addEventListener("click", () => document.getElementById("sidebar")?.classList.toggle("open"));
}

function syncData() {
    const rootRef = ref(database, `teachers/${teacherId}`);
    onValue(rootRef, (snapshot) => {
        const data = snapshot.val() || {};
        dbCache.tests = data.tests || {};
        dbCache.results = data.results || {};
        dbCache.classes = data.classes || {};
        dbCache.activityLogs = data.activityLogs || {};

        localStorage.setItem(`bilimal_${teacherId}_backup`, JSON.stringify(dbCache));
        processAndRender();
    }, (error) => {
        showToast("Тармактан маалымат алуу үзгүлтүккө учурады, локалдык сактагыч иштеп жатат.", true);
        const backup = localStorage.getItem(`bilimal_${teacherId}_backup`);
        if(backup) {
            const parsed = safeJsonParse(backup);
            if(parsed) dbCache = parsed;
        }
        processAndRender();
    });
}

function processAndRender() {
    document.getElementById("lblTeacherName").textContent = "Мугалим: Демо Мугалим";
    
    const testsArr = Object.keys(dbCache.tests).map(k => ({id: k, ...dbCache.tests[k]}));
    const resultsArr = Object.keys(dbCache.results).map(k => ({id: k, ...dbCache.results[k]}));

    // Статистика эсептөө
    const totalTests = testsArr.length;
    const activeTests = testsArr.filter(t => t.status === "active").length;
    const draftTests = testsArr.filter(t => t.status === "draft").length;
    const unchecked = resultsArr.filter(r => r.reviewStatus !== "checked").length;
    
    let totalStudentsSet = new Set();
    let totalScoreSum = 0;
    resultsArr.forEach(r => {
        if(r.studentName) totalStudentsSet.add(r.studentName);
        totalScoreSum += parseFloat(r.finalPercentage || 0);
    });
    
    document.getElementById("statTotalTests").textContent = totalTests;
    document.getElementById("statActiveTests").textContent = activeTests;
    document.getElementById("statDraftTests").textContent = draftTests;
    document.getElementById("statUncheckedResults").textContent = unchecked;
    document.getElementById("statTotalStudents").textContent = totalStudentsSet.size;
    document.getElementById("statAverageScore").textContent = resultsArr.length ? Math.round(totalScoreSum / resultsArr.length) + "%" : "0%";

    renderTestsTable(testsArr, resultsArr);
    renderActivityTable(resultsArr);
}

function renderTestsTable(tests, results) {
    const tbody = document.getElementById("dashboardTestsTableBody");
    const msg = document.getElementById("noTestsMessage");
    tbody.innerHTML = "";
    
    if(tests.length === 0) {
        msg.style.display = "block";
        return;
    }
    msg.style.display = "none";

    tests.forEach(t => {
        const countSub = results.filter(r => r.testId === t.id).length;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${t.title || "Аталышсыз"}</strong></td>
            <td>${t.subject === "physics" ? "Физика" : "Астрономия"}</td>
            <td>${t.classGroup || "—"}</td>
            <td>${t.questions ? Object.keys(t.questions).length : 0}</td>
            <td>${t.duration || 0} мүн</td>
            <td><span class="status-badge ${t.status === 'active' ? 'active' : 'draft'}">${t.status === 'active' ? 'Активдүү' : 'Черновик'}</span></td>
            <td>${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
            <td>${countSub} окуучу</td>
            <td>
                <button class="action-btn edit-t" data-id="${t.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-t" style="color:#ff4a4a;" data-id="${t.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".edit-t").forEach(b => b.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        window.location.href = `/sections/test-builder.html?edit=${id}`;
    }));

    tbody.querySelectorAll(".delete-t").forEach(b => b.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if(confirm("Тестти өчүрүүнү каалайсызбы?")) {
            remove(ref(database, `teachers/${teacherId}/tests/${id}`)).then(() => showToast("Тест өчүрүлдү."));
        }
    }));
}

function renderActivityTable(results) {
    const tbody = document.getElementById("studentActivityTableBody");
    const msg = document.getElementById("noActivityMessage");
    tbody.innerHTML = "";

    if(results.length === 0) {
        msg.style.display = "block";
        return;
    }
    msg.style.display = "none";

    results.slice(-5).reverse().forEach(r => {
        const tr = document.createElement("tr");
        const cheatBadge = r.hasCheatWarning ? `<span class="badge-cheat">Эскертүү бар</span>` : `<span class="badge-safe">Таза</span>`;
        tr.innerHTML = `
            <td>${r.studentName || "Белгисиз"}</td>
            <td>${r.classGroup || "—"}</td>
            <td>${r.testTitle || "—"}</td>
            <td>${r.startTime ? new Date(r.startTime).toLocaleTimeString() : "—"}</td>
            <td>${r.endTime ? new Date(r.endTime).toLocaleTimeString() : "—"}</td>
            <td>${r.score || 0} (${r.finalPercentage || 0}%)</td>
            <td>${r.reviewStatus === 'checked' ? 'Бекитилди' : 'Каралууда'}</td>
            <td>${cheatBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

function setupActionListeners() {
    document.getElementById("actCreateNew")?.addEventListener("click", () => window.location.href = "/sections/test-builder.html");
    document.getElementById("actViewResults")?.addEventListener("click", () => window.location.href = "/sections/test-results.html");
    
    document.getElementById("actExportJSON")?.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(dbCache.tests, null, 2)], {type : 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Bilimal_Tests_Export_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        showToast("Бардык тесттер экспорттолду.");
    });

    const fileInput = document.getElementById("jsonFileInput");
    document.getElementById("actImportJSON")?.addEventListener("click", () => fileInput.click());
    fileInput?.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const parsed = safeJsonParse(evt.target.result);
            if(!parsed) { showToast("Ката: Бузулган JSON файл", true); return; }
            Object.keys(parsed).forEach(k => {
                const newRef = push(ref(database, `teachers/${teacherId}/tests`));
                set(newRef, parsed[k]);
            });
            showToast("Тесттер ийгиликтүү импорттолду.");
        };
        reader.readAsText(file);
    });

    document.getElementById("actAddClass")?.addEventListener("click", () => {
        const clsName = prompt("Жаңы класстын аталышын жазыңыз (Мисалы: 11-Б):");
        if(clsName) {
            const newClassRef = push(ref(database, `teachers/${teacherId}/classes`));
            set(newClassRef, { className: clsName, createdAt: new Date().toISOString() })
                .then(() => showToast(`Класс ${clsName} кошулду.`));
        }
    });

    document.getElementById("actDownloadAnnual")?.addEventListener("click", () => {
        window.location.href = "/sections/test-results.html?triggerReport=1";
    });

    document.getElementById("btnNotifications")?.addEventListener("click", () => showToast("Жаңы билдирүүлөр жок."));
    document.getElementById("btnProfileView")?.addEventListener("click", () => showToast("Профиль модулу даярдалууда."));
}
