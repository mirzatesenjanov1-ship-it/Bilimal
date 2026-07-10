import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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
const teacherId = "demo_teacher_001";

let resultsData = [];
let activeResultNode = null;

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    loadResultsData();
    setupFilters();
    
    if(window.location.search.includes("triggerReport")) {
        setTimeout(() => { downloadYearlyReportCSV(resultsData); }, 1500);
    }
});

function setupNavigation() {
    document.getElementById("navDashboard").addEventListener("click", () => window.location.href = "/sections/tests.html");
    document.getElementById("navTestBuilder").addEventListener("click", () => window.location.href = "/sections/test-builder.html");
    document.getElementById("navResults").addEventListener("click", () => window.location.href = "/sections/test-results.html");
    document.getElementById("btnCloseResultModal").addEventListener("click", () => document.getElementById("studentDetailModal").style.display = "none");
    document.getElementById("btnDownloadYearlyReport").addEventListener("click", () => downloadYearlyReportCSV(resultsData));
}

function loadResultsData() {
    onValue(ref(database, `teachers/${teacherId}/results`), (snapshot) => {
        const val = snapshot.val();
        resultsData = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        populateFilterSelectors();
        calculateAnalytics();
        renderResultsTable();
    });
}

function populateFilterSelectors() {
    const classSel = document.getElementById("resFilterClass");
    const testSel = document.getElementById("resFilterTest");
    
    const classes = new Set();
    const tests = new Set();
    
    resultsData.forEach(r => {
        if(r.classGroup) classes.add(r.classGroup);
        if(r.testTitle) tests.add(r.testTitle);
    });

    classSel.innerHTML = '<option value="all">Бардык класстар</option>';
    classes.forEach(c => classSel.innerHTML += `<option value="${c}">${c}</option>`);

    testSel.innerHTML = '<option value="all">Бардык тесттер</option>';
    tests.forEach(t => testSel.innerHTML += `<option value="${t}">${t}</option>`);
}

function calculateAnalytics() {
    if(resultsData.length === 0) return;
    let scoreSum = 0;
    let max = 0;
    resultsData.forEach(r => {
        scoreSum += parseFloat(r.finalPercentage || 0);
        if((r.score || 0) > max) max = r.score;
    });
    document.getElementById("anAverageScore").textContent = Math.round(scoreSum / resultsData.length) + "%";
    document.getElementById("anMaxScore").textContent = max;
    document.getElementById("anSuccessRate").textContent = Math.round(scoreSum / resultsData.length) >= 60 ? "Жогору" : "Орто";
}

function setupFilters() {
    const triggers = ["resSearchStudent", "resFilterYear", "resFilterSubject", "resFilterClass", "resFilterTest", "resFilterStatus", "resFilterCheat"];
    triggers.forEach(id => document.getElementById(id).addEventListener("change", renderResultsTable));
    document.getElementById("resSearchStudent").addEventListener("input", renderResultsTable);
}

function renderResultsTable() {
    const tbody = document.getElementById("resultsMainTableBody");
    tbody.innerHTML = "";

    const nameQuery = document.getElementById("resSearchStudent").value.toLowerCase();
    const classQuery = document.getElementById("resFilterClass").value;
    const testQuery = document.getElementById("resFilterTest").value;
    const statusQuery = document.getElementById("resFilterStatus").value;
    const cheatQuery = document.getElementById("resFilterCheat").value;

    const filtered = resultsData.filter(r => {
        if(nameQuery && !r.studentName?.toLowerCase().includes(nameQuery)) return false;
        if(classQuery !== "all" && r.classGroup !== classQuery) return false;
        if(testQuery !== "all" && r.testTitle !== testQuery) return false;
        if(statusQuery !== "all" && r.reviewStatus !== statusQuery) return false;
        if(cheatQuery === "yes" && !r.hasCheatWarning) return false;
        return true;
    });

    if(filtered.length === 0) {
        document.getElementById("resNoDataMsg").style.display = "block";
        return;
    }
    document.getElementById("resNoDataMsg").style.display = "none";

    filtered.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${r.studentName || "Белгисиз"}</strong></td>
            <td>${r.classGroup || "—"}</td>
            <td>${r.testTitle || "—"}</td>
            <td>${r.endTime ? new Date(r.endTime).toLocaleDateString() : "—"}</td>
            <td>${r.durationUsed || 0} мүн</td>
            <td>${r.score || 0} / ${r.manualPoints || 0}</td>
            <td>${r.finalPercentage || 0}%</td>
            <td><span style="font-weight:bold; color:#00f2fe;">${r.grade || '3'}</span></td>
            <td>${r.hasCheatWarning ? '<span style="color:#ff4a4a;">Шектүү</span>' : 'Таза'}</td>
            <td>${r.reviewStatus === 'checked' ? 'Бекитилди' : 'Каралууда'}</td>
            <td><button class="node-btn open-detail" data-id="${r.id}"><i class="fas fa-search-plus"></i> Текшерүү</button></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".open-detail").forEach(b => b.addEventListener("click", (e) => {
        openStudentDetail(e.target.getAttribute("data-id"));
    }));
}

function openStudentDetail(id) {
    activeResultNode = resultsData.find(r => r.id === id);
    if(!activeResultNode) return;

    document.getElementById("studentDetailModal").style.display = "block";
    document.getElementById("mdTitle").textContent = activeResultNode.studentName;
    
    document.getElementById("mdMetaInfo").innerHTML = `
        <div><strong>Тест:</strong> ${activeResultNode.testTitle}</div>
        <div><strong>Класс:</strong> ${activeResultNode.classGroup}</div>
        <div><strong>Датасы:</strong> ${new Date(activeResultNode.endTime).toLocaleString()}</div>
        <div><strong>Автоматтык упай:</strong> ${activeResultNode.score}</div>
    `;

    document.getElementById("mdManualPoints").value = activeResultNode.manualPoints || 0;
    document.getElementById("mdTeacherComment").value = activeResultNode.teacherComment || "";
    document.getElementById("mdReviewStatus").value = activeResultNode.reviewStatus || "checked";

    const qBox = document.getElementById("mdQuestionsReviewContainer");
    qBox.innerHTML = "";
    
    if(activeResultNode.responses) {
        Object.keys(activeResultNode.responses).forEach((k, i) => {
            const resp = activeResultNode.responses[k];
            qBox.innerHTML += `
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px;">
                    <div><strong>Суроо №${i+1}:</strong> ${resp.questionText || 'Эссе форматындагы суроо'}</div>
                    <div style="color:#ffa800;">Окуучунун жообу: ${resp.studentAnswer || 'Жооп берилген эмес'}</div>
                    <div style="color:#00ffa3;">Туура жооп модели: ${resp.correctAnswer || 'Мугалимдин кароосунда'}</div>
                </div>
            `;
        });
    }

    document.getElementById("mdBtnSaveChanges").onclick = saveReviewChanges;
}

function saveReviewChanges() {
    if(!activeResultNode) return;
    activeResultNode.manualPoints = parseInt(document.getElementById("mdManualPoints").value) || 0;
    activeResultNode.teacherComment = document.getElementById("mdTeacherComment").value;
    activeResultNode.reviewStatus = document.getElementById("mdReviewStatus").value;

    set(ref(database, `teachers/${teacherId}/results/${activeResultNode.id}`), activeResultNode)
        .then(() => {
            document.getElementById("studentDetailModal").style.display = "none";
            alert("Баалоо маалыматтары базага ийгиликтүү бекитилди!");
        });
}
