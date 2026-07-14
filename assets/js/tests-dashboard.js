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
    if (!str || typeof str !== 'string' || str.trim() === "" || str === "undefined") {
        return null;
    }
    try {
        const p = JSON.parse(str);
        return (typeof p === 'object' && p !== null) ? p : null;
    } catch (e) {
        console.warn("Бузулган JSON табылды, тазаланууда...");
        return null;
    }
}

function showToast(msg, isErr = false) {
    if (isErr) {
        console.warn("Билимал Эскертүү: " + msg);
    } else {
        alert(msg);
    }
}

let dbCache = { tests: {}, results: {}, classes: {}, activityLogs: {} };

document.addEventListener("DOMContentLoaded", () => {
    const localKey = `bilimal_${teacherId}_backup`;
    const checkStorage = localStorage.getItem(localKey);
    if (checkStorage && (checkStorage === "undefined" || checkStorage.trim() === "")) {
        localStorage.removeItem(localKey);
    }

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

        try {
            localStorage.setItem(`bilimal_${teacherId}_backup`, JSON.stringify(dbCache));
        } catch(e) {
            console.error("Бэкап сактоодо ката: ", e);
        }
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
    const teacherNameEl = document.getElementById("lblTeacherName");
    if (teacherNameEl) {
        teacherNameEl.textContent = "Мугалим: Мугалим";
    }
    
    const testsArr = Object.keys(dbCache.tests).map(k => ({id: k, ...dbCache.tests[k]}));
    const resultsArr = Object.keys(dbCache.results).map(k => ({id: k, ...dbCache.results[k]}));

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
    
    const el1 = document.getElementById("statTotalTests"); if(el1) el1.textContent = totalTests;
    const el2 = document.getElementById("statActiveTests"); if(el2) el2.textContent = activeTests;
    const el3 = document.getElementById("statDraftTests"); if(el3) el3.textContent = draftTests;
    const el4 = document.getElementById("statUncheckedResults"); if(el4) el4.textContent = unchecked;
    const el5 = document.getElementById("statTotalStudents"); if(el5) el5.textContent = totalStudentsSet.size;
    const el6 = document.getElementById("statAverageScore"); if(el6) el6.textContent = resultsArr.length ? Math.round(totalScoreSum / resultsArr.length) + "%" : "0%";

    renderTestsTable(testsArr, resultsArr);
    renderActivityTable(resultsArr);
}

function renderTestsTable(tests, results) {
    const tbody = document.getElementById("dashboardTestsTableBody");
    const msg = document.getElementById("noTestsMessage");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    if(tests.length === 0) {
        if(msg) msg.style.display = "block";
        return;
    }
    if(msg) msg.style.display = "none";

    tests.forEach(t => {
        const countSub = results.filter(r => r.testId === t.id).length;
        
        let subjectText = "Астрономия";
        const testTitleLower = (t.title || "").toString().toLowerCase();
        
        if (t.subject) {
            const subStr = t.subject.toString().toLowerCase().trim();
            if (subStr === "physics" || subStr === "физика") {
                subjectText = "Физика";
            }
        } else if (testTitleLower.includes("механика") || testTitleLower.includes("физика")) {
            subjectText = "Физика";
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${t.title || "Аталышсыз"}</strong></td>
            <td>${subjectText}</td>
            <td>${t.classGroup || "—"}</td>
            <td>${t.questions ? Object.keys(t.questions).length : 0}</td>
            <td>${t.duration || 0} мүн</td>
            <td><span class="status-badge ${t.status === 'active' ? 'active' : 'draft'}">${t.status === 'active' ? 'Активдүү' : 'Черновик'}</span></td>
            <td>${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
            <td>${countSub} окуучу</td>
            <td>
                <button class="table-action-btn copy-link-btn" data-id="${t.id}"><i class="fas fa-link"></i> Ссылка</button>
                <button class="table-action-btn edit-btn edit-t" data-id="${t.id}"><i class="fas fa-edit"></i> Редакциялоо</button>
                <button class="action-btn delete-t" style="color:#ff4a4a; margin-left: 5px; background: none; border: none; cursor: pointer;" data-id="${t.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".copy-link-btn").forEach(b => b.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const testLink = `https://bilimal.org/sections/take-test.html?teacherId=${teacherId}&id=${id}`;
        
        navigator.clipboard.writeText(testLink).then(() => {
            showToast("Тесттин шилтемеси көчүрүлдү!");
        }).catch(err => {
            console.error("Көчүрүүдө ката: ", err);
        });
    }));

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
    if (!tbody) return;
    tbody.innerHTML = "";

    if(results.length === 0) {
        if(msg) msg.style.display = "block";
        return;
    }
    if(msg) msg.style.display = "none";

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
