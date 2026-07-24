import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { downloadYearlyReportCSV } from "./annual-report.js";

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
const auth = getAuth(app);

let teacherId = "demo_teacher_001";
let resultsData = [];
let activeResultNode = null;

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupFilters();
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            teacherId = user.uid;
        } else {
            teacherId = localStorage.getItem("bilimal_teacher_uid") || "demo_teacher_001";
        }
        loadResultsData();
    });

    if (window.location.search.includes("triggerReport")) {
        setTimeout(() => { downloadYearlyReportCSV(resultsData); }, 1500);
    }
});

function setupNavigation() {
    bindClick("navDashboard", () => window.location.href = "/sections/tests.html");
    bindClick("navTestBuilder", () => window.location.href = "/sections/test-builder.html");
    bindClick("navResults", () => window.location.href = "/sections/test-results.html");
    bindClick("btnCloseResultModal", () => {
        const modal = document.getElementById("studentDetailModal");
        if (modal) modal.style.display = "none";
    });
    bindClick("btnDownloadYearlyReport", () => downloadYearlyReportCSV(resultsData));
}

function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
}

function loadResultsData() {
    // Мугалимдин бардык тесттеринен натыйжаларды чогултуу
    const testsRef = ref(database, `teachers_data/${teacherId}/tests`);
    onValue(testsRef, (snapshot) => {
        resultsData = [];
        if (snapshot.exists()) {
            const tests = snapshot.val();
            Object.keys(tests).forEach(testId => {
                const test = tests[testId];
                if (test.results) {
                    Object.keys(test.results).forEach(resId => {
                        resultsData.push({
                            id: resId,
                            testId: testId,
                            testTitle: test.title || "Аталышсыз тест",
                            ...test.results[resId]
                        });
                    });
                }
            });
        }
        populateFilterSelectors();
        calculateAnalytics();
        renderResultsTable();
    });
}

function populateFilterSelectors() {
    const classSel = document.getElementById("resFilterClass");
    const testSel = document.getElementById("resFilterTest");
    if (!classSel || !testSel) return;

    const classes = new Set();
    const tests = new Set();

    resultsData.forEach(r => {
        if (r.studentClass || r.classGroup) classes.add(r.studentClass || r.classGroup);
        if (r.testTitle) tests.add(r.testTitle);
    });

    classSel.innerHTML = '<option value="all">Бардык класстар</option>';
    classes.forEach(c => classSel.innerHTML += `<option value="${c}">${c}</option>`);

    testSel.innerHTML = '<option value="all">Бардык тесттер</option>';
    tests.forEach(t => testSel.innerHTML += `<option value="${t}">${t}</option>`);
}

function calculateAnalytics() {
    if (resultsData.length === 0) return;
    let scoreSum = 0;
    let max = 0;
    resultsData.forEach(r => {
        const perc = parseFloat(r.percentage || r.finalPercentage || 0);
        scoreSum += perc;
        const pts = parseFloat(r.score || 0);
        if (pts > max) max = pts;
    });

    const avg = Math.round(scoreSum / resultsData.length);
    safeSetText("anAverageScore", avg + "%");
    safeSetText("anMaxScore", max);
    safeSetText("anSuccessRate", avg >= 60 ? "Жогору" : "Орто");
}

function safeSetText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
}

function setupFilters() {
    const triggers = ["resSearchStudent", "resFilterYear", "resFilterSubject", "resFilterClass", "resFilterTest", "resFilterStatus", "resFilterCheat"];
    triggers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", renderResultsTable);
            if (id === "resSearchStudent") el.addEventListener("input", renderResultsTable);
        }
    });
}

function renderResultsTable() {
    const tbody = document.getElementById("resultsMainTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const nameQuery = getVal("resSearchStudent").toLowerCase();
    const classQuery = getVal("resFilterClass");
    const testQuery = getVal("resFilterTest");
    const statusQuery = getVal("resFilterStatus");
    const cheatQuery = getVal("resFilterCheat");

    const filtered = resultsData.filter(r => {
        const sName = (r.studentName || "").toLowerCase();
        const sClass = r.studentClass || r.classGroup || "";
        
        if (nameQuery && !sName.includes(nameQuery)) return false;
        if (classQuery !== "all" && sClass !== classQuery) return false;
        if (testQuery !== "all" && r.testTitle !== testQuery) return false;
        if (statusQuery !== "all" && r.reviewStatus !== statusQuery) return false;
        if (cheatQuery === "yes" && !(r.antiCheatViolations > 0 || r.hasCheatWarning)) return false;
        return true;
    });

    const noDataMsg = document.getElementById("resNoDataMsg");
    if (filtered.length === 0) {
        if (noDataMsg) noDataMsg.style.display = "block";
        return;
    }
    if (noDataMsg) noDataMsg.style.display = "none";

    filtered.forEach(r => {
        const tr = document.createElement("tr");
        const hasViolations = r.antiCheatViolations > 0 || r.hasCheatWarning;
        const dateStr = r.timestamp ? new Date(r.timestamp).toLocaleDateString() : (r.endTime ? new Date(r.endTime).toLocaleDateString() : "—");
        
        tr.innerHTML = `
            <td><strong>${r.studentName || "Белгисиз"}</strong></td>
            <td>${r.studentClass || r.classGroup || "—"}</td>
            <td>${r.testTitle || "—"}</td>
            <td>${dateStr}</td>
            <td>${r.durationUsed || 0} мүн</td>
            <td>${r.score || 0} / ${r.totalPoints || r.manualPoints || 0}</td>
            <td>${r.percentage || r.finalPercentage || 0}%</td>
            <td><span style="font-weight:bold; color:#00f2fe;">${r.grade || calculateGrade(r.percentage || 0)}</span></td>
            <td>${hasViolations ? `<span style="color:#ff4a4a;">Шектүү (${r.antiCheatViolations || 1})</span>` : '<span style="color:#00ffa3;">Таза</span>'}</td>
            <td>${r.reviewStatus === 'checked' ? 'Бекитилди' : 'Каралууда'}</td>
            <td><button class="node-btn open-detail" data-id="${r.id}"><i class="fas fa-search-plus"></i> Текшерүү</button></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".open-detail").forEach(b => b.addEventListener("click", (e) => {
        openStudentDetail(e.currentTarget.getAttribute("data-id"));
    }));
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : "all";
}

function calculateGrade(perc) {
    if (perc >= 85) return "5";
    if (perc >= 70) return "4";
    if (perc >= 50) return "3";
    return "2";
}

function openStudentDetail(id) {
    activeResultNode = resultsData.find(r => r.id === id);
    if (!activeResultNode) return;

    const modal = document.getElementById("studentDetailModal");
    if (modal) modal.style.display = "block";

    safeSetText("mdTitle", activeResultNode.studentName || "Окуучу");
    
    const metaBox = document.getElementById("mdMetaInfo");
    if (metaBox) {
        metaBox.innerHTML = `
            <div><strong>Тест:</strong> ${activeResultNode.testTitle || "—"}</div>
            <div><strong>Класс:</strong> ${activeResultNode.studentClass || activeResultNode.classGroup || "—"}</div>
            <div><strong>Датасы:</strong> ${activeResultNode.timestamp ? new Date(activeResultNode.timestamp).toLocaleString() : "—"}</div>
            <div><strong>Алынган упай:</strong> ${activeResultNode.score || 0} / ${activeResultNode.totalPoints || 0}</div>
        `;
    }

    setInputValue("mdManualPoints", activeResultNode.manualPoints || activeResultNode.score || 0);
    setInputValue("mdTeacherComment", activeResultNode.teacherComment || "");
    setInputValue("mdReviewStatus", activeResultNode.reviewStatus || "checked");

    const qBox = document.getElementById("mdQuestionsReviewContainer");
    if (qBox) {
        qBox.innerHTML = "";
        if (activeResultNode.responses) {
            Object.keys(activeResultNode.responses).forEach((k, i) => {
                const resp = activeResultNode.responses[k];
                qBox.innerHTML += `
                    <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:10px;">
                        <div><strong>Суроо №${i+1}:</strong> ${resp.questionText || 'Суроо'}</div>
                        <div style="color:#ffa800;">Окуучунун жообу: ${resp.studentAnswer || 'Жооп берилген эмес'}</div>
                        <div style="color:#00ffa3;">Туура жооп модели: ${resp.correctAnswer || 'Мугалимдин кароосунда'}</div>
                    </div>
                `;
            });
        }
    }

    const btnSave = document.getElementById("mdBtnSaveChanges");
    if (btnSave) btnSave.onclick = saveReviewChanges;
}

function setInputValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function saveReviewChanges() {
    if (!activeResultNode) return;
    activeResultNode.manualPoints = parseInt(document.getElementById("mdManualPoints").value) || 0;
    activeResultNode.teacherComment = document.getElementById("mdTeacherComment").value;
    activeResultNode.reviewStatus = document.getElementById("mdReviewStatus").value;

    const resultRef = ref(database, `teachers_data/${teacherId}/tests/${activeResultNode.testId}/results/${activeResultNode.id}`);
    set(resultRef, activeResultNode)
        .then(() => {
            const modal = document.getElementById("studentDetailModal");
            if (modal) modal.style.display = "none";
            alert("Баалоо маалыматтары базага ийгиликтүү бекитилди!");
            loadResultsData();
        })
        .catch(err => {
            console.error("Сактоодо ката:", err);
            alert("Маалыматтарды сактоодо ката кетти.");
        });
}
